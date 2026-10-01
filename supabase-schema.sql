-- Lexa — اسکیمای ساپابیس (اجرا شده در SQL Editor)
create table if not exists public.lexa_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.lexa_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);
alter table public.lexa_state enable row level security;
alter table public.lexa_profiles enable row level security;
drop policy if exists "own state" on public.lexa_state;
create policy "own state" on public.lexa_state for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own profile" on public.lexa_profiles;
create policy "own profile" on public.lexa_profiles for all using (auth.uid() = id) with check (auth.uid() = id);
