# BonusTrak — Cross-Device Sync via Supabase

**Date:** 2026-05-29
**Status:** Approved design, ready for implementation planning

## Problem

BonusTrak currently persists all state in the browser's `localStorage`
(`bonustrak:data:v1`, `bonustrak:paceMode:v1`). This is per-browser and
per-device: data logged on a phone never appears on a laptop. We want
**cross-device sync** so a single user sees the same data everywhere they sign in.

## Decisions (locked)

| Decision | Choice |
|----------|--------|
| Backend/auth platform | **Supabase** (Postgres + Auth + RLS, client-side JS SDK) |
| Auth method | **Magic link** (passwordless email) |
| Existing localStorage data | **Discard.** Server is sole source of truth; remove all localStorage code |
| Data shape | **One JSON blob per user** (whole `AppData` in a `jsonb` column); whole-blob last-write-wins |
| Sync freshness | **Fetch on open + on window focus**; debounced writes. No real-time subscriptions |
| Offline writes | **Out of scope.** Offline = read-only/stale with an indicator |
| User onboarding | **No public sign-up.** Two users created manually in the Supabase dashboard; public sign-ups disabled |

## Architecture

The app stays **client-rendered with a React Context store**. The Supabase
browser client runs as the signed-in user; Row-Level Security guarantees each
user only reads/writes their own row. No Next.js API routes or other server code.

Two distinct layers (kept deliberately separate to avoid the earlier confusion):

- **Durable storage** = Supabase Postgres (the real source of truth).
- **In-memory working copy** = the existing React Context store, held in browser
  RAM only while the app is open; the UI renders from it. Wiped on tab close.

```
Supabase (server) ──── durable storage (source of truth)
   │  fetch on open/focus           ▲  debounced upsert on change
   ▼                                │
React Context store (browser RAM) ──┘   in-memory working copy
   │
   ▼
Dashboard / settings UI render from it
```

### Component tree

```
SupabaseProvider (holds auth session, onAuthStateChange)   ← new
  └─ AuthGate (loading / login screen / app)               ← new
      └─ StoreProvider (rewritten internals, same interface) ← changed
          └─ app (page.tsx, dashboard, settings — unchanged)
```

### Files touched

- `lib/supabase.ts` — **new.** Browser Supabase client from env vars.
- `lib/store.tsx` — **rewritten internals**, `StoreValue` interface unchanged.
- `components/auth/` (or similar) — **new.** `SupabaseProvider`, `AuthGate`, login screen.
- `app/layout.tsx` — wrap children in `SupabaseProvider` + `AuthGate`.
- Settings (or header) — add a **Sign out** control.
- `CLAUDE.md` — update the "no backend / browser is the only source of truth" section.

## Auth flow (magic link)

1. Unauthenticated user sees a single login screen: email input → "Send magic link".
2. Supabase emails a sign-in link. Clicking it returns to the app with a session.
3. `SupabaseProvider` subscribes to `onAuthStateChange` and holds the session.
4. `AuthGate` renders:
   - **loading** while the initial session resolves,
   - **login screen** when signed out,
   - **the app** when signed in.
5. Sign-out control calls `supabase.auth.signOut()`.

**Onboarding / access control:** In Supabase Auth settings, **disable new
sign-ups**. Create the two users manually in the dashboard. A magic link only
succeeds for an existing account, so no one else can self-onboard.

## Data layer

Single table:

```sql
create table user_data (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{"goal":null,"entries":[],"timeOff":[]}',
  pace_mode  text  not null default 'trailing',
  updated_at timestamptz not null default now()
);

alter table user_data enable row level security;

create policy "own row" on user_data
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

- The entire `AppData` envelope (`goal`, `entries`, `timeOff`) is stored verbatim
  in `data` — no domain-type migration, the `lib/types.ts` shapes are unchanged.
- `pace_mode` is a dedicated column (it was a separate localStorage key before).
- `updated_at` is maintained on write (informational; not used for conflict
  resolution since the policy is whole-blob last-write-wins).

## Store rewrite (`lib/store.tsx`)

`StoreValue` and all mutation signatures (`setGoal`, `addEntry`, `updateEntry`,
`deleteEntry`, `addTimeOff`, `updateTimeOff`, `deleteTimeOff`, `setPaceMode`)
stay **identical** — no consumer changes anywhere.

Internal changes:

- **Load (on mount and whenever the user id changes):**
  `select data, pace_mode from user_data where user_id = <me>`.
  - If no row exists (freshly created user), `insert` a default row first.
  - Populate state, then set `hydrated = true` (now means "loaded from server").
- **Focus refetch:** add `focus` / `visibilitychange` listeners that re-run the
  load so another device's changes appear when the tab regains focus.
- **Save:** the existing persist `useEffect` becomes a **debounced `upsert`**
  (~500–800 ms) of the whole `data` blob keyed by `user_id`, replacing the
  localStorage write. `pace_mode` upserts on change as well.
- `genId()` is unchanged — client-generated IDs are fine inside a JSON blob.
- All `localStorage` reads/writes and the `STORAGE_KEY` / `PACE_KEY` constants
  are **deleted**.

## Loading / error / offline states

The one genuinely new surface, since the network can be slow or fail:

- **Loading:** `hydrated === false` shows a spinner. The existing
  "wait for hydrated before reading" guards already cover this; they now wait on
  the server fetch instead of the synchronous localStorage read.
- **Save failure:** a failed debounced upsert surfaces a Sonner toast
  ("Couldn't save — retrying") and retries. The `Toaster` is already mounted in
  `app/layout.tsx`.
- **Offline:** with localStorage gone, offline means read-only/stale. Show a
  non-blocking "offline" indicator. **No offline write queue** (explicitly out of
  scope).

## Config & deployment

- Env vars (both public — the anon key is safe client-side because RLS enforces
  access):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Add dependency: `@supabase/supabase-js`.
  (`@supabase/ssr` is **not** needed for this client-only design.)
- Supabase dashboard:
  - Enable email (magic-link) auth.
  - **Disable** new public sign-ups.
  - Set magic-link redirect URLs for dev (`http://localhost:3000`) and prod origins.
  - Create the two user accounts manually.

## Testing / verification

No test suite exists today; none will be scaffolded for this change. Verification
is manual (can be driven with the browser tool):

1. Request a magic link for a pre-created user → sign in succeeds.
2. Magic link for a non-existent email → no access (sign-ups disabled).
3. Add an hours entry on browser A.
4. Open browser B (same account), focus the tab → the entry appears.
5. Change pace mode on A, refocus B → reflected.
6. Sign out / sign back in → data persists.
7. Offline → app is read-only/stale with the indicator, no crash.

## Out of scope (YAGNI)

- Offline write queue / local caching fallback.
- Real-time subscriptions (live multi-session sync).
- Public self-service sign-up.
- Normalized per-entity tables / field-level conflict resolution.
- Migrating existing localStorage data into accounts.
