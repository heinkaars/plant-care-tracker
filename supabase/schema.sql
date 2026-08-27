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
