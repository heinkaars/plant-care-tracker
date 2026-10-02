-- ---------------------------------------------------------------------------
-- Run once in the Supabase SQL editor (or as a migration).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Plants table, mirroring the shape currently kept in localStorage
-- (types/plant.ts). careSchedules and careHistory stay as JSONB so the
-- existing app types map over with minimal change; normalize into their own
-- tables later if you want to query across them.
-- ---------------------------------------------------------------------------
create table if not exists public.plants (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  name             text not null,
  scientific_name  text,
  photo            text,
  care_schedules   jsonb not null default '[]'::jsonb,
  care_history     jsonb not null default '[]'::jsonb,
  notes            text,
  date_added       timestamptz not null default now()
);

create index if not exists plants_user_id_idx on public.plants (user_id);

alter table public.plants enable row level security;

-- Every policy is scoped to auth.uid(), so a caller can only ever see or
-- change their own plants — anonymous users included, since they have a
-- real auth.uid() too.
create policy "Users can view own plants"
  on public.plants for select
  using (auth.uid() = user_id);

create policy "Users can insert own plants"
  on public.plants for insert
  with check (auth.uid() = user_id);

create policy "Users can update own plants"
  on public.plants for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own plants"
  on public.plants for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Rate-limit backing table + function for lib/api-guard.ts.
-- ---------------------------------------------------------------------------

-- Counts recent calls per "bucket" (e.g. 'identify-plant:user:<uuid>' or
-- 'identify-plant:ip:<address>'). A counter that resets on redeploy is not a
-- ceiling, which is why this lives in Postgres rather than in memory.
create table if not exists public.api_usage (
  id         bigserial primary key,
  bucket     text not null,
  created_at timestamptz not null default now()
);

create index if not exists api_usage_bucket_idx on public.api_usage (bucket, created_at desc);

alter table public.api_usage enable row level security;

-- api_usage gets NO policies, and that is the point rather than an oversight:
-- with row level security on and nothing granted, clients can neither read
-- nor write it, while the service role bypasses row level security and does
-- both. A caller able to delete from this table could erase the ceiling
-- limiting it, so the ability is withheld from every caller.

create or replace function public.claim_api_budget(
  p_buckets        text[],
  p_maxes          integer[],
  p_window_seconds integer
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  since      timestamptz := now() - make_interval(secs => p_window_seconds);
  bucket_key text;
  used       integer;
  i          integer;
begin
  if p_buckets is null
     or array_length(p_buckets, 1) is null
     or array_length(p_buckets, 1) <> array_length(p_maxes, 1) then
    raise exception 'claim_api_budget: p_buckets and p_maxes must be the same non-empty length';
  end if;

  -- One lock per bucket, taken in a fixed order so two callers who share a
  -- bucket queue up behind each other instead of deadlocking. Advisory locks
  -- are released at the end of this transaction, which is the end of this call.
  for bucket_key in select t.b from unnest(p_buckets) as t(b) order by t.b loop
    perform pg_advisory_xact_lock(hashtext(bucket_key));
  end loop;

  for i in 1 .. array_length(p_buckets, 1) loop
    select count(*) into used
      from public.api_usage u
     where u.bucket = p_buckets[i]
       and u.created_at > since;

    -- Over on any one bucket refuses the whole call and records nothing, so a
    -- caller already past the line stops growing the table.
    if used >= p_maxes[i] then
      return false;
    end if;
  end loop;

  insert into public.api_usage (bucket)
  select unnest(p_buckets);

  return true;
end;
$$;

-- Supabase's default privileges grant execute on new functions to the client
-- roles too, so the grant has to be taken back rather than merely not given.
revoke all on function public.claim_api_budget(text[], integer[], integer) from public;
revoke all on function public.claim_api_budget(text[], integer[], integer) from anon, authenticated;
grant execute on function public.claim_api_budget(text[], integer[], integer) to service_role;

-- ---------------------------------------------------------------------------
-- Atomic care-event append, for lib/storage.ts's addCareEvent (ISSUES.md #30).
--
-- addCareEvent used to read a plant's care_history/care_schedules into JS,
-- mutate them there, then write both columns back. Two tabs marking care on
-- the same plant could both read the same pre-mutation state and then race
-- to write — the second write wins and silently drops the first tab's event.
--
-- This function does the append and the matching schedule's
-- lastCareDate/nextDueDate update inside one UPDATE statement, computed from
-- whatever care_history/care_schedules the row holds at the moment this
-- statement runs rather than from a value read earlier in JS. Two concurrent
-- calls serialize on Postgres's row lock for the UPDATE, so the second call's
-- jsonb expressions are evaluated against the first call's already-committed
-- result — nothing is lost.
--
-- The next-due-date arithmetic itself (seasonal frequency, hemisphere, the
-- frequency-0-means-skip rule) stays in lib/seasonUtils.ts / lib/careStatus.ts
-- and is resolved client-side before calling this — porting that into SQL
-- would duplicate it in two languages for no benefit, since none of it reads
-- data subject to the two-tab race (a schedule's configured frequency isn't
-- changed by marking care done).
--
-- security invoker (the default, stated explicitly) so RLS still scopes the
-- update to auth.uid() exactly as the "Users can update own plants" policy
-- already does for a plain client-side update — a plant id the caller
-- doesn't own matches zero rows rather than being bypassed.
create or replace function public.append_care_event(
  p_plant_id      uuid,
  p_care_type     text,
  p_care_date     text,
  p_next_due_date text,
  p_notes         text default null
)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.plants
  set
    care_history = jsonb_build_array(
      jsonb_strip_nulls(jsonb_build_object(
        'id', gen_random_uuid()::text,
        'type', p_care_type,
        'date', p_care_date,
        'notes', p_notes
      ))
    ) || care_history,
    care_schedules = (
      select coalesce(jsonb_agg(
        case
          when sched->>'type' = p_care_type then
            sched
              || jsonb_build_object('lastCareDate', p_care_date)
              || jsonb_build_object('nextDueDate', p_next_due_date)
          else sched
        end
      ), '[]'::jsonb)
      from jsonb_array_elements(care_schedules) as sched
    )
  where id = p_plant_id;
$$;
