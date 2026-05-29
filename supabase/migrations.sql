-- ============================================================================
-- BonusTrak — Supabase migrations
-- ============================================================================
--
-- HOW TO APPLY (manual — this project applies migrations BY HAND):
--   1. Open the Supabase dashboard -> SQL Editor -> New query.
--   2. Paste the SQL for any migration(s) not yet applied to this environment.
--   3. Run it. Expected result: "Success. No rows returned."
--
-- This file is the CANONICAL SCHEMA and the source of truth for the database.
-- Migrations are append-only and ordered: when you change the DB, add a new
-- migration at the BOTTOM (never edit one that has already been applied) so
-- this file always reflects the live schema.
--
-- ----------------------------------------------------------------------------
-- HOW TO ADD A NEW MIGRATION:
--   - Copy the template block below to the END of this file.
--   - Give it the next sequential number, a short snake_case name, and the date.
--   - Prefer idempotent SQL (e.g. `if not exists`) so re-running by hand is safe.
--
--   -- ------------------------------------------------------------------------
--   -- Migration: NNN — <short_snake_case_name>
--   -- Date: YYYY-MM-DD
--   -- Why: <one line on what this changes and why>
--   -- ------------------------------------------------------------------------
--   <your SQL here>
--
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Migration: 001 — create_user_data
-- Date: 2026-05-29
-- Why: BonusTrak persistence. One row per authenticated user holding that
--      user's entire AppData envelope (goal + entries + timeOff) as a single
--      JSON blob, plus their pace_mode.
-- ----------------------------------------------------------------------------

-- One row per user. user_id is both PK and FK to Supabase's auth.users;
-- ON DELETE CASCADE removes a user's data if their auth account is deleted.
create table user_data (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{"goal":null,"entries":[],"timeOff":[]}',
  pace_mode  text  not null default 'trailing',
  updated_at timestamptz not null default now()
);

-- Row-Level Security: the database itself enforces that a logged-in user can
-- only read/write their OWN row. This is why shipping the client (publishable)
-- key in the browser is safe.
alter table user_data enable row level security;

create policy "own row" on user_data
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ----------------------------------------------------------------------------
-- Migration: 002 — decouple_logins_from_users
-- Date: 2026-05-29
-- Why: Support Google OAuth + "many logins → one person". Drop the auth-coupled
--      user_data table; a `users` row owns the data, reached via one or more
--      `logins` rows that map Supabase auth identities to that user. Existing
--      data is DISCARDED (no migration), per the approved design.
--
--      Two concepts, named to match the real scenario:
--        users  — the PERSON whose hours are tracked (e.g. my wife). Owns data.
--        logins — a WAY TO SIGN IN (e.g. my Google email). Auth & access only.
--      Supabase's built-in credential table is auth.users; our public.users (the
--      person) is distinct, so logins references the credential via auth_user_id.
--
-- Rerunnable: drops the new tables/policies first so a partial dashboard run can
-- be re-applied cleanly.
-- ----------------------------------------------------------------------------

drop table if exists user_data;
drop table if exists logins;
drop table if exists users;

-- The person whose hours are tracked. Owns the data. (e.g. my wife)
create table users (
  id         uuid primary key default gen_random_uuid(),
  name       text,                       -- optional, admin-facing label for the person
  data       jsonb not null default '{"goal":null,"entries":[],"timeOff":[]}',
  pace_mode  text  not null default 'trailing',
  updated_at timestamptz not null default now()
);

-- A login that can access a user's data. Auth & access only. (e.g. my Google email)
-- One row per Supabase auth identity; many logins may map to the same user.
create table logins (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  user_id      uuid not null references users(id)         on delete cascade,
  created_at   timestamptz not null default now()
);

alter table users  enable row level security;
alter table logins enable row level security;

-- users: a signed-in login can touch a user row only if one of its logins maps to it.
drop policy if exists "login can access its user" on users;
create policy "login can access its user" on users for all
  using      ( id in (select user_id from logins where auth_user_id = auth.uid()) )
  with check ( id in (select user_id from logins where auth_user_id = auth.uid()) );

-- logins: a signed-in login can read its OWN mapping row (to resolve its user_id).
drop policy if exists "own login row" on logins;
create policy "own login row" on logins for select
  using ( auth_user_id = auth.uid() );

-- The logins table has NO insert/update/delete policy for end users — only the
-- admin (via the dashboard, which bypasses RLS) writes it. That is what enforces
-- admin-only linking. Signing in with Google always succeeds and creates an
-- auth.users row, but grants NO data access until a logins mapping exists
-- (RLS returns no rows). "Unlinked = no access" replaces the old "sign-ups
-- disabled" gate, so the Supabase Google provider should be enabled and allowed
-- to create new auth identities.

-- ----------------------------------------------------------------------------
-- ADMIN RUNBOOK (Supabase dashboard, by hand)
--
--   1. Provision a person:
--        insert into users (name) values ('Wife');   -- note the returned id
--
--   2. Create the login: have the person's manager sign in with Google ONCE
--      (this creates the auth.users row). Find that auth identity — and VERIFY
--      it is the right one before linking:
--        select id, email, created_at from auth.users order by created_at desc;
--
--   3. Link them:
--        insert into logins (auth_user_id, user_id)
--        values ('<auth.users.id>', '<users.id>');
--
--   4. Add another login to the same person: have the second login sign in with
--      Google, then insert another logins row pointing at the SAME user_id.
--
--   Until step 3, the signed-in login sees the "contact the admin" screen.
-- ----------------------------------------------------------------------------
