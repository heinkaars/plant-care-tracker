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

**Status:** Blocked — needs a real Supabase project's URL/anon key — cannot be obtained without user input

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

**Status:** Open

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

**Status:** Open

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

**Status:** Open

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

**Status:** Open

[components/AddPlantModal.tsx:86](components/AddPlantModal.tsx#L86) reads the
camera file straight to base64 — no size check, no resize, no compression —
then both ships it to OpenAI Vision and stores it raw in a Postgres `text`
column ([supabase/schema.sql:16](supabase/schema.sql#L16)).

A 5–10 MB phone photo means bloated rows, slow list queries (`storage.getPlants`
does `select *`, pulling every photo to render a grid), and inflated
per-request OpenAI cost. App Router route handlers have no default body-size
limit, so `/api/identify-plant` will forward an arbitrarily large image on
your key — the rate limiter in `lib/api-guard.ts` caps call count, not payload.

- Resize/compress client-side to a sane max edge before upload.
- Move photos to Supabase Storage and keep a URL in the row.
- Select explicit columns in list views so photos aren't fetched for the grid.
- Reject oversized bodies at the route boundary.

---

## P1 — High

### 7. Storage failures are invisible to the user

**Status:** Open

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

### 8. No ESLint configuration exists

**Status:** Open

There is no `.eslintrc*` or `eslint.config.*` in the repo. `npm run lint`
drops into `next lint`'s interactive "How would you like to configure
ESLint?" prompt — it has never actually run against this codebase, and it
will hang any non-interactive caller.

This also blocks item 22: a CI job that runs lint cannot pass until this is
fixed. `next lint` is deprecated in Next 15 and removed in 16, so configure
the ESLint CLI directly rather than reviving it.

### 9. AI responses are parsed but never validated, and use a legacy model

**Status:** Open

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

### 10. `addCareEvent` is a read-modify-write of the whole row

**Status:** Open

[lib/storage.ts:132](lib/storage.ts#L132) fetches the plant, mutates the
history and schedule in JS, then writes every column back — photo included.
Two tabs marking care on the same plant lose one of the two events, and each
care event round-trips the full base64 photo in both directions.

Move the mutation into a Postgres function, or at minimum update only the
`care_schedules` and `care_history` columns.

### 11. Password reset is implemented but unreachable

**Status:** Open

`requestPasswordReset` and `resetPassword`
([lib/auth-context.tsx:185](lib/auth-context.tsx#L185)) are fully written and
exposed on the context, but no component calls them —
[components/AuthForm.tsx](components/AuthForm.tsx) offers only sign-up and
sign-in. A user who forgets their password has no recovery path in the UI.

Either wire a reset flow into `AuthForm` / `/account`, or drop the dead code.

### 12. No way to edit a plant

**Status:** Open

The README advertises "Add, edit, and remove plants from your collection".
There is no edit UI — `storage.updatePlant` exists but is only ever called
internally by `addCareEvent`. Name, notes, photo, and frequencies are all
fixed at creation, which is a problem given item 3 seeds them wrong.

### 13. No tests

**Status:** Open

[lib/careStatus.ts](lib/careStatus.ts) and [lib/seasonUtils.ts](lib/seasonUtils.ts)
are pure, date-driven business logic — season boundaries, overdue vs. due-soon
thresholds, dashboard aggregation. Cheap to unit test, easy to break silently.
Start here; items 2 and 3 are both exactly the kind of bug a table-driven test
over the four seasons would have caught.

### 14. Dependency vulnerabilities

**Status:** Open

`npm audit --omit=dev` reports **5 high-severity advisories**: `sharp` <0.35.0
inheriting four libvips CVEs, and two `postcss` source-map path-traversal
advisories via `next`. Both are fixable with `npm audit fix`.

Separately, `next` is on 15.5.12 with 15.5.24 available — worth taking the
patch releases at the same time.

### 15. Stray files in the working tree

**Status:** Open

`plant-care-tracker-auth-kit.zip` (28 KB) and `Plant-Care.code-workspace` sit
untracked in the repo root. The zip is unvetted — confirm it holds no
credentials, then delete it or add both to `.gitignore`.

---

## P2 — Medium

### 16. Native `confirm()` / `prompt()` for destructive and data-entry actions

**Status:** Open

Plant deletion uses `confirm()` ([plants/page.tsx:43](app/plants/page.tsx#L43),
[plants/[id]/page.tsx:41](app/plants/[id]/page.tsx#L41)) and care notes use
`prompt()` ([plants/[id]/page.tsx:35](app/plants/[id]/page.tsx#L35)). Blocking,
unstyled, poor on mobile, and inconsistent with the rest of the UI.

### 17. Hemisphere is hardcoded to northern

**Status:** Open

[lib/seasonUtils.ts:10](lib/seasonUtils.ts#L10) accepts a `hemisphere`
argument but every caller uses the default — `getSeasonalFrequency` calls
`getCurrentSeason(date)` with no passthrough
([seasonUtils.ts:54](lib/seasonUtils.ts#L54)), so the parameter is
unreachable from the app. Southern-hemisphere users get inverted seasonal
care schedules. Needs a user setting threaded through `getSeasonalFrequency`.

### 18. Every AI failure blames the user's API key

**Status:** Open

[components/AddPlantModal.tsx:79](components/AddPlantModal.tsx#L79) and
[:133](components/AddPlantModal.tsx#L133) render "Please check your API key in
.env.local" for any non-OK response — including the guard's 401 ("Sign in
required") and 429 ("Too many requests") from
[lib/api-guard.ts](lib/api-guard.ts). Wrong advice for the two cases a real
user is most likely to hit, and it leaks a dev-only detail into the product.

Read `error` off the response body and show that instead.

### 19. Plain `<img>` instead of `next/image`

**Status:** Open

Used on the dashboard, collection, and detail pages — no lazy loading or
optimization. Relatedly, `images.domains` in `next.config.js` is dead config,
since nothing uses `next/image` at all (and `domains` is itself deprecated in
favour of `remotePatterns`).

### 20. Dangling reference to a `MIGRATION.md` that doesn't exist

**Status:** Open

[lib/storage.ts:9](lib/storage.ts#L9) points readers at "MIGRATION.md for the
exact diffs in page.tsx, plants/page.tsx, and plants/[id]/page.tsx". No such
file is in the repo. Either write it or drop the reference — and see item 4,
which has the same problem pointing at the README.

### 21. Dead code: discarded client-side plant id

**Status:** Open

[components/AddPlantModal.tsx:142](components/AddPlantModal.tsx#L142) generates
an `id` that `storage.addPlant` silently ignores — Supabase generates the real
one. A leftover from the localStorage era that misleads on first read.

---

## P3 — Low / polish

### 22. No CI

**Status:** Open

Nothing runs lint, typecheck, or build on push. A GitHub Action covering all
three would have caught the unwired-auth gap indirectly and guards the tests
from item 13. Note it needs item 8 resolved first — there is no lint config to
run today.

### 23. No error boundary

**Status:** Open

An uncaught render error blanks the page with no recovery path.

### 24. Loading states are bare text

**Status:** Open

Every page renders `Loading...` centered on an empty screen. Skeletons
matching the eventual layout would reduce the jolt.

### 25. Documentation is out of date as of `694dbad`

**Status:** Open

Both [README.md](README.md) and [SETUP.md](SETUP.md) still describe
LocalStorage as the storage layer and omit Supabase entirely:

- README lists "Data Storage: Local Storage (browser-based)" in the tech
  stack, documents only `OPENAI_API_KEY`, and its project-structure tree omits
  `lib/supabase/`, `middleware.ts`, `lib/api-guard.ts`, and `supabase/schema.sql`.
- SETUP claims "No account or backend required", and its "Data Not Persisting?"
  troubleshooting section now gives actively wrong advice (it tells users to
  check that LocalStorage is enabled).
- README's "Future Enhancements" list opens with "Backend database for data
  sync across devices" — which is what `694dbad` actually did.
