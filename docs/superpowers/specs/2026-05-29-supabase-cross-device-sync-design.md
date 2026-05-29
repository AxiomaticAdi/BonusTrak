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
| Sync freshness | **Fetch on open + on window focus**; debounced writes via a named `SAVE_DEBOUNCE_MS` constant. No real-time subscriptions |
| Offline edits | **Allowed**; the pending save retries and **syncs on reconnect**. A dirty-guard stops the reconnect/focus refetch from clobbering unsaved edits. Not a durable queue — edits are lost if the tab is closed while still offline |
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
          └─ app (page.tsx, dashboard — unchanged; settings gains a hydration gate)
```

### Files touched

- `lib/supabase.ts` — **new.** Browser Supabase client from env vars.
- `lib/store.tsx` — **rewritten internals**; `StoreValue` adds `online: boolean`.
- `components/auth/` — **new.** `SupabaseProvider`, `AuthGate`, login screen.
- `components/offline-indicator.tsx` — **new.** Offline banner.
- `components/settings/settings-content.tsx` — **new.** Client wrapper gating the
  settings sections on `hydrated`.
- `app/settings/page.tsx` — render `SettingsContent` instead of the sections directly.
- `app/layout.tsx` — wrap children in `SupabaseProvider` + `AuthGate`; mount `OfflineIndicator`.
- `CLAUDE.md` — update the "no backend / browser is the only source of truth" section.

No sign-out control in this scope (sessions persist; revoke via Supabase dashboard if ever needed).

## Auth flow (magic link)

1. Unauthenticated user sees a single login screen: email input → "Send magic link".
   The call passes `shouldCreateUser: false` so a typo'd / unknown email cannot
   silently create an account (code-level enforcement on top of the dashboard
   "disable sign-ups" setting).
2. Supabase emails a sign-in link. Clicking it returns to the app with a session.
   The Supabase client uses `detectSessionInUrl: true` to complete the exchange.
   **Caveat:** the default PKCE flow requires the link to be opened in the *same
   browser* that requested it (the code verifier is stored client-side). This is
   verified in the plan; if cross-browser link opening is needed, switch the
   client to `flowType: 'implicit'` or add an `/auth/confirm` route.
3. `SupabaseProvider` subscribes to `onAuthStateChange` and holds the session.
4. `AuthGate` renders:
   - **loading** while the initial session resolves,
   - **login screen** when signed out,
   - **the app** when signed in.
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
stay **identical**, with one added field `online: boolean`.

Internal changes:

- **Load (on mount and whenever the user id changes):**
  `select data, pace_mode from user_data where user_id = <me>` via `maybeSingle()`.
  - If no row exists, `insert` a default row. If the insert hits a duplicate-key
    error (another tab inserted concurrently), **reselect** the row rather than
    treating it as an empty load.
  - Populate state, then set `hydrated = true` (now means "loaded from server").
  - **Load sequencing:** an incrementing `loadId` ref ignores stale responses when
    loads overlap (mount/focus/visibility/reconnect).
  - **Dirty-guard:** load is skipped while there are unsaved local edits, so a
    refetch never clobbers in-flight changes.
- **Focus refetch:** `focus` / `visibilitychange` listeners re-run the load
  (subject to the dirty-guard) so another device's changes appear on refocus.
- **Save:** the persist `useEffect` becomes a **debounced `upsert`** of the whole
  `data` blob keyed by `user_id`. The delay is a named module constant
  `SAVE_DEBOUNCE_MS` (default 600). The save always sends the **latest** `data`
  (read through a ref) so a retry can never resurrect a stale blob over a newer
  one; failures retry up to `MAX_SAVE_RETRIES`, then surface a toast. A `dirtyRef`
  is set on user mutation and cleared on successful save; an `applyingServerRef`
  flag stops the load's `setData` from triggering a spurious save back.
- **`pace_mode`** is saved with `update().eq("user_id", …)` (not a partial upsert),
  since the row exists post-hydration — avoids any chance of touching `data`.
- **Reconnect:** the `online` listener flushes the pending save if dirty (syncing
  offline edits), otherwise reloads.
- `genId()` is unchanged — client-generated IDs are fine inside a JSON blob.
- All `localStorage` reads/writes and the `STORAGE_KEY` / `PACE_KEY` constants
  are **deleted**.

### Consumer change required (correction to the earlier "no consumer changes" claim)

The store's public interface is unchanged except for the added `online`, but **one
consumer area needs a hydration gate**: the settings sections (`GoalSection`,
`TimeOffSection`, `HoursLogSection`) seed form state / render lists from `data` at
mount with no `hydrated` guard, unlike `DashboardView` which guards correctly. With
async server loading, a hard refresh directly to `/settings` would show defaults
before the load resolves and could overwrite real data on save. Fix: a small client
wrapper gating the settings sections on `hydrated` (mirrors the dashboard skeleton).
No other consumers change.

## Loading / error / offline states

The one genuinely new surface, since the network can be slow or fail:

- **Loading:** `hydrated === false` shows a spinner. The existing
  "wait for hydrated before reading" guards already cover this; they now wait on
  the server fetch instead of the synchronous localStorage read.
- **Save failure:** a failed debounced upsert retries up to `MAX_SAVE_RETRIES`,
  then surfaces a Sonner toast. The `Toaster` is already mounted in `app/layout.tsx`.
- **Offline:** edits are still allowed and held in memory. A non-blocking banner
  reads "Offline — changes will sync when you reconnect." On reconnect the pending
  save flushes (dirty-guard prevents the reconnect refetch from clobbering it).
  This is **not** a durable queue: edits are lost if the tab is closed while still
  offline.

## Config & deployment

- Env vars (both public — the anon key is safe client-side because RLS enforces
  access). **Already set up** in `.env.local` (gitignored, untracked):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (holds a `sb_publishable_…` key — Supabase's
    newer client-side key; equivalent to the legacy `anon` JWT for this var)
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
7. Offline → banner appears, edits still work, and changes sync on reconnect
   without clobbering; no crash.

## Out of scope (YAGNI)

- **Durable** offline queue (edits survive only while the tab stays open; in-memory
  retry + sync-on-reconnect is in scope, a persisted queue is not).
- Real-time subscriptions (live multi-session sync).
- Public self-service sign-up.
- Normalized per-entity tables / field-level conflict resolution.
- Migrating existing localStorage data into accounts.
