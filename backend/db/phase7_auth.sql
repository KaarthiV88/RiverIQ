-- =============================================================================
-- Phase 7 — Supabase Auth integration.
--
-- Cleans up the now-obsolete profiles plumbing that was blocking signups.
-- Original schema.sql created a `handle_new_user` trigger on auth.users that
-- inserted a row into a public `profiles` table; this fires on every Supabase
-- Auth signup. If `profiles` has any constraint the trigger can't satisfy,
-- the signup rolls back with "Database error saving new user" (500).
--
-- Since Phase 6 we've used `user_id` directly (anon localStorage UUIDs); from
-- Phase 7 onward it's the verified `auth.users.id` straight from the JWT.
-- The `profiles` table is dead weight either way — dropping it removes the
-- failure mode entirely.
--
-- Safe to re-run.
-- Paste into the Supabase SQL editor and click Run.
-- =============================================================================

-- 1. Kill the trigger that's blocking signups.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- 2. Drop the now-unreferenced profiles table. If you want to keep the
--    historical rows for any reason, comment this line out — the trigger
--    drop above is enough to unblock signups.
drop table if exists public.profiles;

-- 3. Sanity check: the hands table should still have user_id as a plain uuid
--    (no FK to profiles). Phase 6 already removed the FK, but in case this
--    migration is run on a different lineage, make it explicit.
alter table public.hands
    drop constraint if exists hands_user_id_fkey;
