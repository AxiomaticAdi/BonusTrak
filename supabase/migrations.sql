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
