-- Applies the table_size / villain_cards changes to the existing hands table.
-- Paste into the Supabase SQL editor and run.
alter table hands
    drop column if exists villain_count,
    add column if not exists table_size    int  not null default 6 check (table_size between 6 and 9),
    add column if not exists villain_cards jsonb not null default '[]';
