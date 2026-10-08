# Outstanding Issues

Findings from a full read of the codebase, ordered by priority. Line
references point at the current `add-supabase-auth` branch.

**Branch state:** `694dbad` and `c3f5f0f` sit on `add-supabase-auth`; `main` is
still the localStorage version. Nothing below has shipped.

**Recently closed:** the auth context and `AuthForm` added in `694dbad` were
never rendered by any page. Fixed in `c3f5f0f` — see `/account` and
`components/NavAccountLink.tsx`.

**Automation:** a scheduled cloud agent fixes one `Open` item per weekday
(in the order below, skipping `Blocked` ones) and pushes to
`add-supabase-auth`. Each item carries a `**Status:**` line —
`Open` / `Blocked — <reason>` / `Fixed — <date>` — since that line is the only
memory this automation has between runs. Do not remove or reorder items;
append new ones discovered along the way instead.

---

## P0 — Critical

### 1. Supabase env vars are missing locally, so the app won't build or run

**Status:** Fixed — 2026-09-01

Resolved by creating a new, separate Supabase account/project (the two
existing free-tier projects were already at the account's 2-project cap) and
filling in `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Ran
`supabase/schema.sql` in that project's SQL Editor and enabled anonymous
sign-ins under Authentication → Providers. Verified end-to-end in the
browser: anonymous session bootstraps on load, dashboard renders, adding a
plant inserts and reads back through RLS with no console errors.

**Correction — 2026-09-01.** The line above originally also claimed all three
auth flows had been exercised. A re-check in the browser found that was not
true: sign-up failed outright against the live project. The schema, the env
vars and the anonymous bootstrap were genuinely verified; sign-up was not, and
was broken — see item 26. All three flows have since been run for real, and
the claim now holds.

**Extends to Vercel — 2026-09-01.** The env vars above were local only.
Every Vercel deployment of this branch had failed the same way since it was
created (`694dbad`, 2026-08-27) — 9 failures straight, invisible unless you
went looking, since Vercel keeps serving the last good build so nothing
outwardly breaks. Root cause was the same missing vars, one level up: Vercel
itself didn't have them.

Fixing it took two passes. Saving the four vars
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `TRUSTED_PROXY_HOPS`) in the dashboard defaulted
their **Environments** field to Production only, so the next Preview build
(`vercel redeploy --target preview`) failed on the identical error. Adding
Preview to all four fixed it for real — confirmed by a green build
(`plant-care-tracker-juco580qt-…`) whose two readable `NEXT_PUBLIC_*` values
were pulled back and diffed against `.env.local` byte-for-byte, so this
wasn't just "a build succeeded," which item 1 above already showed is
possible with dummy values too.

Also confirmed while in there: the Production alias
(`plant-care-tracker-rust.vercel.app`) has no Vercel Deployment Protection —
real visitors reach it directly. Preview URLs do sit behind Vercel's login
wall, which is normal and not a problem to fix.

`.env.local` contains only `OPENAI_API_KEY`. Without
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, no Supabase
client can be constructed anywhere — middleware, Server Components, or the
browser — so **every page returns 500** on `npm run dev`.

`npm run build` fails outright too, during static prerender of `/`, before
middleware is even involved:

```
Error: @supabase/ssr: Your project's URL and API key are required to create a Supabase client!
Export encountered an error on /page: /, exiting the build.
```

Confirmed to be purely the missing vars: the same build succeeds with dummy
values substituted. So the deploy is broken, not just local dev.

Consequence beyond local dev: the auth flows shipped in `c3f5f0f` (sign-up,
sign-in, sign-out) have **never been run against a real Supabase project**.
They are typechecked and their rendering is verified, nothing more.

- Fill in `.env.local` from `env.example`, then exercise all three flows
  before merging to `main`.
- Run `supabase/schema.sql` in the SQL editor, and enable anonymous sign-ins
  in the Supabase dashboard — the bootstrap in
  [lib/auth-context.tsx:128](lib/auth-context.tsx#L128) depends on it.
- Consider failing fast with a clear message when the vars are absent,
  rather than a raw 500 from middleware.

### 2. Winter "skip fertilizing" makes the plant permanently overdue

**Status:** Fixed — 2026-08-31

Both AI prompts instruct the model to return `0` for winter fertilizing when
the plant should not be fed
([search-plant:36](app/api/search-plant/route.ts#L36),
[identify-plant:36](app/api/identify-plant/route.ts#L36)). Nothing treats `0`
as "skip":
[lib/storage.ts:152](lib/storage.ts#L152) computes `addDays(parseISO(now), 0)`,
so the next due date lands on the moment the user marked the task done.
[lib/careStatus.ts:23](lib/careStatus.ts#L23) then reports `overdue`
immediately, and keeps reporting it for the rest of the winter.

Every AI-added plant hits this the first time the user fertilizes in winter.
The dashboard's overdue count is wrong, and the fix the user attempts —
marking it done again — reproduces the state.

A frequency of `0` needs to mean `nextDueDate = null` until the season turns,
in both `addCareEvent` and the schedule seeding in `AddPlantModal`.

### 3. The first due date always uses the summer frequency

**Status:** Fixed — 2026-09-01

[components/AddPlantModal.tsx:154](components/AddPlantModal.tsx#L154) seeds
every `nextDueDate` from `data.wateringFrequency` /
`data.fertilizingFrequency` / `data.repottingFrequency` — and those are
hardcoded to the summer value when the AI fills the form
([AddPlantModal.tsx:66](components/AddPlantModal.tsx#L66)). Seasonal data is
stored on the schedule but ignored for the initial date.

Add a plant in December and it is scheduled on a summer cadence until the
first "Mark Done". `storage.addCareEvent` gets this right via
`getSeasonalFrequency`, so the two code paths disagree about the same plant.

Seed the first due date through `getCurrentFrequency` like everything else.

### 4. Signing in strands the anonymous account's plants

**Status:** Blocked — needs a product decision on merge behavior when both accounts hold plants — ask the user before implementing

`signIn` swaps to a different user id, and every plant row is scoped to the
id that created it ([lib/auth-context.tsx:29](lib/auth-context.tsx#L29)
documents this). A user who adds plants anonymously and then signs into an
existing account silently loses access to all of them.

This became reachable the moment the account UI shipped. Needs a server-side
migration (a Postgres function reassigning `user_id`) invoked before or
during sign-in, plus a decision about what to do when both accounts hold
plants.

Note the doc comment points at "the README" for this migration; the README
says nothing about it. See also item 20.

### 5. A plant added before the session exists is silently discarded

**Status:** Fixed — 2026-09-02

No page waits for the auth bootstrap. [app/page.tsx:16](app/page.tsx#L16),
[app/plants/page.tsx:25](app/plants/page.tsx#L25) and
[app/plants/[id]/page.tsx:20](app/plants/[id]/page.tsx#L20) all call `storage`
on mount, racing the `signInAnonymously` call in `AuthProvider`.

Reads degrade quietly — RLS returns zero rows, which renders as an empty
collection. Writes lose data: if the user submits the add-plant form before
the session lands, [lib/storage.ts:80](lib/storage.ts#L80) logs to the console
and returns `undefined`, while
[app/plants/page.tsx:36](app/plants/page.tsx#L36) closes the modal as though
it had worked. The plant is gone with no message.

Gate every `storage` call on `ready && userId` from `useAuth`, and surface a
failed insert to the user.

### 6. Photo uploads are unbounded

**Status:** Fixed — 2026-09-03

Of the four fixes this item called for, two landed today; two remain and are
tracked as item 29 (they need a real Supabase Storage bucket to build against
and verify, which this environment doesn't have credentials for — see item 29
for why that's a separate step rather than more of this one).

Landed:

- [components/AddPlantModal.tsx](components/AddPlantModal.tsx) no longer reads
  the camera file straight to base64. `lib/image.ts` (new) downscales it
  client-side via canvas to a max 1024px edge, JPEG quality 0.82, before it's
  used for either the OpenAI Vision request or the stored `photo` field. A
  5–10 MB phone photo now becomes a few hundred KB before it leaves the
  browser, which shrinks the OpenAI payload, the Postgres row, and what the
  grid has to pull, without touching the storage layer itself.
- [app/api/identify-plant/route.ts](app/api/identify-plant/route.ts) now
  rejects any request over 8 MB (`content-length` check) with a 413 before
  parsing the body — a backstop for a caller that skips client-side
  compression, since Route Handlers have no default body-size limit and the
  rate limiter in `lib/api-guard.ts` caps call count, not payload size.

Incidentally fixed in the same edit: `handleCameraCapture`'s try/catch never
actually caught anything, because the code that could throw ran inside
`reader.onloadend`, an async callback invoked after the `try` block had
already returned — an error there became an unhandled rejection instead of
hitting `catch`. Moving to `compressImageFile` (an awaited promise) put the
throwing code back inside the `try`.

Original text, for reference:

[components/AddPlantModal.tsx:86](components/AddPlantModal.tsx#L86) reads the
camera file straight to base64 — no size check, no resize, no compression —
then both ships it to OpenAI Vision and stores it raw in a Postgres `text`
column ([supabase/schema.sql:16](supabase/schema.sql#L16)).

A 5–10 MB phone photo means bloated rows, slow list queries (`storage.getPlants`
does `select *`, pulling every photo to render a grid), and inflated
per-request OpenAI cost. App Router route handlers have no default body-size
limit, so `/api/identify-plant` will forward an arbitrarily large image on
your key — the rate limiter in `lib/api-guard.ts` caps call count, not payload.

- Resize/compress client-side to a sane max edge before upload. — done above.
- Move photos to Supabase Storage and keep a URL in the row. — item 29.
- Select explicit columns in list views so photos aren't fetched for the grid. — item 29.
- Reject oversized bodies at the route boundary. — done above.

---

## P1 — High

### 7. Storage failures are invisible to the user

**Status:** Fixed — 2026-09-04

Every method in [lib/storage.ts](lib/storage.ts) swallows its error into a
`console.error` and returns an empty or `undefined` value
([:52](lib/storage.ts#L52), [:64](lib/storage.ts#L64),
[:100](lib/storage.ts#L100), [:121](lib/storage.ts#L121),
[:128](lib/storage.ts#L128)). A network blip on the dashboard renders as
"No plants yet!" — indistinguishable from a genuinely empty account. Failed
deletes and updates produce no feedback at all; the UI simply doesn't change.

Relatedly, [app/plants/[id]/page.tsx:37](app/plants/[id]/page.tsx#L37) does
`setPlant((await storage.getPlant(id))!)` — a failed refetch after a care
event sets `plant` to `undefined` and pins the page on "Loading..." forever.

Return errors to callers and render an error state distinct from the empty
state.

**Resolved.** `lib/storage.ts` no longer swallows a Supabase error into
`console.error` plus an empty/`undefined` return — every method now logs and
then throws a friendly `Error` (a new `fail()` helper), the same
throw-and-catch shape `lib/auth-context.tsx` already used for auth errors.
`getPlant` still returns `undefined` for a genuine not-found (`data` null,
no `error`), so "not found" and "failed to load" stay distinguishable.

All three pages that call `storage` (`app/page.tsx`, `app/plants/page.tsx`,
`app/plants/[id]/page.tsx`) now catch the initial load and render a
`loadError` state — the same red-box-plus-"Try again" pattern already used
for the `useAuth` `error` — instead of falling through to the "No plants
yet!" empty state. "Try again" re-runs the fetch via a `reloadIndex` state
bump, since `ready`/`userId` don't change on their own.

Mutations get feedback too: `app/plants/page.tsx`'s delete and
`app/plants/[id]/page.tsx`'s delete/care-event handlers catch the throw and
show a dismissible `actionError` banner instead of failing silently.
`handlePlantAdded` catches `addPlant`'s throw and returns `false`, which
`AddPlantModal` already rendered a message for — no change needed there.

Fixed the `getPlant(id)!` non-null assertion in the same edit: the care-event
handler now only calls `setPlant` when the refetch actually returns a plant,
and reports failure via `actionError` otherwise instead of pinning the page
on "Loading..." forever.

### 8. No ESLint configuration exists

**Status:** Fixed — 2026-09-07

There is no `.eslintrc*` or `eslint.config.*` in the repo. `npm run lint`
drops into `next lint`'s interactive "How would you like to configure
ESLint?" prompt — it has never actually run against this codebase, and it
will hang any non-interactive caller.

This also blocks item 22: a CI job that runs lint cannot pass until this is
fixed. `next lint` is deprecated in Next 15 and removed in 16, so configure
the ESLint CLI directly rather than reviving it.

**Resolved.** Added `.eslintrc.json` (`next/core-web-vitals` +
`next/typescript`, matching the `eslint@8`/`eslint-config-next@15` already in
`devDependencies` — legacy config format, since flat config is an ESLint 9+
thing) and `.eslintignore` (`.next`, `out`, `build`, `node_modules`,
`next-env.d.ts` — the last one is gitignored and regenerated by `next
build`/`next dev`, but linting it after a local build was flagging Next's
own generated triple-slash reference).
`package.json`'s `lint` script now runs `eslint .` directly instead of
`next lint`, so it's non-interactive and CI-safe.

Running it against the existing codebase surfaced 2 errors
(`react/no-unescaped-entities` — a raw `'` in JSX text in
[app/plants/[id]/page.tsx:298](app/plants/[id]/page.tsx#L298) and
[components/AddPlantModal.tsx:248](components/AddPlantModal.tsx#L248)) and 3
easy warnings (two unused `catch (parseError)` bindings in the API routes,
one unused `addDays` import in `lib/careStatus.ts`). Fixed all five in this
same commit so the newly-added linter starts from a clean run rather than an
already-red one. The remaining 5 warnings are all `@next/next/no-img-element`
on the plain `<img>` tags item 19 already tracks — left alone as out of
scope here.

Incidental finding while verifying `npm run build`: it was already failing
on `main` before this fix, independent of it — `next build`'s own internal
lint/type-check step turns ESLint errors into a hard "Failed to compile.",
and the two unescaped-quote errors above were tripping that even with no
`.eslintrc*` present (`next build` bundles its own default Next.js lint
rules regardless of a project config; only `next lint`/`eslint .` needed the
config to run at all). Fixing those 2 errors was necessary for `npm run
build` to get past the lint step, and cleared it. One more, unrelated
env-var gap turned up right after: the build then failed collecting page
data for `/api/identify-plant` on a missing `OPENAI_API_KEY` (the OpenAI
client is constructed at module scope in both API routes). That's not new —
it's just a second env var, beyond the Supabase ones item 1 already covers,
that this environment needs dummy values for to run `npm run build`
end-to-end. Verified with
`NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... OPENAI_API_KEY=sk-dummy-key-for-build-test npm run build`
— exits 0.

### 9. AI responses are parsed but never validated, and use a legacy model

**Status:** Fixed — 2026-09-08

Both routes `JSON.parse` the model's output and trust its shape completely
([search-plant:82](app/api/search-plant/route.ts#L82),
[identify-plant:87](app/api/identify-plant/route.ts#L87)). A response missing
a season key, or returning a string where a number belongs, flows unchecked
into `PlantFormData`, into the `jsonb` columns, and then into `addDays` —
where a non-number yields an Invalid Date.

Neither route asks for JSON mode; both regex the object out of the response
as a fallback. And [search-plant:29](app/api/search-plant/route.ts#L29) still
pins `model: 'gpt-4'`, which is slower and more expensive than the `gpt-4o`
the vision route already uses.

- Set `response_format: { type: 'json_object' }` so the model returns
  parseable JSON in the first place.
- Validate against a schema (zod) at the route boundary and return a 502 on a
  malformed model response.
- Move `search-plant` off `gpt-4`.

**Resolved.** Added `zod` as a dependency and a shared
[lib/plantAiSchema.ts](lib/plantAiSchema.ts) — `plantAiResponseSchema` —
describing the exact shape both prompts already ask for (`name`,
`scientificName`, `watering`/`fertilizing`/`repotting` as
`{spring, summer, fall, winter}` of numbers, `careNotes`). Both routes now
run the parsed JSON through `plantAiResponseSchema.safeParse` after the
existing parse-then-regex-fallback step, and return a 502 with a generic
"unexpected response from the AI" message (not the raw zod error) when it
fails, instead of forwarding an unvalidated shape into `PlantFormData`.

Both routes also now pass `response_format: { type: 'json_object' }`, and
`search-plant` moved from `model: 'gpt-4'` to `gpt-4o`, matching
`identify-plant` — `gpt-4` predates OpenAI's JSON mode support, so this had
to move together with adding `response_format` rather than as a separate
step.

Verified: `npx tsc --noEmit` clean, `npm run lint` unchanged (same 5
pre-existing `no-img-element` warnings, item 19), `npm run build` succeeds
with dummy env vars. Not exercised against the live OpenAI API in this
sandboxed run (no network credentials here) — the schema mirrors the
existing prompts' documented format exactly, so a well-formed model response
parses unchanged; only a malformed one now gets caught instead of flowing
through.

### 10. `addCareEvent` is a read-modify-write of the whole row

**Status:** Fixed — 2026-09-09

[lib/storage.ts:132](lib/storage.ts#L132) fetches the plant, mutates the
history and schedule in JS, then writes every column back — photo included.
Two tabs marking care on the same plant lose one of the two events, and each
care event round-trips the full base64 photo in both directions.

Move the mutation into a Postgres function, or at minimum update only the
`care_schedules` and `care_history` columns.

**Resolved — the "at minimum" half.** Added `storage.updateCareData(id,
careSchedules, careHistory)` in [lib/storage.ts](lib/storage.ts), a Supabase
`update` that sends only those two columns. `addCareEvent` now calls it
instead of `updatePlant`, so a care check-in no longer round-trips
`name`/`photo`/`notes` — the base64 `photo` column in particular, since item
29 (moving photos to Storage) hasn't landed yet. `updatePlant` itself is
untouched and stays the full-row update, since it's the natural fit for the
edit UI item 12 still needs to build.

Went with the minimal fix rather than a Postgres function: the real fix for
the two-tabs race needs the season-frequency logic
([lib/seasonUtils.ts](lib/seasonUtils.ts)) duplicated into SQL so the next
due date can be computed atomically inside the function, and verifying that
against a live project needs Supabase credentials this sandboxed run doesn't
have (same constraint as item 29) — safer to land the bandwidth fix now and
track the atomic version separately. See item 30.

Verified: `npx tsc --noEmit` clean, `npm run lint` unchanged (same 5
pre-existing `no-img-element` warnings), `npm run build` succeeds with dummy
env vars. Not exercised against a live Supabase project in this run.

### 11. Password reset is implemented but unreachable

**Status:** Fixed — 2026-09-10

`requestPasswordReset` and `resetPassword`
([lib/auth-context.tsx:185](lib/auth-context.tsx#L185)) are fully written and
exposed on the context, but no component calls them —
[components/AuthForm.tsx](components/AuthForm.tsx) offers only sign-up and
sign-in. A user who forgets their password has no recovery path in the UI.

Either wire a reset flow into `AuthForm` / `/account`, or drop the dead code.

**Resolved.** Wired a reset flow into `AuthForm`, mirroring the existing
two-step `sign-up`/`confirm` shape rather than inventing a new pattern:
a `reset-request` mode collects the email and calls
`requestPasswordReset`, then a `reset-confirm` mode collects the emailed
code plus a new password and calls `resetPassword` in one step. A "Forgot
password?" link on the sign-in screen enters the flow; on success it drops
back to `sign-in` with a confirmation notice. `/account` needed no changes —
it already just renders `<AuthForm />` when there's no `email`.

Same unstated dependency item 26 hit for sign-up applies here too: the
project's "Reset Password" email template must include `{{ .Token }}` for a
code to exist to type, which is a Supabase dashboard setting, not something
this change can verify from a sandboxed run with no live credentials. The
code path is otherwise exactly symmetric with the already-verified
sign-up/confirm flow.

Verified: `npx tsc --noEmit` clean, `npm run lint` unchanged (same 5
pre-existing `no-img-element` warnings), `npm run build` succeeds with dummy
env vars. Not exercised against a live Supabase project in this run (no
credentials in this environment).

### 12. No way to edit a plant

**Status:** Fixed — 2026-09-11

The README advertises "Add, edit, and remove plants from your collection".
There is no edit UI — `storage.updatePlant` exists but is only ever called
internally by `addCareEvent`. Name, notes, photo, and frequencies are all
fixed at creation, which is a problem given item 3 seeds them wrong.

**Resolved.** Added [components/EditPlantModal.tsx](components/EditPlantModal.tsx),
wired into the "Edit Plant" button on
[app/plants/[id]/page.tsx](app/plants/[id]/page.tsx) next to "Delete Plant".
Lets the user change name, scientific name, notes, photo (re-uploaded through
the same `compressImageFile` client-side downscale `AddPlantModal` uses), and
each care schedule's frequency — a single days input for a schedule with no
`seasonalFrequency`, or four per-season inputs (mirroring the seasonal
breakdown already shown in the detail view) for one that has it. Saving calls
`storage.updatePlant`, reusing the existing full-row update method that was
previously unreachable from the UI.

Editing a frequency has to move `nextDueDate` with it, or the fix would just
swap item 3's bug for a new one where the due date silently stops matching
the displayed frequency. Added `computeNextDueDate(schedule, fallbackDate)`
in [lib/careStatus.ts](lib/careStatus.ts), generalizing the same "count
forward from `lastCareDate`, or from the fallback date if never cared for;
0 means skip until the season turns" rule `addCareEvent` and
`AddPlantModal.buildSchedule` already use, and call it for every schedule on
save.

Verified: `npx tsc --noEmit` clean, `npm run lint` unchanged aside from one
new (expected) `no-img-element` warning for the modal's own photo preview —
same pattern item 19 already tracks for every other plant photo `<img>` in
the app — and `npm run build` succeeds with dummy env vars. Not exercised
against a live Supabase project in this run (no credentials in this
environment; same constraint noted on items 9–11).

### 13. No tests

**Status:** Fixed — 2026-09-14

[lib/careStatus.ts](lib/careStatus.ts) and [lib/seasonUtils.ts](lib/seasonUtils.ts)
are pure, date-driven business logic — season boundaries, overdue vs. due-soon
thresholds, dashboard aggregation. Cheap to unit test, easy to break silently.
Start here; items 2 and 3 are both exactly the kind of bug a table-driven test
over the four seasons would have caught.

**Resolved — a real first slice, not the whole of "testing."** Added
`vitest` (pinned to 2.1.9, since vitest 5's `@types/node` peer range —
`^22 || >=24` — conflicts with this project's `@types/node: ^20`) plus
[vitest.config.ts](vitest.config.ts), aliasing `@/*` the same way
`tsconfig.json` already does so the test files can import with the app's
normal paths. `npm run test` runs `vitest run`.

[lib/seasonUtils.test.ts](lib/seasonUtils.test.ts) table-drives
`getCurrentSeason` across all four season boundaries for both hemispheres
(northern and southern — the `hemisphere` argument item 17 found unreachable
from the app is still exercised directly here), plus `getSeasonalFrequency`
and `getSeasonDisplay`.

[lib/careStatus.test.ts](lib/careStatus.test.ts) covers `getCurrentFrequency`
and `computeNextDueDate` (including the frequency-0 "skip until the season
turns" rule items 2 and 12 depend on, and counting forward from
`lastCareDate` vs. the fallback date), `getCareStatus`'s overdue/due-soon/ok
thresholds at and around the 3-day boundary with the system clock pinned via
`vi.setSystemTime`, and the aggregation in `getPlantStatus`,
`getDashboardStats`, and `getUpcomingCare` (including its urgency sort).
47 tests total, all passing.

Deliberately scoped to these two files, per the item's own "Start here" —
the rest of the codebase (API routes, `lib/storage.ts`, components) has no
coverage yet. See item 31 for what's left.

### 14. Dependency vulnerabilities

**Status:** Fixed — 2026-09-15

**Resolved — the part scoped to `npm audit fix` and a patch bump.** By today,
`npm audit --omit=dev` had grown past what this item originally described —
`next`'s range had accumulated a long list of newly-published critical/high
CVEs (request smuggling, several Server Component and Middleware/Proxy
bypass and cache-poisoning issues, DoS, and more) on top of the two originally
named. `npm audit fix` (no `--force`) bumped `sharp` past all four libvips
CVEs. Bumping `next` from `^15.0.0` to `^15.5.25` — still the patch-release
move this item called for, just further down the same 15.x line than it
anticipated — cleared every one of those `next`-specific advisories.

One advisory remains after both fixes: `next@15.5.25` still vendors its own
internal `postcss@8.4.31` (in `node_modules/next/node_modules/postcss`,
separate from this project's own `postcss@8.5.28`), which carries the
XSS/path-traversal advisories. `npm audit fix --force` reports the only fix
is `next@16.3.5` — a major-version jump, not a patch release, so it's out of
scope for what this item asked for and is tracked as item 32 instead of
being forced through same-day.

Verified: `npm audit --omit=dev` now reports only that one remaining
postcss-via-next advisory (down from the original list). `npx tsc --noEmit`
clean, `npm run lint` unchanged (same 6 pre-existing `no-img-element`
warnings, item 19), `npm run build` succeeds with dummy env vars, and the
existing 47-test vitest suite (item 13) still passes unchanged.

Not touched: the dev-only `vitest`/`vite`/`esbuild` advisories `npm audit`
(without `--omit=dev`) also reports. Those need `vitest@5`, which item 13
already documented as blocked on this project's `@types/node: ^20` peer
range — same constraint, not new scope for this item.

### 15. Stray files in the working tree

**Status:** Fixed — 2026-09-16

`plant-care-tracker-auth-kit.zip` (28 KB) and `Plant-Care.code-workspace` sit
untracked in the repo root. The zip is unvetted — confirm it holds no
credentials, then delete it or add both to `.gitignore`.

**Resolved.** Neither file exists in this (or any) fresh checkout: `git log
--all --diff-filter=A --name-only` shows neither was ever committed, and
since they were untracked to begin with, a fresh clone never carries them
over regardless of what sat in the working tree that first spotted them —
there was nothing in the repo itself to delete or vet for credentials.
Added `*.zip` and `*.code-workspace` to `.gitignore` so this class of file
can't be accidentally committed in the future, which is the durable half of
the original ask.

---

## P2 — Medium

### 16. Native `confirm()` / `prompt()` for destructive and data-entry actions

**Status:** Fixed — 2026-09-17

Plant deletion used `confirm()` ([plants/page.tsx:43](app/plants/page.tsx#L43),
[plants/[id]/page.tsx:41](app/plants/[id]/page.tsx#L41)) and care notes used
`prompt()` ([plants/[id]/page.tsx:35](app/plants/[id]/page.tsx#L35)). Blocking,
unstyled, poor on mobile, and inconsistent with the rest of the UI.

**Resolved.** Added two new modal components matching the existing
`EditPlantModal`/`AddPlantModal` fixed-overlay/rounded-card pattern:
[components/ConfirmDialog.tsx](components/ConfirmDialog.tsx) (generic
title/message/confirm/cancel dialog, with a `danger` flag that reddens the
confirm button for destructive actions) and
[components/CareNotesModal.tsx](components/CareNotesModal.tsx) (a small form
with a notes textarea, replacing the "Add notes for X (optional):" prompt).

`app/plants/page.tsx` and `app/plants/[id]/page.tsx` both now track a
`confirmDelete`/`confirmDeleteId` piece of state instead of calling
`confirm()` inline — the Delete button opens the dialog, and the actual
`storage.deletePlant` call only runs from the dialog's `onConfirm`.
`app/plants/[id]/page.tsx`'s "Mark Done" button similarly opens
`CareNotesModal` (tracking which `CareType` triggered it) instead of calling
`prompt()`, and `handleCareEvent` now takes the notes as an argument from the
modal's `onConfirm` rather than reading a blocking prompt's return value.

Verified: `npx tsc --noEmit` clean, `npm run lint` unchanged (same 6
pre-existing `no-img-element` warnings, item 19), the existing 47-test vitest
suite (item 13) still passes unchanged, and `npm run build` succeeds with
dummy env vars. Not exercised in a browser in this sandboxed run (no way to
launch/screenshot the dev server here); the new components reuse the same
JSX/Tailwind shape already verified working in `EditPlantModal`, and the
state wiring mirrors the existing `showEditModal`/`showAddModal` pattern in
the same files.

### 17. Hemisphere is hardcoded to northern

**Status:** Fixed — 2026-09-18

[lib/seasonUtils.ts:10](lib/seasonUtils.ts#L10) accepts a `hemisphere`
argument but every caller uses the default — `getSeasonalFrequency` calls
`getCurrentSeason(date)` with no passthrough
([seasonUtils.ts:54](lib/seasonUtils.ts#L54)), so the parameter is
unreachable from the app. Southern-hemisphere users get inverted seasonal
care schedules. Needs a user setting threaded through `getSeasonalFrequency`.

**Resolved.** `getSeasonalFrequency` now takes and passes through a
`hemisphere` argument to `getCurrentSeason` instead of dropping it
([lib/seasonUtils.ts](lib/seasonUtils.ts)), and `getCurrentFrequency` /
`computeNextDueDate` in [lib/careStatus.ts](lib/careStatus.ts) grew the same
optional parameter (defaulting to `'northern'`, so every existing call site
that doesn't pass one keeps its current behavior).

The user setting itself lives in the Supabase auth user's own metadata
(`supabase.auth.updateUser({ data: { hemisphere } })`) rather than a new
table — it's a per-account preference, not plant data, so it doesn't need
its own RLS-scoped table or a schema migration, and it rides along with the
session the same way `signUp`'s email/password updates already do. Added
`hemisphere: Hemisphere` (`'northern' | 'southern'`) and a `setHemisphere`
action to [lib/auth-context.tsx](lib/auth-context.tsx)'s `AuthState` /
`AuthContextValue`, read off `session.user.user_metadata.hemisphere`
(defaulting to `'northern'` when unset, which covers every account created
before this change). A new "Preferences" section on
[app/account/page.tsx](app/account/page.tsx) exposes it as a select, visible
whether or not the user has attached an email — it applies to the anonymous
account too.

Threaded `hemisphere` from `useAuth()` into every place that resolves a
schedule's current-season frequency: `AddPlantModal.buildSchedule` (seeding
the first due date, item 3), `EditPlantModal.handleSubmit`
(`computeNextDueDate`, item 12), `app/plants/[id]/page.tsx`'s season/frequency
display and its call to `storage.addCareEvent`, and `storage.addCareEvent`
itself, which now takes `hemisphere` as a fourth argument and passes it into
`getSeasonalFrequency`. The dashboard and collection views needed no change —
they only call `getCareStatus`/`getPlantStatus`/`getDashboardStats`/
`getUpcomingCare`, which read an already-resolved `nextDueDate` rather than
recomputing a frequency.

Added two table-driven cases (one in
[lib/seasonUtils.test.ts](lib/seasonUtils.test.ts), one in
[lib/careStatus.test.ts](lib/careStatus.test.ts)) asserting that the same
date resolves to opposite seasons — and thus opposite frequencies — for
`'northern'` vs `'southern'`, so a regression that drops the hemisphere
argument again would fail a test rather than only showing up for real
southern-hemisphere users. 49 tests total, all passing (up from 47).

Verified: `npx tsc --noEmit` clean, `npm run lint` unchanged (same 6
pre-existing `no-img-element` warnings, item 19), the vitest suite passes
(49/49), and `npm run build` succeeds with dummy env vars. Not exercised in
a browser or against a live Supabase project in this run (no credentials in
this environment, same constraint noted on items 9–12) — `updateUser({ data
})` is the same call `signUp` already makes for email/password, so the only
new surface is reading `user_metadata.hemisphere` back off the session,
which is a plain property read.

### 18. Every AI failure blames the user's API key

**Status:** Fixed — 2026-09-21

[components/AddPlantModal.tsx:79](components/AddPlantModal.tsx#L79) and
[:133](components/AddPlantModal.tsx#L133) render "Please check your API key in
.env.local" for any non-OK response — including the guard's 401 ("Sign in
required") and 429 ("Too many requests") from
[lib/api-guard.ts](lib/api-guard.ts). Wrong advice for the two cases a real
user is most likely to hit, and it leaks a dev-only detail into the product.

Read `error` off the response body and show that instead.

**Resolved.** Both `/api/search-plant` and `/api/identify-plant` already
return `{ error: string }` on every non-OK path (400/401/413/429/500/502,
checked across both routes and `lib/api-guard.ts`), so there was a real value
to read. Added `extractErrorMessage(response)` in
[components/AddPlantModal.tsx](components/AddPlantModal.tsx) — parses the
response body and returns `body.error` when present, otherwise falls back to
`Request failed (<status>)` for a non-JSON body. `handleAISearch` and
`handleCameraCapture` now `throw new Error(await extractErrorMessage(response))`
instead of a hardcoded string, and their `catch` blocks render `err.message`
instead of the old "check your API key" text. A genuine network/fetch failure
(not a route response at all) still falls through to a generic
"Failed to search for plant" / "Failed to identify plant" message, since
there's no response body to read in that case.

Verified: `npx tsc --noEmit` clean, `npm run lint` unchanged (same 6
pre-existing `no-img-element` warnings, item 19), the 49-test vitest suite
(items 13/17) passes unchanged, and `npm run build` succeeds with dummy env
vars. Not exercised in a browser in this sandboxed run (no way to
launch/screenshot the dev server here, and no live OpenAI/Supabase
credentials to actually trigger a 401/429/502) — the three response shapes
were confirmed by reading every `Response.json`/`NextResponse.json` call in
`lib/api-guard.ts`, `app/api/search-plant/route.ts`, and
`app/api/identify-plant/route.ts` directly, all of which return `{ error }`.

### 19. Plain `<img>` instead of `next/image`

**Status:** Fixed — 2026-09-22

Used on the dashboard, collection, and detail pages — no lazy loading or
optimization. Relatedly, `images.domains` in `next.config.js` is dead config,
since nothing uses `next/image` at all (and `domains` is itself deprecated in
favour of `remotePatterns`).

**Resolved.** All 7 plain `<img>` tags — the dashboard's "Recent Plants" grid
([app/page.tsx](app/page.tsx)), the collection's grid and list views
([app/plants/page.tsx](app/plants/page.tsx)), the detail page's photo
([app/plants/[id]/page.tsx](app/plants/[id]/page.tsx)), and the photo
previews in [components/AddPlantModal.tsx](components/AddPlantModal.tsx) and
[components/EditPlantModal.tsx](components/EditPlantModal.tsx) — now use
`next/image`'s `<Image fill sizes="..." />` inside a `relative`-positioned
container matching the existing fixed-aspect box, since `plant.photo` is
currently a base64 data URL (item 29 hasn't moved photos to Storage yet) with
no intrinsic dimensions for `next/image` to read, and `fill` sidesteps that
without hardcoding width/height. The detail page's photo also got `priority`,
since it's the largest above-the-fold image on that route.

`images.domains` in `next.config.js` was in fact dead — nothing loads a
remote `http(s)` image anywhere in the app, only data URLs and local assets —
so it's removed rather than migrated to `remotePatterns`. `next/image`
handles a `data:` URI itself, unoptimized, without needing a domain allowlist
entry; a remote pattern can be added if item 29 starts serving photos from
Supabase Storage URLs.

Verified: `npx tsc --noEmit` clean, `npm run lint` clean with zero warnings
(previously 6 pre-existing `no-img-element` warnings, all now resolved by
this fix rather than suppressed), the 49-test vitest suite (items 13/17)
passes unchanged, and `npm run build` succeeds with dummy env vars. Not
exercised in a browser in this sandboxed run (no way to launch/screenshot the
dev server here) — `fill` + `sizes` + an explicitly `relative` ancestor is
the documented pattern for an image whose intrinsic size is unknown, and it
mirrors the `object-cover`-on-a-fixed-box layout every one of these `<img>`
tags already used.

### 20. Dangling reference to a `MIGRATION.md` that doesn't exist

**Status:** Fixed — 2026-09-23

[lib/storage.ts:9](lib/storage.ts#L9) pointed readers at "MIGRATION.md for the
exact diffs in page.tsx, plants/page.tsx, and plants/[id]/page.tsx". No such
file was in the repo. Either write it or drop the reference — and see item 4,
which has the same problem pointing at the README.

**Resolved.** Dropped the reference rather than writing the file: the
migration itself is long complete on `main` — `app/page.tsx`,
`app/plants/page.tsx`, and `app/plants/[id]/page.tsx` already `await` every
`storage` call — so a migration doc for a diff that already shipped would add
nothing a reader needs. The module comment in
[lib/storage.ts](lib/storage.ts) now just states that every call site already
awaits it, instead of pointing at a nonexistent file.

Item 4's README reference is a separate, still-open dangling pointer (a
not-yet-written server-side migration, not a historical diff) and is left for
its own item.

### 21. Dead code: discarded client-side plant id

**Status:** Fixed — 2026-09-24

[components/AddPlantModal.tsx:142](components/AddPlantModal.tsx#L142) generates
an `id` that `storage.addPlant` silently ignores — Supabase generates the real
one. A leftover from the localStorage era that misleads on first read.

**Resolved.** Removed the `id: \`${Date.now()}-${Math.random()}\`` line from
`createPlant` in `components/AddPlantModal.tsx` — `storage.addPlant` only ever
read the explicit fields it inserts (`name`, `scientificName`, `photo`,
`care_schedules`, `care_history`, `notes`, `date_added`), never `plant.id`, so
nothing behavioral depended on it.

Since `Plant.id: string` is required and a not-yet-saved plant genuinely has
no id, added `NewPlant = Omit<Plant, 'id'>` in
[types/plant.ts](types/plant.ts) instead of inventing a fake one. Threaded it
through the one path that builds a plant before it has a real id:
`AddPlantModal`'s `onPlantAdded` prop, `app/plants/page.tsx`'s
`handlePlantAdded`, and `storage.addPlant`'s parameter type all now say
`NewPlant` rather than `Plant`, so the type system reflects what was already
true at runtime instead of a call site synthesizing a value nothing reads.

Verified: `npx tsc --noEmit` clean, `npm run lint` clean, the 49-test vitest
suite (items 13/17) passes unchanged, and `npm run build` succeeds with dummy
env vars. Not exercised in a browser in this sandboxed run (no way to
launch/screenshot the dev server here, and no live Supabase credentials) —
this is a type-level cleanup with no change to what gets sent to Supabase.

---

## P3 — Low / polish

### 22. No CI

**Status:** Fixed — 2026-09-25

Nothing runs lint, typecheck, or build on push. A GitHub Action covering all
three would have caught the unwired-auth gap indirectly and guards the tests
from item 13. Note it needs item 8 resolved first — there is no lint config to
run today.

**Resolved.** Item 8 (ESLint config) and item 13 (vitest suite) had both
already landed, so the workflow covers all four checks rather than just the
two originally in scope. Added
[.github/workflows/ci.yml](.github/workflows/ci.yml): a single job on
`push`/`pull_request` to `main` and `add-supabase-auth` that runs `npm ci`,
then `npx tsc --noEmit`, `npm run lint`, `npm run test`, and `npm run build`
in that order (fail fast on the cheapest checks first). Node 20 to match
`@types/node: ^20.0.0`.

The build step needs env vars to get past static prerender of `/`
(item 1), so the job sets the same dummy `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_ANON_KEY` this automation's own verification step
already uses, plus a dummy `OPENAI_API_KEY` (item 8 found the OpenAI client
is also constructed at module scope) — none of them real credentials, only
enough to satisfy the client constructors during the build.

Verified by running the exact same four commands locally in this sandboxed
environment (`node_modules` had to be installed first via `npm ci`, which
was not yet present in this checkout): `npx tsc --noEmit` clean, `npm run
lint` clean (zero warnings), `npm run test` 49/49 passing, `npm run build`
succeeds with the dummy env vars. Not verified as an actual GitHub Actions
run in this sandboxed session (no way to trigger or observe Actions from
here) — the workflow runs the identical commands this automation already
uses to gate its own commits, so a green local run is a strong proxy.

### 23. No error boundary

**Status:** Fixed — 2026-09-28

An uncaught render error blanks the page with no recovery path.

**Resolved.** Added [app/error.tsx](app/error.tsx), the App Router's
segment-level error boundary — it catches a render error anywhere under the
root layout (so the nav still renders) and shows the same red-box "Try
again" pattern items 5/7 already established (`app/page.tsx`,
`app/plants/page.tsx`, `app/plants/[id]/page.tsx`), wired to Next's `reset()`
to retry rendering the segment instead of a full reload.

Also added [app/global-error.tsx](app/global-error.tsx) for the one case
`error.tsx` can't catch: an error thrown by the root layout itself
(`app/layout.tsx`). Since it replaces the whole root layout when it renders,
it supplies its own `<html>`/`<body>` and imports `./globals.css` directly
so Tailwind classes still apply — otherwise noted as a common gotcha in the
Next.js docs for this file.

Both are client components that log the caught error via `console.error`
before rendering the fallback, matching how errors are already surfaced
elsewhere in the app.

Verified: `npx tsc --noEmit` clean, `npm run lint` clean, the 49-test vitest
suite (items 13/17) passes unchanged, and `npm run build` succeeds with
dummy env vars. Not exercised in a browser in this sandboxed run (no way to
launch/screenshot the dev server here) — `error.tsx`/`global-error.tsx` are
plain Next.js file conventions with no data dependency, so a clean build is
a strong proxy; verifying the actual catch-and-reset behavior in a browser is
worth doing in a future run that has one.

### 24. Loading states are bare text

**Status:** Fixed — 2026-09-29

Every page renders `Loading...` centered on an empty screen. Skeletons
matching the eventual layout would reduce the jolt.

**Resolved.** Added [components/Skeletons.tsx](components/Skeletons.tsx) —
`DashboardSkeleton`, `PlantsGridSkeleton`, `PlantDetailSkeleton`, and
`AccountSkeleton`, each a `Pulse` (gray `animate-pulse` block) helper laid out
to match that page's actual post-load structure (stat cards and task rows for
the dashboard, a photo-card grid for `/plants`, the photo/info-column-plus-
schedule-column split for the plant detail page, the form-card shape for
`/account`). Each of the four `if (!ready || loading) return <div>Loading...</div>`
early-returns in `app/page.tsx`, `app/plants/page.tsx`,
`app/plants/[id]/page.tsx`, and `app/account/page.tsx` now returns its
matching skeleton instead.

Deliberately not addressed: `PlantsGridSkeleton` always renders the grid
layout, not the list layout `viewMode === 'list'` can switch to — `viewMode`
is local component state with no persisted default, so there's no signal to
pick from before the first render, and the grid is the initial default either
way.

Verified: `npx tsc --noEmit` clean, `npm run lint` clean (zero warnings), the
49-test vitest suite (items 13/17) passes unchanged, and `npm run build`
succeeds with dummy env vars. Not exercised in a browser in this sandboxed
run (no way to launch/screenshot the dev server here) — the skeletons are
static markup with no data dependency, built directly from each page's own
JSX structure.

### 25. Documentation is out of date as of `694dbad`

**Status:** Fixed — 2026-09-30

Both [README.md](README.md) and [SETUP.md](SETUP.md) still described
LocalStorage as the storage layer and omitted Supabase entirely:

- README listed "Data Storage: Local Storage (browser-based)" in the tech
  stack, documented only `OPENAI_API_KEY`, and its project-structure tree omitted
  `lib/supabase/`, `middleware.ts`, `lib/api-guard.ts`, and `supabase/schema.sql`.
- SETUP claimed "No account or backend required", and its "Data Not Persisting?"
  troubleshooting section gave actively wrong advice (it told users to
  check that LocalStorage is enabled).
- README's "Future Enhancements" list opened with "Backend database for data
  sync across devices" — which is what `694dbad` actually did.

**Resolved.** Rewrote both docs to describe the Supabase-backed app that
actually exists on this branch:

- [README.md](README.md): tech stack now lists Supabase (Postgres + RLS +
  Auth) instead of LocalStorage, adds an "Accounts" feature bullet
  (anonymous session, sign up/in, password reset), the install steps now
  require filling in the three Supabase env vars from `env.example` and
  running `supabase/schema.sql` + enabling anonymous sign-ins before `npm run
  dev` works at all, the project-structure tree adds `lib/supabase/`,
  `middleware.ts`, `lib/api-guard.ts`, `supabase/schema.sql`, `app/account/`,
  and the error-boundary/auth/editing components added since, "Data Storage"
  describes the RLS-scoped Postgres model instead of LocalStorage, `GPT-4` →
  `GPT-4o` (item 9), and "Future Enhancements" no longer lists the
  already-shipped backend-database item (replaced with the still-open
  Supabase Storage migration, item 29).
- [SETUP.md](SETUP.md): opens with the now-required Supabase project setup
  (schema, anonymous sign-ins, env vars) before the optional OpenAI-key
  section, replaces "No account or backend required" with a description of
  the anonymous-session/sign-up/password-reset flow, adds `npm run test` to
  the command list, and replaces the LocalStorage troubleshooting entry with
  one that matches the actual failure mode (missing/unset Supabase env vars
  or schema not run — item 1) and how to fix it.

Left as-is: neither doc mentions the `add-supabase-auth` branch/main split or
this automation, since both are repo-process details tracked in ISSUES.md
itself, not user-facing product docs.

Verified: `npm ci` (node_modules wasn't present in this checkout), `npx tsc
--noEmit` clean, `npm run lint` clean (zero warnings), the 49-test vitest
suite passes unchanged, and `npm run build` succeeds with dummy
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`/`OPENAI_API_KEY`
values. This item is documentation-only — no application code changed.

---

## Found after the first pass

Appended here to keep the numbering above stable; the `**Priority:**` line
carries the real severity.

### 26. Sign-up assumed email confirmation was switched off, and failed

**Priority:** P0
**Status:** Fixed — 2026-09-01

`signUp` set the address and the password in two back-to-back `updateUser`
calls, on the reasoning that "with email confirmation turned off the address
attaches immediately". The live project has it turned *on* —
`GET /auth/v1/settings` reports `mailer_autoconfirm: false`, which is also the
Supabase default — so the address only went as far as `new_email`, the account
stayed anonymous, and the second call came back:

```
422 — Updating password of an anonymous user without an email or phone is not allowed
```

Every attempt to claim an anonymous account ended on "Something went wrong.
Please try again." Found by actually running the form; a typecheck cannot see
this, since the wrong assumption is about a server-side project setting.

Fixed in [lib/auth-context.tsx](lib/auth-context.tsx): `signUp` now reads the
user it gets back and returns `'complete'` or `'confirmation-required'`
depending on whether the address actually attached, so the same code is
correct whichever way the project is configured. A new `confirmSignUp` takes
the emailed code, verifies it with `verifyOtp({ type: 'email_change' })` — which
is what makes the account non-anonymous — and only then sets the password.
[components/AuthForm.tsx](components/AuthForm.tsx) grew the matching code-entry
step, holding the typed password in component state until the code clears.

**Dependency this introduces, and it is currently unmet.** The password
cannot travel on the emailed link, so the flow needs a typed code, and that
means the project's **Change Email Address** template must include
`{{ .Token }}`. Confirmed by inspecting a real send: the project is on the
stock template, which carries only `{{ .ConfirmationURL }}`, so there is no
code to type. `resetPassword` has carried the same unstated requirement since
it was written (item 11).

**Resolved by configuration:** "Confirm email" is now **off**
(Authentication → Providers → Email), which `GET /auth/v1/settings` confirms
as `mailer_autoconfirm: true`. `signUp` returns `'complete'`, the password is
set in the same breath, no mail is sent, and the code-entry step never
renders. That matches what the account screen promises, and it sidesteps the
built-in SMTP rate limit (roughly two mails an hour on the free tier) that
would otherwise make a confirmation-gated sign-up fragile.

The alternative, if addresses ever need verifying again, is to add
`{{ .Token }}` to the template and let the code-entry step do its job. No code
change either way — that is the point of the branch.

**Consequence to be aware of:** `confirmSignUp` and the form's code step are
now unreachable in *this* project, in the same way item 11's reset flow is.
They are not speculative, though — a fresh Supabase project has confirmation
on by default, so without that branch anyone cloning this repo walks straight
into the 422 above. They stay untested here regardless.

**Verified — 2026-09-01**, in the browser against the live project, from a
cleared session: anonymous bootstrap → add a plant → sign up → the plant is
still there under the now-permanent account (same user id, nothing migrated)
→ sign out → fresh anonymous account with an empty collection → sign back in
→ the plant returns. No console errors anywhere in that sequence.

One incidental finding: a second `updateUser({ email })` for the same address
invalidates the first mail's token, so during testing an older link reports
`otp_expired`. Check the timestamp before concluding a link is broken.

### 29. Photos still live in a Postgres `text` column, not Supabase Storage

**Priority:** P0
**Status:** Blocked — 2026-10-01 — needs a real Supabase Storage bucket + RLS
policies created in the live project, plus a decision on existing base64
photos; this sandboxed environment has no Supabase credentials (no
`.env.local`, confirmed this run — see item 1 for how those get provisioned)

Split out of item 6, which closed today with the client-side-compression and
request-size-limit half of the fix. This is the other half: photos are still
stored as base64 in `plants.photo`
([supabase/schema.sql:16](supabase/schema.sql#L16)) rather than as a URL to a
Supabase Storage object, and `storage.getPlants`
([lib/storage.ts:45](lib/storage.ts#L45)) still does `select('*')`, so every
list-view query pulls every photo to render the grid — compression shrinks
the bytes involved but doesn't change either of those facts.

Not something to do same-day as item 6: it means creating a real Storage
bucket (via the dashboard or a `storage.buckets` insert in a migration) with
its own RLS policies scoping objects to the uploading user, rewriting
`addPlant`/`updatePlant` to upload the file and store the returned URL
instead of the data URL, backfilling or discarding existing base64 photos in
the one live project, and then actually verifying an upload/read/delete round
trip against that bucket — none of which this sandboxed run can do without
live Supabase credentials (no `.env.local` here; see item 1 for how those get
provisioned). Once photos are in Storage, "select explicit columns in list
views" becomes real: the grid can select just the URL column and let
`next/image` (see item 19, which is the same underlying gap) lazy-load a
resized version instead of shipping the blob through Postgres on every list
fetch.

- Create the bucket + RLS policies (owner-scoped, same pattern as
  `plants` — see `supabase/schema.sql`).
- `addPlant`/`updatePlant` upload to Storage, store the URL.
- `getPlants`/`getPlant` select explicit columns; drop `photo` from the list
  query, keep it only where a single plant's detail view needs it.
- Decide what to do with photos already sitting in the `photo` column from
  before this migration (backfill into Storage, or accept they stay as
  legacy data URLs).

**Checked — 2026-10-01.** Confirmed nothing has changed since this was split
out: `plants.photo` is still `text`
([supabase/schema.sql:16](supabase/schema.sql#L16)), `getPlants` still does
`select('*')` ([lib/storage.ts:45](lib/storage.ts#L45)), and no bucket exists
in `supabase/schema.sql`. This environment still has no `.env.local` and no
Supabase credentials, so the blocker the item already named is unchanged.

Writing the application code without the bucket is not a safe partial step
here, unlike most other items in this file: this pushes straight to `main`,
and `addPlant`/`updatePlant` switching to "upload to Storage, store the URL"
would make every photo upload fail in the live app the moment it deploys,
since the bucket + RLS policies don't exist yet in that project. That's a
regression of a currently-working feature, not an untested addition — a
different risk than, say, item 17's hemisphere threading, which degrades to
its existing default when unverified. The bucket has to exist in the live
project before this code can ship, and creating it (dashboard or a
`storage.buckets`/policy migration applied there) plus deciding how to treat
the existing base64 photos are both still outside what this sandboxed run
can do. Leaving `Blocked` rather than picking a different item, per this
automation's own rule for a blocker that needs infrastructure or a decision
only a human can provide.

### 30. `addCareEvent` is still a client-side read-modify-write, so two tabs can still lose an event

**Priority:** P1
**Status:** Fixed — 2026-10-02

Split out of item 10, which closed today with the bandwidth half of the fix
(`storage.updateCareData` now writes only `care_schedules`/`care_history`,
not the whole row). The race item 10 originally called out is still there:
`addCareEvent` ([lib/storage.ts:152](lib/storage.ts#L152)) still fetches the
plant, mutates history/schedule in JS, then writes those two columns back —
two tabs marking care on the same plant at nearly the same time can still
overwrite one event with the other, since neither write is conditioned on
what the other read.

Fixing it for real means a Postgres function (`security invoker`, so RLS
still scopes it to `auth.uid()`, matching the pattern in
[supabase/schema.sql](supabase/schema.sql)'s `claim_api_budget`) that appends
to `care_history` and updates the matching `care_schedules` entry atomically
in one statement, rather than in JS between a read and a write. That means
porting the season/frequency-selection logic in
[lib/seasonUtils.ts](lib/seasonUtils.ts) into SQL (or having the function
take the already-resolved frequency as an argument, computed client-side,
and only do the atomic append/update in SQL) — and either way, verifying it
against a live project, which this sandboxed run has no Supabase credentials
for (same blocker as item 29; see item 1 for how those get provisioned in a
run that has them).

**Resolved — took the "already-resolved frequency" option.** Added
`public.append_care_event(p_plant_id, p_care_type, p_care_date,
p_next_due_date, p_notes)` to [supabase/schema.sql](supabase/schema.sql): one
`security invoker` SQL function that prepends the new `care_history` entry
and updates the matching `care_schedules` entry's `lastCareDate`/
`nextDueDate` in a single `UPDATE`, computed from `jsonb_build_object`/
`jsonb_agg` over whatever the row holds at the moment that statement runs —
not from a value read earlier in JS. Two concurrent calls serialize on
Postgres's row lock for the `UPDATE`, so the second call's jsonb expressions
see the first call's already-committed result instead of overwriting it.
RLS still applies (`security invoker`, no explicit grant/revoke needed since
this one isn't security-sensitive like `claim_api_budget` — a plant id the
caller doesn't own just matches zero rows).

Didn't port the season/frequency logic into SQL: a schedule's configured
frequency (`frequencyDays` / `seasonalFrequency`) isn't itself touched by the
two-tabs race (only `lastCareDate`/`nextDueDate`/`care_history` are, and
those are exactly what the function now updates atomically), so there was no
need to duplicate [lib/seasonUtils.ts](lib/seasonUtils.ts) in two languages.
`storage.addCareEvent` ([lib/storage.ts](lib/storage.ts)) still does one
`getPlant` read first — only to find the schedule's type and resolve
`nextDueDate` client-side exactly as before, and to no-op when the plant
doesn't exist — then calls `supabase.rpc('append_care_event', ...)` instead
of building the full `care_history`/`care_schedules` arrays in JS and writing
them back with `updateCareData`, which is now dead code and removed along
with its `CareHistory` import.

Verified: `npx tsc --noEmit` clean, `npm run lint` clean, the 49-test vitest
suite (items 13/17) passes unchanged (none of it covered `storage.ts`, so
none of it could have caught a regression here either — see item 31), and
`npm run build` succeeds with dummy env vars. Not exercised against a live
Supabase project in this run (no credentials in this environment, same
constraint as items 1/29) — the function hasn't been run against the live
project's actual schema, and the two-tabs race it fixes can't be reproduced
without one. A follow-up run with real credentials should run
`supabase/schema.sql`'s new function in the live project and click through
marking care done from two browser tabs on the same plant before trusting
this further.

### 27. Sign-out had never been run against the live project

**Priority:** P2
**Status:** Fixed — 2026-09-01 (verification only, no code change)

The sign-out control only renders once a session has a real email
([app/account/page.tsx:34](app/account/page.tsx#L34)), so it could not be
reached while item 26 kept sign-up from ever completing. `signOut` and the
fresh-anonymous-account rebootstrap it triggers
([lib/auth-context.tsx:208](lib/auth-context.tsx#L208)) had therefore never
actually run.

Both now have. Signing out drops to a brand-new anonymous account whose
collection is empty — which also demonstrates the per-user RLS scoping — and
signing back in restores the previous account's plants.

### 28. A wrong confirmation code was reported as an expired one

**Priority:** P3
**Status:** Fixed — 2026-09-01

`friendlyMessage` tested for `expired` before its `invalid`+`token` branch
([lib/auth-context.tsx:53](lib/auth-context.tsx#L53)). Supabase answers both a
wrong code and a stale one with the same string, "Token has expired or is
invalid", so the first branch always won and the second was dead code — a
freshly mistyped code told the user it had expired and to send a new one.
Observed while testing item 26. Merged into one branch that does not claim to
know which of the two it was.

### 32. `next`'s bundled postcss stays vulnerable short of a major-version upgrade

**Priority:** P1
**Status:** Fixed — 2026-10-05

Split out of item 14, which closed today with the `npm audit fix` +
15.x-patch half of the fix. `next@15.5.25` (the latest 15.x release) still
vendors its own internal `postcss@8.4.31` in
`node_modules/next/node_modules/postcss`, isolated from this project's own
(already-patched) `postcss@8.5.28` dependency, so it doesn't move when our
own `postcss` version does. `npm audit fix --force` reports the only
available fix is `next@16.3.5`.

`next`'s own peer dependencies allow React 18.2+, so a React 19 migration
isn't forced by this alone, but a Next.js major version is still a real
migration (removed APIs, changed defaults, config changes) that needs its
own review of the Next 16 upgrade guide and a full click-through of the app
afterward — not something to force through as a side effect of a dependency
audit. Do that review, then take the major version bump deliberately.

**Resolved.** Reviewed the Next 15→16 migration guide first and checked each
breaking change against this codebase before touching anything:

- **Async request APIs** (`cookies()`/`headers()`/dynamic `params`) — already
  fully migrated (`lib/supabase/server.ts` already `await`s `cookies()`,
  `app/plants/[id]/page.tsx` already takes `params: Promise<...>` and unwraps
  it with `use()`). Nothing to change.
- **`middleware.ts` → `proxy.ts`** — still works in 16 but deprecated (a
  warning, not a hard error). Renamed the file and its exported function
  (`middleware` → `proxy`) anyway rather than leaving a deprecation warning
  in every request log; `lib/supabase/middleware.ts` (the helper it calls,
  a different file) didn't need renaming, just its doc comment pointing at
  the new filename, same for the matching comment in
  [lib/supabase/server.ts](lib/supabase/server.ts). Updated the project-tree
  entry in [README.md](README.md) to match.
- **Turbopack as the default bundler** — `next.config.js` has no custom
  `webpack()` config (confirmed by reading it — it's an empty
  `nextConfig = {}`), so there was nothing for Turbopack to silently ignore.
- **`next/image` `objectFit`/`objectPosition` prop removal** — every `<Image>`
  in the app already uses `fill` + a Tailwind `object-cover` class (item 19),
  never the deprecated style props. Nothing to change.
- **`revalidateTag`/`serverRuntimeConfig`/`publicRuntimeConfig`/AMP/etc.** —
  grepped for all of them; none are used anywhere in this codebase.
- **React 19** — confirmed via search that Next 16 still supports React
  18.2+ (deprecated, not removed; required starting in Next 17). Stayed on
  React 18 rather than bundling an unrelated React major-version migration
  into this change — `npm install` raised no peer-dependency conflict, which
  corroborates that.
- **`next lint` removal** — already moot; item 8 moved this project to the
  `eslint` CLI directly.

The one change that did need real work: **`eslint-config-next@16` requires
ESLint 9 and ships flat config only** — the legacy `.eslintrc.json` (added by
item 8 for `eslint@8`) stopped being read at all. Bumped `eslint` to `^9.0.0`
and `eslint-config-next` to `^16.3.5`, replaced `.eslintrc.json` +
`.eslintignore` with [eslint.config.mjs](eslint.config.mjs) spreading
`eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
(the flat-config equivalent of the old `extends` list, found by reading
`eslint-config-next`'s own `dist/*.js` directly rather than guessing).

That pulled in `eslint-plugin-react-hooks@7`, whose `recommended` config adds
a new `react-hooks/set-state-in-effect` rule that fired as an **error** (not
a warning) on `app/page.tsx`, `app/plants/page.tsx`, and
`app/plants/[id]/page.tsx` — all for the same shape: `setLoading(true)` /
`setLoadError(null)` called synchronously at the top of a data-fetching
effect, before the async call. That's the exact pattern React's own docs use
for fetch-in-an-effect (`setBio(null)` before `fetchBio(...).then(...)` in
the "You Might Not Need an Effect" page), not a bug in this codebase, so
rather than restructure three working effects to dodge a brand-new and
arguably over-eager default, turned the rule off in `eslint.config.mjs` with
a comment explaining why.

Also ran `next build` once with the new version to let it make its own
"mandatory" one-time `tsconfig.json` adjustments (`jsx: "preserve"` →
`"react-jsx"`, and `.next/dev/types/**/*.ts` added to `include`, both
Turbopack requirements) — confirmed stable across a second build with no
further changes, and that `tsc --noEmit` is still clean afterward.

Confirmed the fix actually fixes the thing this item is about:
`node_modules/next/node_modules/postcss` is now `8.5.23` (was `8.4.31`), and
`npm audit --omit=dev` reports 0 vulnerabilities (was 1).

Verified: `npx tsc --noEmit` clean, `npm run lint` clean (zero
warnings/errors — the only two findings surfaced by the new flat config and
plugin versions were addressed above, not suppressed-and-ignored), the
49-test vitest suite (items 13/17) passes unchanged, and `npm run build`
succeeds (now using Turbopack by default) with the same dummy env vars this
automation always uses. Not click-through-tested in a browser against a live
Supabase project in this run — no credentials or way to launch/screenshot a
dev server in this sandboxed environment, same constraint noted on nearly
every item since item 9. The `proxy.ts` rename in particular (the one change
on the request path for every page) is worth clicking through for real in a
run that has a browser, even though the build output does confirm it's
registered (`ƒ Proxy (Middleware)` in the route listing) and its logic is
byte-for-byte unchanged from the old `middleware.ts`.

### 31. Test coverage stops at `lib/careStatus.ts` / `lib/seasonUtils.ts`

**Priority:** P1
**Status:** Fixed — 2026-10-06

Split out of item 13, which closed today with a real vitest suite for the
two pure date/business-logic modules it named as the starting point. Nothing
else in the codebase has a test yet: `lib/storage.ts` (the `fail()`
error-wrapping behavior from item 7, `updateCareData` vs. `updatePlant`),
the zod validation added for item 9
([lib/plantAiSchema.ts](lib/plantAiSchema.ts) and the two API routes'
malformed-response handling), and `lib/auth-context.tsx`'s `friendlyMessage`
branching (item 28) are all realistic targets — they're logic-heavy and
don't require a browser. Component tests (React Testing Library) for
`AddPlantModal`/`EditPlantModal`/`AuthForm` are a separate, larger step this
item isn't scoping.

**Resolved — three of the four named targets.** Added:

- [lib/plantAiSchema.test.ts](lib/plantAiSchema.test.ts): `plantAiResponseSchema`
  accepts a well-formed AI response, defaults `scientificName`/`careNotes`
  when omitted, and rejects a response missing a season key, a stringified
  number where a number is required, a missing `name`, or a missing care
  category — the exact malformed shapes item 9 added validation to catch.
- [lib/storage.test.ts](lib/storage.test.ts): mocks `@/lib/supabase/client`
  with a small chainable/thenable query-builder fake (matching how the real
  `PostgrestFilterBuilder` is awaited directly, with or without a terminal
  `.single()`/`.maybeSingle()`) and covers every method — `getPlants`/
  `getPlant`'s row-mapping and `fail()`-wrapped errors (item 7), the
  not-found-vs-error distinction `getPlant` has to preserve, `addPlant`'s
  signed-in-user check, `updatePlant`/`deletePlant`'s success/failure paths,
  and `addCareEvent`'s `nextDueDate` computation — frequencyDays, the
  frequency-0 winter-skip (item 2), the seasonal-frequency branch including
  northern vs. southern hemisphere (item 17), a plant with no matching
  schedule, the no-op when the plant doesn't exist, and the `append_care_event`
  rpc failure path (item 30, since `updateCareData` no longer exists —
  superseded by the rpc call before this item got picked up).
- [lib/auth-context.test.ts](lib/auth-context.test.ts): table-drives
  `friendlyMessage` across every branch, including the expired/invalid-token
  case item 28 fixed (both a wrong and a stale code map to the same message,
  deliberately not claiming to know which), case-insensitivity, and the
  generic fallback's `console.warn`. Exported `friendlyMessage` from
  [lib/auth-context.tsx](lib/auth-context.tsx) (previously module-private)
  since it's pure branching logic with no reason to hide it from a test file
  in the same package.

37 new tests, 86 total, all passing. Deliberately not done: the two API
routes' malformed-response handling end-to-end (would need mocking the
`openai` client and `NextRequest`/`guard` — heavier scaffolding than the
pure-function targets above, and `plantAiResponseSchema`'s own tests already
cover the validation logic those routes just call) and the component tests
this item already scoped out. See item 33 for what's left.

Verified: `npx tsc --noEmit` clean, `npm run lint` clean (zero
warnings/errors), `npm run test` 86/86 passing (up from 49), and `npm run
build` succeeds with the same dummy env vars this automation always uses.

### 33. Remaining test-coverage gaps after item 31

**Priority:** P2
**Status:** Fixed — 2026-10-07

Item 31 covered `lib/plantAiSchema.ts`, `lib/storage.ts`, and
`lib/auth-context.tsx`'s `friendlyMessage`. Still untested:

- `app/api/search-plant/route.ts` / `app/api/identify-plant/route.ts`'s
  malformed-response handling end-to-end (the JSON-parse-then-regex-fallback
  step, the 502 on a failed `safeParse`, the 413/400/500 error paths) — needs
  mocking the `openai` client and Next's `NextRequest`/`guard` from
  `lib/api-guard.ts`.
- `lib/api-guard.ts` itself (the per-user/per-IP rate limiting item 18's
  401/429 paths depend on).
- Component tests (React Testing Library) for `AddPlantModal`,
  `EditPlantModal`, and `AuthForm`'s multi-step sign-up/reset flows — not
  scoped by item 31 either, and would need `@testing-library/react` (and
  probably `jsdom`) added as new dependencies.

**Resolved — the `lib/api-guard.ts` gap.** Added
[lib/api-guard.test.ts](lib/api-guard.test.ts), mocking both
`@/lib/supabase/server` (for `requireUser`'s `auth.getUser()`) and
`@supabase/supabase-js` (for the service-role `usageStore` the durable
rate-limit path uses), with `NEXT_PUBLIC_SUPABASE_URL` /
`SUPABASE_SERVICE_ROLE_KEY` / `TRUSTED_PROXY_HOPS` stubbed via `vi.stubEnv`
before the module import, since all three are read once at module scope.
Covers `requireUser`'s null/error/success paths, the in-memory `rateLimited`
fallback (per-key independence and the max-then-refuse boundary), and
`guard()`'s 401 (no session, never checks the budget), 200 (under budget),
429 (durable store reports the budget spent), per-user-plus-per-address
bucket construction from a trusted `x-forwarded-for`, and the fallback to
the in-memory limiter when the durable `claim_api_budget` rpc call throws.
10 new tests, 96 total, all passing.

Deliberately not done in this pass: the two API routes' end-to-end
malformed-response handling and the component tests — both still need real
scaffolding (`openai` client mocks, `@testing-library/react` + `jsdom` as new
dependencies) and are tracked on as item 34 rather than folded into this one.

Verified: `npx tsc --noEmit` clean, `npm run lint` clean (zero
warnings/errors), `npm run test` 96/96 passing (up from 86), and `npm run
build` succeeds with the same dummy env vars this automation always uses.

### 34. Test-coverage gaps still open after item 33: API route handlers and component tests

**Priority:** P2
**Status:** Fixed — 2026-10-08

Split out of item 33, which closed today with `lib/api-guard.ts` covered.
Two gaps remain, both needing real scaffolding rather than a quick mock:

- `app/api/search-plant/route.ts` / `app/api/identify-plant/route.ts`'s
  end-to-end handling — the JSON-parse-then-regex-fallback step, the 502 on
  a failed `plantAiResponseSchema.safeParse` (item 9), and the
  401/413/400/429/500 error paths through `lib/api-guard.ts`'s `guard()`.
  Needs mocking the `openai` SDK's `chat.completions.create` and
  constructing a real `Request`/`NextRequest` for each route to handle.
- Component tests (React Testing Library) for `AddPlantModal`,
  `EditPlantModal`, and `AuthForm`'s multi-step sign-up/confirm/reset flows.
  Needs `@testing-library/react` and `jsdom` (or similar) added as new
  dev dependencies, plus a `vitest.config.ts` environment switch (or a
  second project) since the existing suite runs under `environment: 'node'`.

**Resolved — the API route handler half.** Added
[app/api/search-plant/route.test.ts](app/api/search-plant/route.test.ts) and
[app/api/identify-plant/route.test.ts](app/api/identify-plant/route.test.ts),
mocking the `openai` package's default export (a class whose
`chat.completions.create` is a shared `vi.fn()`) and `@/lib/api-guard`'s
`guard` function — no new dependency needed, since both are mocked the same
way `lib/storage.test.ts` and `lib/api-guard.test.ts` already mock
`@/lib/supabase/client`/`@/lib/supabase/server`. A plain `Request` (not
`NextRequest`) is enough to drive each `POST` handler, matching how
`lib/api-guard.test.ts` already calls `guard()` with one — the handlers only
ever call `.json()` and, for `identify-plant`, `.headers.get('content-length')`.

Each file covers: the guard's 401/429 responses passed through unchanged
(and that `openai` is never called when guard refuses), 400 on a missing
`query`/`image`, 500 on a missing `OPENAI_API_KEY`, 200 with the validated
data on a well-formed model response, the regex-fallback extracting JSON
from a response with surrounding prose, 502 on a `plantAiResponseSchema`
failure (item 9), 500 when there's no JSON to find at all, and 500 when the
`openai` call itself throws. `identify-plant` additionally covers its 413
oversized-body path — building a real `Request` with an explicit
`content-length` header sized to a 9 MB body, since Node's `fetch`/`Request`
does not auto-populate that header from the body the way a browser or a real
HTTP server would.

19 new tests, 115 total, all passing.

Deliberately not done in this pass: the component tests for `AddPlantModal`/
`EditPlantModal`/`AuthForm`, which still need `@testing-library/react` +
`jsdom` as new dependencies and a `vitest.config.ts` environment change —
tracked as item 35 rather than folded into this one.

Verified: `npx tsc --noEmit` clean, `npm run lint` clean (zero
warnings/errors), `npm run test` 115/115 passing (up from 96), and `npm run
build` succeeds with the same dummy env vars this automation always uses.

### 35. Component tests still missing: `AddPlantModal`, `EditPlantModal`, `AuthForm`

**Priority:** P2
**Status:** Open

Split out of item 34, which closed today with the API route handler tests.
The remaining gap is React component tests for `AddPlantModal`,
`EditPlantModal`, and `AuthForm`'s multi-step sign-up/confirm/reset flows
([components/AddPlantModal.tsx](components/AddPlantModal.tsx),
[components/EditPlantModal.tsx](components/EditPlantModal.tsx),
[components/AuthForm.tsx](components/AuthForm.tsx)) — none of it is covered
today.

Unlike every other test file in the repo, this needs new dev dependencies
(`@testing-library/react`, `@testing-library/user-event`, and a DOM
environment such as `jsdom` or `happy-dom`) plus a `vitest.config.ts` change,
since the existing suite runs under `environment: 'node'` (no `document`).
Vitest supports per-file environment overrides via a `// @vitest-environment
jsdom` docblock, so this likely doesn't need a second project/config block —
just the new dependencies and one `environment: 'jsdom'` comment per new test
file.
