-- === Lexa — cloud social layer + organisations (Supabase / Postgres) ===
-- Run once in the Supabase SQL Editor (safe to re-run: every step is idempotent).
-- Needs 001 (supabase-schema.sql: lexa_state, lexa_profiles) to exist first.
--
-- What it adds
--   * public profiles with a role (user | teacher | admin) that only an admin
--     (or the SQL editor) can change
--   * teacher posts, comments, follows, teacher courses, personal library,
--     ratings — the same data the Next /api routes kept in SQLite, so the
--     GitHub Pages site, the Android app and the desktop app all see one copy
--   * organisations (universities / institutes) with managers, teacher
--     invitations / join requests, seats and an expiry date set by a Lexa admin
--   * teacher-account requests reviewed by a Lexa admin
--   * a public storage bucket "lexa-media" for avatars, covers and logos
--
-- Make yourself admin afterwards (replace the e-mail):
--   update public.lexa_profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'you@example.com');

create extension if not exists pgcrypto;

-- --- profiles ---
alter table public.lexa_profiles add column if not exists username text;
alter table public.lexa_profiles add column if not exists role text not null default 'user';
alter table public.lexa_profiles add column if not exists bio text;
alter table public.lexa_profiles add column if not exists avatar_url text;
alter table public.lexa_profiles add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.lexa_profiles add constraint lexa_profiles_role_chk
    check (role in ('user', 'teacher', 'admin'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.lexa_profiles add constraint lexa_profiles_len_chk check (
    char_length(coalesce(display_name, '')) <= 60
    and char_length(coalesce(bio, '')) <= 400
    and char_length(coalesce(avatar_url, '')) <= 600
    and char_length(coalesce(username, '')) <= 32
  );
exception when duplicate_object then null; end $$;

create or replace function public.lexa_default_username(uid uuid)
returns text language sql immutable as $$
  select 'u' || substr(replace(uid::text, '-', ''), 1, 10)
$$;

insert into public.lexa_profiles (id, username)
select u.id, public.lexa_default_username(u.id) from auth.users u
on conflict (id) do nothing;

update public.lexa_profiles set username = public.lexa_default_username(id) where username is null;

create unique index if not exists lexa_profiles_username_key on public.lexa_profiles (lower(username));
create index if not exists lexa_profiles_role_idx on public.lexa_profiles (role);

-- every new auth user gets a profile row
create or replace function public.lexa_on_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.lexa_profiles (id, username)
  values (new.id, public.lexa_default_username(new.id))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists lexa_on_auth_user on auth.users;
create trigger lexa_on_auth_user after insert on auth.users
  for each row execute function public.lexa_on_auth_user();

-- role helpers (security definer: they read profiles regardless of RLS)
create or replace function public.lexa_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.lexa_profiles where id = auth.uid()), 'user')
$$;

create or replace function public.lexa_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and public.lexa_role() = 'admin'
$$;

create or replace function public.lexa_is_teacher()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and public.lexa_role() in ('teacher', 'admin')
$$;

-- a signed-in client can never change its own role; admins, trusted RPCs
-- (lexa.trusted = 1) and the SQL editor (no auth.uid()) can
create or replace function public.lexa_profiles_guard()
returns trigger language plpgsql as $$
declare trusted boolean := coalesce(current_setting('lexa.trusted', true), '') = '1';
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and not trusted then
      new.role := 'user';
    end if;
    return new;
  end if;
  if new.id <> old.id then
    raise exception 'profile id cannot change';
  end if;
  if new.role is distinct from old.role
     and auth.uid() is not null and not trusted and not public.lexa_is_admin() then
    raise exception 'role change not allowed';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists lexa_profiles_guard on public.lexa_profiles;
create trigger lexa_profiles_guard before insert or update on public.lexa_profiles
  for each row execute function public.lexa_profiles_guard();

alter table public.lexa_profiles enable row level security;
drop policy if exists "own profile" on public.lexa_profiles;
drop policy if exists "profiles read" on public.lexa_profiles;
drop policy if exists "profiles insert own" on public.lexa_profiles;
drop policy if exists "profiles update own" on public.lexa_profiles;
create policy "profiles read" on public.lexa_profiles for select using (true);
create policy "profiles insert own" on public.lexa_profiles for insert
  with check (auth.uid() = id);
create policy "profiles update own" on public.lexa_profiles for update
  using (auth.uid() = id or public.lexa_is_admin())
  with check (auth.uid() = id or public.lexa_is_admin());

-- --- shared helpers ---
create or replace function public.lexa_touch_updated()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- --- organisations ---
create table if not exists public.lexa_orgs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  name text not null check (char_length(name) between 2 and 100),
  kind text not null default 'university' check (kind in ('university', 'institute', 'school', 'other')),
  city text not null default '' check (char_length(city) <= 60),
  description text not null default '' check (char_length(description) <= 1200),
  logo_url text not null default '' check (char_length(logo_url) <= 600),
  website text not null default '' check (char_length(website) <= 200),
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended')),
  plan text not null default 'trial' check (plan in ('trial', 'basic', 'pro')),
  seats int not null default 10 check (seats between 1 and 2000),
  expires_at timestamptz,
  created_by uuid not null references public.lexa_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lexa_org_members (
  org_id uuid not null references public.lexa_orgs(id) on delete cascade,
  user_id uuid not null references public.lexa_profiles(id) on delete cascade,
  role text not null default 'teacher' check (role in ('owner', 'manager', 'teacher')),
  status text not null default 'invited' check (status in ('invited', 'requested', 'active', 'declined', 'removed')),
  title text not null default '' check (char_length(title) <= 80),
  message text not null default '' check (char_length(message) <= 300),
  invited_by uuid references public.lexa_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index if not exists lexa_org_members_user_idx on public.lexa_org_members (user_id);

-- contact details and the Lexa admin note are not public: managers and admins only
create table if not exists public.lexa_org_private (
  org_id uuid primary key references public.lexa_orgs(id) on delete cascade,
  contact text not null default '' check (char_length(contact) <= 160),
  admin_note text not null default '' check (char_length(admin_note) <= 600),
  updated_at timestamptz not null default now()
);

create or replace function public.lexa_org_active(o uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.lexa_orgs
    where id = o and status = 'active' and (expires_at is null or expires_at > now())
  )
$$;

-- caller manages the org (owner / manager, active row) or is a Lexa admin
create or replace function public.lexa_org_can_manage(o uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.lexa_is_admin() or exists (
    select 1 from public.lexa_org_members
    where org_id = o and user_id = auth.uid() and status = 'active' and role in ('owner', 'manager')
  )
$$;

-- caller is an active member of an active org (may publish under its name)
create or replace function public.lexa_org_can_publish(o uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select o is null or (public.lexa_org_active(o) and exists (
    select 1 from public.lexa_org_members
    where org_id = o and user_id = auth.uid() and status = 'active'
  ))
$$;

create or replace function public.lexa_org_is_member(o uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lexa_org_members where org_id = o and user_id = auth.uid())
$$;

-- managers may edit the profile of the org; plan / status / seats / expiry only an admin
create or replace function public.lexa_orgs_guard()
returns trigger language plpgsql as $$
begin
  if not public.lexa_is_admin() and auth.uid() is not null
     and coalesce(current_setting('lexa.trusted', true), '') <> '1' and (
       new.status is distinct from old.status or new.plan is distinct from old.plan
       or new.seats is distinct from old.seats or new.expires_at is distinct from old.expires_at
       or new.created_by is distinct from old.created_by
       or new.slug is distinct from old.slug) then
    raise exception 'only a Lexa admin can change plan, status, seats, expiry or slug';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists lexa_orgs_guard on public.lexa_orgs;
create trigger lexa_orgs_guard before update on public.lexa_orgs
  for each row execute function public.lexa_orgs_guard();

drop trigger if exists lexa_org_members_touch on public.lexa_org_members;
create trigger lexa_org_members_touch before update on public.lexa_org_members
  for each row execute function public.lexa_touch_updated();

alter table public.lexa_orgs enable row level security;
drop policy if exists "orgs read" on public.lexa_orgs;
drop policy if exists "orgs update managers" on public.lexa_orgs;
drop policy if exists "orgs delete admin" on public.lexa_orgs;
create policy "orgs read" on public.lexa_orgs for select using (
  status = 'active' or created_by = auth.uid() or public.lexa_org_is_member(id) or public.lexa_is_admin()
);
create policy "orgs update managers" on public.lexa_orgs for update
  using (public.lexa_org_can_manage(id)) with check (public.lexa_org_can_manage(id));
create policy "orgs delete admin" on public.lexa_orgs for delete using (public.lexa_is_admin());

alter table public.lexa_org_members enable row level security;
drop policy if exists "org members read" on public.lexa_org_members;
create policy "org members read" on public.lexa_org_members for select using (
  user_id = auth.uid()
  or public.lexa_org_can_manage(org_id)
  or (status = 'active' and public.lexa_org_active(org_id))
);
-- writes go through the RPCs below

create or replace function public.lexa_org_private_guard()
returns trigger language plpgsql as $$
begin
  if new.admin_note is distinct from old.admin_note and auth.uid() is not null
     and coalesce(current_setting('lexa.trusted', true), '') <> '1' and not public.lexa_is_admin() then
    raise exception 'only a Lexa admin can change the admin note';
  end if;
  new.org_id := old.org_id;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists lexa_org_private_guard on public.lexa_org_private;
create trigger lexa_org_private_guard before update on public.lexa_org_private
  for each row execute function public.lexa_org_private_guard();

alter table public.lexa_org_private enable row level security;
drop policy if exists "org private read" on public.lexa_org_private;
drop policy if exists "org private update" on public.lexa_org_private;
create policy "org private read" on public.lexa_org_private for select
  using (public.lexa_org_can_manage(org_id));
create policy "org private update" on public.lexa_org_private for update
  using (public.lexa_org_can_manage(org_id)) with check (public.lexa_org_can_manage(org_id));

-- --- teacher-account requests ---
create table if not exists public.lexa_teacher_requests (
  user_id uuid primary key references public.lexa_profiles(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 80),
  bio text not null default '' check (char_length(bio) <= 600),
  credentials text not null default '' check (char_length(credentials) <= 600),
  contact text not null default '' check (char_length(contact) <= 120),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text not null default '' check (char_length(admin_note) <= 600),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table public.lexa_teacher_requests enable row level security;
drop policy if exists "teacher requests read" on public.lexa_teacher_requests;
create policy "teacher requests read" on public.lexa_teacher_requests for select
  using (user_id = auth.uid() or public.lexa_is_admin());

-- --- posts ---
create table if not exists public.lexa_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.lexa_profiles(id) on delete cascade,
  org_id uuid references public.lexa_orgs(id) on delete set null,
  title text not null check (char_length(title) between 1 and 140),
  summary text not null default '' check (char_length(summary) <= 280),
  tags text not null default '' check (char_length(tags) <= 120),
  category text not null default '' check (char_length(category) <= 40),
  categories jsonb not null default '[]'::jsonb,
  thumbnail text not null default '' check (char_length(thumbnail) <= 600),
  quiz jsonb not null default '[]'::jsonb,
  blocks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lexa_posts_size_chk check (pg_column_size(blocks) + pg_column_size(quiz) < 1500000)
);
create index if not exists lexa_posts_author_idx on public.lexa_posts (author_id, created_at desc);
create index if not exists lexa_posts_created_idx on public.lexa_posts (created_at desc);
create index if not exists lexa_posts_org_idx on public.lexa_posts (org_id);

-- 20 new posts a minute per author is plenty
create or replace function public.lexa_posts_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.lexa_posts
        where author_id = new.author_id and created_at > now() - interval '1 minute') >= 20 then
      raise exception 'rate limit: too many posts';
    end if;
    new.created_at := now();
  else
    new.author_id := old.author_id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists lexa_posts_guard on public.lexa_posts;
create trigger lexa_posts_guard before insert or update on public.lexa_posts
  for each row execute function public.lexa_posts_guard();

alter table public.lexa_posts enable row level security;
drop policy if exists "posts read" on public.lexa_posts;
drop policy if exists "posts insert teacher" on public.lexa_posts;
drop policy if exists "posts update owner" on public.lexa_posts;
drop policy if exists "posts delete owner" on public.lexa_posts;
create policy "posts read" on public.lexa_posts for select using (true);
create policy "posts insert teacher" on public.lexa_posts for insert with check (
  author_id = auth.uid() and public.lexa_is_teacher() and public.lexa_org_can_publish(org_id)
);
create policy "posts update owner" on public.lexa_posts for update
  using (author_id = auth.uid() or public.lexa_is_admin())
  with check ((author_id = auth.uid() and public.lexa_org_can_publish(org_id)) or public.lexa_is_admin());
create policy "posts delete owner" on public.lexa_posts for delete
  using (author_id = auth.uid() or public.lexa_is_admin());

-- --- comments ---
create table if not exists public.lexa_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.lexa_posts(id) on delete cascade,
  user_id uuid not null references public.lexa_profiles(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 1200),
  reply_to_id uuid references public.lexa_comments(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists lexa_comments_post_idx on public.lexa_comments (post_id, created_at);

-- one reply level (a reply to a reply hangs off the root) + 12 a minute
create or replace function public.lexa_comments_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare parent record;
begin
  if (select count(*) from public.lexa_comments
      where user_id = new.user_id and created_at > now() - interval '1 minute') >= 12 then
    raise exception 'rate limit: too many comments';
  end if;
  if new.reply_to_id is not null then
    select id, post_id, reply_to_id into parent from public.lexa_comments where id = new.reply_to_id;
    if parent.id is null or parent.post_id <> new.post_id then
      raise exception 'reply target not found';
    end if;
    new.reply_to_id := coalesce(parent.reply_to_id, parent.id);
  end if;
  new.created_at := now();
  return new;
end $$;

drop trigger if exists lexa_comments_guard on public.lexa_comments;
create trigger lexa_comments_guard before insert on public.lexa_comments
  for each row execute function public.lexa_comments_guard();

alter table public.lexa_comments enable row level security;
drop policy if exists "comments read" on public.lexa_comments;
drop policy if exists "comments insert own" on public.lexa_comments;
drop policy if exists "comments delete" on public.lexa_comments;
create policy "comments read" on public.lexa_comments for select using (true);
create policy "comments insert own" on public.lexa_comments for insert
  with check (user_id = auth.uid());
create policy "comments delete" on public.lexa_comments for delete using (
  user_id = auth.uid() or public.lexa_is_admin()
  or exists (select 1 from public.lexa_posts p where p.id = post_id and p.author_id = auth.uid())
);

-- --- follows ---
create table if not exists public.lexa_follows (
  student_id uuid not null references public.lexa_profiles(id) on delete cascade,
  teacher_id uuid not null references public.lexa_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, teacher_id),
  check (student_id <> teacher_id)
);
create index if not exists lexa_follows_teacher_idx on public.lexa_follows (teacher_id);

alter table public.lexa_follows enable row level security;
drop policy if exists "follows read own" on public.lexa_follows;
drop policy if exists "follows insert own" on public.lexa_follows;
drop policy if exists "follows delete own" on public.lexa_follows;
create policy "follows read own" on public.lexa_follows for select using (student_id = auth.uid());
create policy "follows insert own" on public.lexa_follows for insert with check (
  student_id = auth.uid()
  and exists (select 1 from public.lexa_profiles t where t.id = teacher_id and t.role in ('teacher', 'admin'))
);
create policy "follows delete own" on public.lexa_follows for delete using (student_id = auth.uid());

-- --- teacher courses ---
create table if not exists public.lexa_tcourses (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.lexa_profiles(id) on delete cascade,
  org_id uuid references public.lexa_orgs(id) on delete set null,
  title text not null check (char_length(title) between 1 and 140),
  tagline text not null default '' check (char_length(tagline) <= 160),
  description text not null default '' check (char_length(description) <= 2000),
  icon text not null default '' check (char_length(icon) <= 40),
  accent text not null default 'bronze' check (accent in ('navy', 'bronze', 'green')),
  category text not null default 'other' check (char_length(category) <= 40),
  categories jsonb not null default '["other"]'::jsonb,
  status text not null default 'published' check (status in ('draft', 'prep', 'published')),
  thumbnail text not null default '' check (char_length(thumbnail) <= 600),
  chapters jsonb not null default '[]'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lexa_tcourses_size_chk check (pg_column_size(chapters) < 8000000)
);
create index if not exists lexa_tcourses_teacher_idx on public.lexa_tcourses (teacher_id, updated_at desc);
create index if not exists lexa_tcourses_updated_idx on public.lexa_tcourses (updated_at desc);
create index if not exists lexa_tcourses_org_idx on public.lexa_tcourses (org_id);

create or replace function public.lexa_tcourses_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    new.teacher_id := old.teacher_id;
    new.created_at := old.created_at;
  else
    new.created_at := now();
  end if;
  if new.status <> 'draft' and new.published_at is null then
    new.published_at := now();
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists lexa_tcourses_guard on public.lexa_tcourses;
create trigger lexa_tcourses_guard before insert or update on public.lexa_tcourses
  for each row execute function public.lexa_tcourses_guard();

alter table public.lexa_tcourses enable row level security;
drop policy if exists "tcourses read" on public.lexa_tcourses;
drop policy if exists "tcourses insert teacher" on public.lexa_tcourses;
drop policy if exists "tcourses update owner" on public.lexa_tcourses;
drop policy if exists "tcourses delete owner" on public.lexa_tcourses;
create policy "tcourses read" on public.lexa_tcourses for select using (
  status <> 'draft' or teacher_id = auth.uid() or public.lexa_is_admin()
);
create policy "tcourses insert teacher" on public.lexa_tcourses for insert with check (
  teacher_id = auth.uid() and public.lexa_is_teacher() and public.lexa_org_can_publish(org_id)
);
create policy "tcourses update owner" on public.lexa_tcourses for update
  using (teacher_id = auth.uid() or public.lexa_is_admin())
  with check ((teacher_id = auth.uid() and public.lexa_org_can_publish(org_id)) or public.lexa_is_admin());
create policy "tcourses delete owner" on public.lexa_tcourses for delete
  using (teacher_id = auth.uid() or public.lexa_is_admin());

-- --- personal library (teacher courses a student added) ---
create table if not exists public.lexa_library (
  user_id uuid not null references public.lexa_profiles(id) on delete cascade,
  course_id uuid not null references public.lexa_tcourses(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (user_id, course_id)
);
create index if not exists lexa_library_course_idx on public.lexa_library (course_id);

alter table public.lexa_library enable row level security;
drop policy if exists "library own" on public.lexa_library;
create policy "library own" on public.lexa_library for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- --- ratings (one mutable vote per user and target) ---
create table if not exists public.lexa_ratings (
  user_id uuid not null references public.lexa_profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'tcourse')),
  target_id uuid not null,
  stars int not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);
create index if not exists lexa_ratings_target_idx on public.lexa_ratings (target_type, target_id);

drop trigger if exists lexa_ratings_touch on public.lexa_ratings;
create trigger lexa_ratings_touch before update on public.lexa_ratings
  for each row execute function public.lexa_touch_updated();

alter table public.lexa_ratings enable row level security;
drop policy if exists "ratings own" on public.lexa_ratings;
create policy "ratings own" on public.lexa_ratings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- deleting a post / course removes its votes
create or replace function public.lexa_drop_ratings()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.lexa_ratings
  where target_id = old.id and target_type = (case when tg_table_name = 'lexa_posts' then 'post' else 'tcourse' end);
  return old;
end $$;
drop trigger if exists lexa_posts_drop_ratings on public.lexa_posts;
create trigger lexa_posts_drop_ratings after delete on public.lexa_posts
  for each row execute function public.lexa_drop_ratings();
drop trigger if exists lexa_tcourses_drop_ratings on public.lexa_tcourses;
create trigger lexa_tcourses_drop_ratings after delete on public.lexa_tcourses
  for each row execute function public.lexa_drop_ratings();

-- --- read-side RPCs (counts the caller cannot see row by row) ---
create or replace function public.lexa_rating_aggs(t text, ids uuid[])
returns table (target_id uuid, avg numeric, cnt bigint)
language sql stable security definer set search_path = public as $$
  select r.target_id, round(avg(r.stars)::numeric, 1), count(*)
  from public.lexa_ratings r
  where r.target_type = t and r.target_id = any(ids)
  group by r.target_id
$$;

create or replace function public.lexa_course_students(ids uuid[])
returns table (course_id uuid, students bigint)
language sql stable security definer set search_path = public as $$
  select l.course_id, count(*) from public.lexa_library l
  where l.course_id = any(ids) group by l.course_id
$$;

create or replace function public.lexa_teacher_stats(ids uuid[])
returns table (id uuid, followers bigint, posts bigint, courses bigint)
language sql stable security definer set search_path = public as $$
  select p.id,
    (select count(*) from public.lexa_follows f where f.teacher_id = p.id),
    (select count(*) from public.lexa_posts x where x.author_id = p.id),
    (select count(*) from public.lexa_tcourses c where c.teacher_id = p.id and c.status <> 'draft')
  from public.lexa_profiles p
  where p.id = any(ids)
$$;

-- teacher directory: every teacher with counts, most followed first
create or replace function public.lexa_teacher_directory(q text default '', lim int default 60)
returns table (id uuid, username text, display_name text, bio text, avatar_url text,
               followers bigint, posts bigint, courses bigint)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.bio, p.avatar_url,
    (select count(*) from public.lexa_follows f where f.teacher_id = p.id) as followers,
    (select count(*) from public.lexa_posts x where x.author_id = p.id) as posts,
    (select count(*) from public.lexa_tcourses c where c.teacher_id = p.id and c.status <> 'draft') as courses
  from public.lexa_profiles p
  where p.role = 'teacher'
    and (coalesce(q, '') = '' or p.display_name ilike '%' || q || '%' or p.username ilike '%' || q || '%')
  order by followers desc, posts desc, p.created_at asc
  limit greatest(1, least(coalesce(lim, 60), 200))
$$;

-- find any user by exact username (org managers invite people who are not teachers yet)
create or replace function public.lexa_find_user(uname text)
returns table (id uuid, username text, display_name text, avatar_url text, role text)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.role
  from public.lexa_profiles p
  where auth.uid() is not null and lower(p.username) = lower(trim(uname))
  limit 1
$$;

-- --- profile RPCs ---
-- change my username (3..20, latin/persian/digits/_/.; "u…" defaults stay valid)
create or replace function public.lexa_set_username(uname text)
returns text language plpgsql security definer set search_path = public as $$
declare v text := trim(coalesce(uname, ''));
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if char_length(v) < 3 or char_length(v) > 20 or v !~ '^[a-zA-Z0-9_\u0600-\u06FF][a-zA-Z0-9_.\u0600-\u06FF]*$' then
    raise exception 'invalid username';
  end if;
  if exists (select 1 from public.lexa_profiles where lower(username) = lower(v) and id <> auth.uid()) then
    raise exception 'username taken';
  end if;
  update public.lexa_profiles set username = v where id = auth.uid();
  return v;
end $$;

-- ask for a teacher account (a Lexa admin reviews it)
create or replace function public.lexa_request_teacher(p_full_name text, p_bio text, p_credentials text, p_contact text)
returns text language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if public.lexa_role() in ('teacher', 'admin') then return 'approved'; end if;
  insert into public.lexa_teacher_requests as r (user_id, full_name, bio, credentials, contact, status, created_at, reviewed_at)
  values (auth.uid(), left(trim(p_full_name), 80), left(coalesce(p_bio, ''), 600),
          left(coalesce(p_credentials, ''), 600), left(coalesce(p_contact, ''), 120), 'pending', now(), null)
  on conflict (user_id) do update set
    full_name = excluded.full_name, bio = excluded.bio, credentials = excluded.credentials,
    contact = excluded.contact, status = 'pending', created_at = now(), reviewed_at = null;
  return 'pending';
end $$;

-- --- admin RPCs ---
create or replace function public.lexa_admin_review_teacher(uid uuid, approve boolean, note text default '')
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.lexa_is_admin() then raise exception 'admin only'; end if;
  update public.lexa_teacher_requests
    set status = case when approve then 'approved' else 'rejected' end,
        admin_note = left(coalesce(note, ''), 600), reviewed_at = now()
    where user_id = uid;
  if approve then
    perform set_config('lexa.trusted', '1', true);
    update public.lexa_profiles set role = 'teacher',
      display_name = coalesce(nullif(display_name, ''), (select full_name from public.lexa_teacher_requests where user_id = uid)),
      bio = coalesce(nullif(bio, ''), (select nullif(r.bio, '') from public.lexa_teacher_requests r where r.user_id = uid))
    where id = uid and role = 'user';
  end if;
  return case when approve then 'approved' else 'rejected' end;
end $$;

create or replace function public.lexa_admin_set_role(uid uuid, new_role text)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.lexa_is_admin() then raise exception 'admin only'; end if;
  if new_role not in ('user', 'teacher', 'admin') then raise exception 'bad role'; end if;
  if uid = auth.uid() and new_role <> 'admin' then raise exception 'cannot demote yourself'; end if;
  perform set_config('lexa.trusted', '1', true);
  update public.lexa_profiles set role = new_role where id = uid;
  return new_role;
end $$;

create or replace function public.lexa_admin_set_org(o uuid, new_status text, new_plan text, new_seats int,
                                                     new_expires timestamptz, note text default '')
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.lexa_is_admin() then raise exception 'admin only'; end if;
  update public.lexa_orgs set
    status = coalesce(new_status, status), plan = coalesce(new_plan, plan),
    seats = coalesce(new_seats, seats), expires_at = new_expires
  where id = o;
  insert into public.lexa_org_private (org_id, admin_note) values (o, left(coalesce(note, ''), 600))
  on conflict (org_id) do update set admin_note = excluded.admin_note;
  return 'ok';
end $$;

-- --- organisation RPCs ---
-- anyone signed in can ask for a panel; it stays "pending" until a Lexa admin
-- activates it (after payment) and sets seats / expiry
create or replace function public.lexa_create_org(o_name text, o_slug text, o_kind text,
                                                  o_city text, o_description text, o_website text, o_contact text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if (select count(*) from public.lexa_orgs where created_by = auth.uid()) >= 3 then
    raise exception 'too many organisations';
  end if;
  insert into public.lexa_orgs (slug, name, kind, city, description, website, created_by)
  values (lower(trim(o_slug)), trim(o_name), coalesce(nullif(o_kind, ''), 'university'),
          left(coalesce(o_city, ''), 60), left(coalesce(o_description, ''), 1200),
          left(coalesce(o_website, ''), 200), auth.uid())
  returning id into new_id;
  insert into public.lexa_org_private (org_id, contact) values (new_id, left(coalesce(o_contact, ''), 160));
  insert into public.lexa_org_members (org_id, user_id, role, status, invited_by)
  values (new_id, auth.uid(), 'owner', 'active', auth.uid());
  return new_id;
end $$;

-- teacher seats in use (active + pending invitations / requests)
create or replace function public.lexa_org_seats_used(o uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.lexa_org_members
  where org_id = o and role = 'teacher' and status in ('active', 'invited', 'requested')
$$;

-- a manager invites a person to the org (an existing teacher, or a user who
-- becomes a teacher when they accept, because the organisation vouches for them)
create or replace function public.lexa_org_invite(o uuid, uid uuid, m_title text default '', m_message text default '')
returns text language plpgsql security definer set search_path = public as $$
declare cur record;
begin
  if not public.lexa_org_can_manage(o) then raise exception 'not a manager of this organisation'; end if;
  if not public.lexa_org_active(o) then raise exception 'organisation panel is not active'; end if;
  if not exists (select 1 from public.lexa_profiles where id = uid) then raise exception 'user not found'; end if;
  select * into cur from public.lexa_org_members where org_id = o and user_id = uid;
  if cur.user_id is not null and cur.status = 'active' then return 'active'; end if;
  if cur.user_id is not null and cur.status = 'requested' then
    update public.lexa_org_members set status = 'active', title = left(coalesce(m_title, ''), 80)
    where org_id = o and user_id = uid;
    perform public.lexa_promote_member(o, uid);
    return 'active';
  end if;
  if (cur.user_id is null or cur.status in ('declined', 'removed'))
     and public.lexa_org_seats_used(o) >= (select seats from public.lexa_orgs where id = o) then
    raise exception 'no free seats';
  end if;
  insert into public.lexa_org_members (org_id, user_id, role, status, title, message, invited_by)
  values (o, uid, 'teacher', 'invited', left(coalesce(m_title, ''), 80), left(coalesce(m_message, ''), 300), auth.uid())
  on conflict (org_id, user_id) do update set
    status = 'invited', role = case when public.lexa_org_members.role = 'owner' then 'owner' else 'teacher' end,
    title = excluded.title, message = excluded.message, invited_by = excluded.invited_by;
  return 'invited';
end $$;

-- accepting an org invitation turns a plain user into a teacher
create or replace function public.lexa_promote_member(o uuid, uid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.lexa_org_active(o) then
    perform set_config('lexa.trusted', '1', true);
    update public.lexa_profiles set role = 'teacher' where id = uid and role = 'user'
      and exists (select 1 from public.lexa_org_members where org_id = o and user_id = uid and role = 'teacher' and status = 'active');
  end if;
end $$;

-- a teacher asks to join an org (a manager approves with lexa_org_invite / lexa_org_review)
create or replace function public.lexa_org_request(o uuid, m_message text default '')
returns text language plpgsql security definer set search_path = public as $$
declare cur record;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not public.lexa_is_teacher() then raise exception 'teacher accounts only'; end if;
  if not public.lexa_org_active(o) then raise exception 'organisation panel is not active'; end if;
  select * into cur from public.lexa_org_members where org_id = o and user_id = auth.uid();
  if cur.user_id is not null and cur.status = 'active' then return 'active'; end if;
  if cur.user_id is not null and cur.status = 'invited' then
    update public.lexa_org_members set status = 'active' where org_id = o and user_id = auth.uid();
    return 'active';
  end if;
  insert into public.lexa_org_members (org_id, user_id, role, status, message)
  values (o, auth.uid(), 'teacher', 'requested', left(coalesce(m_message, ''), 300))
  on conflict (org_id, user_id) do update set status = 'requested', message = excluded.message;
  return 'requested';
end $$;

-- the invited person answers
create or replace function public.lexa_org_respond(o uuid, accept boolean)
returns text language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  update public.lexa_org_members set status = case when accept then 'active' else 'declined' end
  where org_id = o and user_id = auth.uid() and status = 'invited';
  if not found then raise exception 'no pending invitation'; end if;
  if accept then perform public.lexa_promote_member(o, auth.uid()); end if;
  return case when accept then 'active' else 'declined' end;
end $$;

-- a manager answers a join request
create or replace function public.lexa_org_review(o uuid, uid uuid, accept boolean)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.lexa_org_can_manage(o) then raise exception 'not a manager of this organisation'; end if;
  update public.lexa_org_members set status = case when accept then 'active' else 'declined' end
  where org_id = o and user_id = uid and status = 'requested';
  if not found then raise exception 'no pending request'; end if;
  return case when accept then 'active' else 'declined' end;
end $$;

-- a manager edits a member (title; only the owner or an admin can make managers),
-- removes them, or a member leaves
create or replace function public.lexa_org_set_member(o uuid, uid uuid, m_role text, m_title text, remove boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare
  me_owner boolean;
  cur record;
begin
  select * into cur from public.lexa_org_members where org_id = o and user_id = uid;
  if cur.user_id is null then raise exception 'member not found'; end if;
  if remove and uid = auth.uid() and cur.role <> 'owner' then
    update public.lexa_org_members set status = 'removed' where org_id = o and user_id = uid;
    update public.lexa_posts set org_id = null where org_id = o and author_id = uid;
    update public.lexa_tcourses set org_id = null where org_id = o and teacher_id = uid;
    return 'removed';
  end if;
  if not public.lexa_org_can_manage(o) then raise exception 'not a manager of this organisation'; end if;
  if cur.role = 'owner' and not public.lexa_is_admin() then raise exception 'the owner cannot be changed'; end if;
  me_owner := public.lexa_is_admin() or exists (
    select 1 from public.lexa_org_members where org_id = o and user_id = auth.uid() and role = 'owner' and status = 'active');
  if remove then
    update public.lexa_org_members set status = 'removed' where org_id = o and user_id = uid;
    update public.lexa_posts set org_id = null where org_id = o and author_id = uid;
    update public.lexa_tcourses set org_id = null where org_id = o and teacher_id = uid;
    return 'removed';
  end if;
  if m_role is not null and m_role <> cur.role then
    if not me_owner then raise exception 'only the owner can change roles'; end if;
    if m_role not in ('manager', 'teacher') then raise exception 'bad role'; end if;
  end if;
  update public.lexa_org_members set
    role = coalesce(nullif(m_role, ''), role),
    title = left(coalesce(m_title, title), 80)
  where org_id = o and user_id = uid;
  return 'ok';
end $$;

-- a manager takes a post / course off the org page (it stays on the teacher's page)
create or replace function public.lexa_org_unlink(o uuid, kind text, item uuid)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.lexa_org_can_manage(o) then raise exception 'not a manager of this organisation'; end if;
  if kind = 'post' then
    update public.lexa_posts set org_id = null where id = item and org_id = o;
  else
    update public.lexa_tcourses set org_id = null where id = item and org_id = o;
  end if;
  return 'ok';
end $$;

-- --- grants (RLS above decides what each row allows) ---
grant usage on schema public to anon, authenticated;
grant select on public.lexa_profiles, public.lexa_orgs, public.lexa_org_members, public.lexa_posts,
  public.lexa_comments, public.lexa_tcourses to anon, authenticated;
grant select, insert, update, delete on public.lexa_posts, public.lexa_comments, public.lexa_follows,
  public.lexa_tcourses, public.lexa_library, public.lexa_ratings to authenticated;
grant select, insert, update on public.lexa_profiles to authenticated;
grant select, update, delete on public.lexa_orgs to authenticated;
grant select on public.lexa_org_members, public.lexa_teacher_requests to authenticated;
grant select, update on public.lexa_org_private to authenticated;
grant execute on all functions in schema public to anon, authenticated;

-- --- storage: avatars, covers, org logos (public read, write only in own folder) ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lexa-media', 'lexa-media', true, 4194304,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "lexa media insert own" on storage.objects;
drop policy if exists "lexa media update own" on storage.objects;
drop policy if exists "lexa media delete own" on storage.objects;
create policy "lexa media insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'lexa-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "lexa media update own" on storage.objects for update to authenticated
  using (bucket_id = 'lexa-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "lexa media delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'lexa-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- let PostgREST see the new tables / functions right away
notify pgrst, 'reload schema';
