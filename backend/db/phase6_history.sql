-- =============================================================================
-- Phase 6 — hand history + analytics.
--
-- Reshapes the `hands` table so it can be written without Supabase Auth (the
-- frontend supplies its own anon UUID per browser from localStorage). Phase 7
-- will re-introduce auth + RLS on top of this.
--
-- Safe to re-run: every change is `if (not) exists` / `or replace`.
-- Paste into the Supabase SQL editor.
-- =============================================================================

-- Drop the FK to profiles so user_id can be any UUID (anonymous browser ID).
-- profiles itself is left intact — Phase 7 will use it again.
alter table hands
    drop constraint if exists hands_user_id_fkey;

-- Add columns we need for analytics. All nullable / defaulted so existing
-- rows survive.
alter table hands
    add column if not exists difficulty            text not null default 'home-game',
    add column if not exists hero_starting_chips   numeric not null default 0,
    add column if not exists hero_ending_chips     numeric not null default 0,
    add column if not exists won                   boolean not null default false,
    add column if not exists went_to_showdown      boolean not null default false,
    add column if not exists street_reached        text not null default 'preflop'
        check (street_reached in ('preflop','flop','turn','river','showdown')),
    add column if not exists opponents             jsonb not null default '[]',
    add column if not exists winners               jsonb not null default '[]',
    add column if not exists actions               jsonb not null default '[]';

-- Allow table size down to 2 (busted seats can shrink the table in-session).
alter table hands
    drop constraint if exists hands_table_size_check,
    add  constraint hands_table_size_check check (table_size between 2 and 9);

-- Hot path: "give me this user's last N hands".
create index if not exists hands_user_created_idx
    on hands (user_id, created_at desc);

-- Disable RLS for the anon-user model. The backend uses the service-role key,
-- so we don't expose the table to the public anon key. Phase 7 will re-enable
-- RLS once auth.uid() is meaningful again.
alter table hands   disable row level security;
alter table actions disable row level security;

-- The Phase 3 actions table can stay; we keep all per-action detail inside
-- hands.actions (jsonb) for analytics simplicity. If/when we want SQL-level
-- analytics over actions, we can backfill the table from the jsonb.
