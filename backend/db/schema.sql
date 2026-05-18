-- ============================================================
-- RiverIQ Schema
-- Safe to re-run in the Supabase SQL editor
-- ============================================================


-- ------------------------------------------------------------
-- profiles
-- Extends Supabase Auth. One row per user.
-- ------------------------------------------------------------
create table if not exists profiles (
    id          uuid primary key references auth.users (id) on delete cascade,
    username    text not null,
    created_at  timestamptz not null default now()
);

-- Auto-create a profile row whenever a new user signs up
create or replace function handle_new_user()
returns trigger as $$
begin
    insert into profiles (id, username)
    values (new.id, new.email);
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure handle_new_user();


-- ------------------------------------------------------------
-- hands
-- One row per completed poker hand.
-- ------------------------------------------------------------
create table if not exists hands (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null references profiles (id) on delete cascade,
    hole_cards      text[] not null,
    board_cards     text[] not null default '{}',
    position        text,
    table_size      int not null default 6 check (table_size between 6 and 9),
    villain_cards   jsonb not null default '[]',
    pot_size        numeric not null default 0,
    result          numeric not null default 0,
    created_at      timestamptz not null default now()
);


-- ------------------------------------------------------------
-- actions
-- One row per betting action within a hand.
-- ------------------------------------------------------------
create table if not exists actions (
    id              uuid primary key default gen_random_uuid(),
    hand_id         uuid not null references hands (id) on delete cascade,
    street          text not null check (street in ('preflop', 'flop', 'turn', 'river')),
    action_type     text not null check (action_type in ('fold', 'check', 'call', 'raise', 'bet')),
    amount          numeric not null default 0,
    pot_at_action   numeric not null default 0,
    created_at      timestamptz not null default now()
);


-- ------------------------------------------------------------
-- Row Level Security
-- Users can only read and write their own data.
-- ------------------------------------------------------------
alter table profiles enable row level security;
alter table hands    enable row level security;
alter table actions  enable row level security;

-- profiles: users can read and update only their own row
drop policy if exists "users can read own profile" on profiles;
create policy "users can read own profile"
    on profiles for select
    using (auth.uid() = id);

drop policy if exists "users can update own profile" on profiles;
create policy "users can update own profile"
    on profiles for update
    using (auth.uid() = id);

-- hands: users can read, insert, and delete only their own hands
drop policy if exists "users can read own hands" on hands;
create policy "users can read own hands"
    on hands for select
    using (auth.uid() = user_id);

drop policy if exists "users can insert own hands" on hands;
create policy "users can insert own hands"
    on hands for insert
    with check (auth.uid() = user_id);

drop policy if exists "users can delete own hands" on hands;
create policy "users can delete own hands"
    on hands for delete
    using (auth.uid() = user_id);

-- actions: users can read and insert actions for their own hands
drop policy if exists "users can read own actions" on actions;
create policy "users can read own actions"
    on actions for select
    using (
        exists (
            select 1 from hands
            where hands.id = actions.hand_id
            and hands.user_id = auth.uid()
        )
    );

drop policy if exists "users can insert own actions" on actions;
create policy "users can insert own actions"
    on actions for insert
    with check (
        exists (
            select 1 from hands
            where hands.id = actions.hand_id
            and hands.user_id = auth.uid()
        )
    );
