-- Lexa 006: official accounts made by education centres (phase 1 of docs/ORG_LEARNING.md)
-- Run in the Supabase SQL editor after 002-005. Safe to re-run.
--
--   * centre code (used on the centre sign-in form) and a student-account capacity
--   * roster of official students (status, access after graduation / withdrawal)
--   * per-centre usernames for centre-made accounts (lookup only via the org-auth function)
--   * one-time activation codes for people who already have a Lexa account
--   * flags for centre-made accounts (must change the first password)
--   * append-only audit log, rate-limit events
--   * reads of student data need a two-factor session (aal2)
--
-- Every write that creates accounts, sets passwords or bans users is done by the
-- Edge Function supabase/functions/org-auth with the service key. Clients only get
-- the read RPCs, accept-terms and redeem-code below.

create extension if not exists pgcrypto;

-- --- centre code + student capacity ---
alter table public.lexa_orgs add column if not exists code text;
alter table public.lexa_orgs add column if not exists student_seats int not null default 50;

do $$ begin
  alter table public.lexa_orgs add constraint lexa_orgs_code_chk
    check (code is null or code ~ '^[a-z0-9][a-z0-9-]{1,23}$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.lexa_orgs add constraint lexa_orgs_student_seats_chk
    check (student_seats between 0 and 100000);
exception when duplicate_object then null; end $$;

-- default code = slug (slugs are unique, so codes are too)
update public.lexa_orgs set code = slug
where code is null and slug ~ '^[a-z0-9][a-z0-9-]{1,23}$';
create unique index if not exists lexa_orgs_code_key on public.lexa_orgs (code);

-- only a Lexa admin (or a trusted RPC / the SQL editor / the service key) changes code and capacity
create or replace function public.lexa_orgs_guard_accounts()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not public.lexa_is_admin()
     and coalesce(current_setting('lexa.trusted', true), '') <> '1'
     and (new.code is distinct from old.code or new.student_seats is distinct from old.student_seats) then
    raise exception 'only a Lexa admin can change the centre code or student capacity';
  end if;
  return new;
end $$;
drop trigger if exists lexa_orgs_guard_accounts on public.lexa_orgs;
create trigger lexa_orgs_guard_accounts before update on public.lexa_orgs
  for each row execute function public.lexa_orgs_guard_accounts();

-- --- two-factor session check ---
create or replace function public.lexa_mfa_ok()
returns boolean language sql stable as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

-- manages the centre AND signed in with a second factor
create or replace function public.lexa_org_manage_mfa(o uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.lexa_org_can_manage(o) and public.lexa_mfa_ok()
$$;

-- --- roster of official students ---
create table if not exists public.lexa_org_students (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.lexa_orgs(id) on delete cascade,
  user_id uuid references public.lexa_profiles(id) on delete set null,
  org_username text not null check (org_username ~ '^[A-Za-z0-9._-]{2,40}$'),
  student_no text not null default '' check (char_length(student_no) <= 40),
  external_id text not null default '' check (char_length(external_id) <= 80),
  full_name text not null default '' check (char_length(full_name) <= 80),
  field text not null default '' check (char_length(field) <= 80),
  entry_year text not null default '' check (char_length(entry_year) <= 10),
  status text not null default 'active' check (status in ('active', 'suspended', 'graduated', 'withdrawn')),
  access_after_exit text not null default 'open' check (access_after_exit in ('open', 'limited', 'until')),
  access_until date,
  official_since timestamptz,
  terms_accepted_at timestamptz,
  created_by uuid references public.lexa_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists lexa_org_students_uname_key on public.lexa_org_students (org_id, lower(org_username));
create unique index if not exists lexa_org_students_user_key on public.lexa_org_students (org_id, user_id) where user_id is not null;
create unique index if not exists lexa_org_students_ext_key on public.lexa_org_students (org_id, external_id) where external_id <> '';
create index if not exists lexa_org_students_user_idx on public.lexa_org_students (user_id);

drop trigger if exists lexa_org_students_touch on public.lexa_org_students;
create trigger lexa_org_students_touch before update on public.lexa_org_students
  for each row execute function public.lexa_touch_updated();

-- --- per-centre usernames of centre-made / linked accounts (sign-in lookup) ---
create table if not exists public.lexa_org_logins (
  org_id uuid not null references public.lexa_orgs(id) on delete cascade,
  org_username text not null check (org_username ~ '^[A-Za-z0-9._-]{2,40}$'),
  user_id uuid not null references public.lexa_profiles(id) on delete cascade,
  kind text not null default 'student' check (kind in ('student', 'staff')),
  created_at timestamptz not null default now()
);
create unique index if not exists lexa_org_logins_key on public.lexa_org_logins (org_id, lower(org_username));
create unique index if not exists lexa_org_logins_user_key on public.lexa_org_logins (org_id, user_id);

-- --- accounts made by a centre ---
create table if not exists public.lexa_account_flags (
  user_id uuid primary key references public.lexa_profiles(id) on delete cascade,
  managed_by_org uuid references public.lexa_orgs(id) on delete set null,
  must_change_password boolean not null default true,
  password_changed_at timestamptz,
  created_at timestamptz not null default now()
);

-- --- one-time activation codes (only the sha256 is stored) ---
create table if not exists public.lexa_org_activation_codes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.lexa_orgs(id) on delete cascade,
  student_id uuid not null references public.lexa_org_students(id) on delete cascade,
  code_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references public.lexa_profiles(id) on delete set null,
  created_by uuid references public.lexa_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists lexa_org_activation_codes_student_idx on public.lexa_org_activation_codes (student_id);

-- --- rate-limit events (sign-in and code attempts) ---
create table if not exists public.lexa_rate_events (
  key text not null,
  at timestamptz not null default now()
);
create index if not exists lexa_rate_events_key_idx on public.lexa_rate_events (key, at);

-- --- append-only audit log ---
create table if not exists public.lexa_audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor uuid,
  org_id uuid,
  action text not null check (char_length(action) <= 60),
  target uuid,
  detail jsonb not null default '{}'::jsonb
);
create index if not exists lexa_audit_log_org_idx on public.lexa_audit_log (org_id, at desc);

create or replace function public.lexa_audit_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'audit log is append-only';
end $$;
drop trigger if exists lexa_audit_no_change on public.lexa_audit_log;
create trigger lexa_audit_no_change before update or delete on public.lexa_audit_log
  for each row execute function public.lexa_audit_immutable();
drop trigger if exists lexa_audit_no_truncate on public.lexa_audit_log;
create trigger lexa_audit_no_truncate before truncate on public.lexa_audit_log
  for each statement execute function public.lexa_audit_immutable();

-- internal: only callable from our own functions, which set lexa.audit_ok first (a client
-- cannot set that, so even if a later script re-grants EXECUTE it cannot forge entries)
create or replace function public.lexa_audit(o uuid, act text, tgt uuid, info jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('lexa.audit_ok', true), '') <> '1' then
    raise exception 'internal function';
  end if;
  insert into public.lexa_audit_log (actor, org_id, action, target, detail)
  values (auth.uid(), o, left(act, 60), tgt, coalesce(info, '{}'::jsonb));
end $$;

-- --- RLS ---
alter table public.lexa_org_students enable row level security;
alter table public.lexa_org_logins enable row level security;
alter table public.lexa_account_flags enable row level security;
alter table public.lexa_org_activation_codes enable row level security;
alter table public.lexa_rate_events enable row level security;
alter table public.lexa_audit_log enable row level security;

drop policy if exists "org students read" on public.lexa_org_students;
create policy "org students read" on public.lexa_org_students for select using (
  user_id = auth.uid() or public.lexa_org_manage_mfa(org_id)
);
drop policy if exists "account flags read own" on public.lexa_account_flags;
create policy "account flags read own" on public.lexa_account_flags for select using (user_id = auth.uid());
drop policy if exists "audit read" on public.lexa_audit_log;
create policy "audit read" on public.lexa_audit_log for select using (
  (public.lexa_is_admin() and public.lexa_mfa_ok())
  or (org_id is not null and public.lexa_org_manage_mfa(org_id))
);
-- lexa_org_logins, lexa_org_activation_codes, lexa_rate_events: no client policy at all

revoke all on public.lexa_org_students, public.lexa_org_logins, public.lexa_account_flags,
  public.lexa_org_activation_codes, public.lexa_rate_events, public.lexa_audit_log
  from public, anon, authenticated;
grant select on public.lexa_org_students, public.lexa_account_flags, public.lexa_audit_log to authenticated;
revoke all on sequence public.lexa_audit_log_id_seq from public, anon, authenticated;

-- --- helpers used by later phases (content visibility) ---
-- caller is an official student of o with access right now
create or replace function public.lexa_org_official(o uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.lexa_org_active(o) and exists (
    select 1 from public.lexa_org_students s
    where s.org_id = o and s.user_id = auth.uid() and s.terms_accepted_at is not null
      and (s.status = 'active'
           or (s.status in ('graduated', 'withdrawn')
               and (s.access_after_exit = 'open'
                    or (s.access_after_exit = 'until' and s.access_until >= current_date))))
  )
$$;

create or replace function public.lexa_org_students_used(o uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.lexa_org_students where org_id = o and status = 'active'
$$;

-- --- client RPCs ---
-- my official memberships + whether my first password must still be changed
create or replace function public.lexa_my_org_accounts()
returns table (org_id uuid, org_name text, org_code text, org_username text, status text,
               terms_accepted_at timestamptz, must_change_password boolean)
language sql stable security definer set search_path = public as $$
  select s.org_id, o.name, o.code, s.org_username, s.status, s.terms_accepted_at,
    coalesce((select f.must_change_password from public.lexa_account_flags f where f.user_id = auth.uid()), false)
  from public.lexa_org_students s
  join public.lexa_orgs o on o.id = s.org_id
  where auth.uid() is not null and s.user_id = auth.uid()
  order by s.created_at
$$;

-- accept the centre's terms (only after the first password was changed)
create or replace function public.lexa_org_accept_terms(o uuid)
returns text language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from public.lexa_account_flags where user_id = auth.uid() and must_change_password) then
    raise exception 'change the first password first';
  end if;
  update public.lexa_org_students set terms_accepted_at = now()
  where org_id = o and user_id = auth.uid() and terms_accepted_at is null;
  if found then perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(o, 'student.accept_terms', auth.uid(), '{}'::jsonb); end if;
  return 'ok';
end $$;

-- redeem a one-time code: links my existing account to a roster row.
-- Failures return a status (not an exception) so the attempt counter is kept.
create or replace function public.lexa_org_redeem_code(code text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v text := upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'));
  rk text;
  c record;
  s record;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  rk := 'redeem:' || auth.uid()::text;
  if (select count(*) from public.lexa_rate_events where key = rk and at > now() - interval '1 hour') >= 5 then
    return 'limit';
  end if;
  select * into c from public.lexa_org_activation_codes
  where code_hash = encode(digest(v, 'sha256'), 'hex');
  if c.id is null or c.used_at is not null or c.expires_at < now() then
    insert into public.lexa_rate_events (key) values (rk);
    return case when c.id is not null and c.used_at is null then 'expired' else 'invalid' end;
  end if;
  select * into s from public.lexa_org_students where id = c.student_id;
  if s.id is null or s.user_id is not null then
    insert into public.lexa_rate_events (key) values (rk);
    return 'invalid';
  end if;
  if not public.lexa_org_active(s.org_id) then
    return 'inactive';
  end if;
  if exists (select 1 from public.lexa_org_students where org_id = s.org_id and user_id = auth.uid()) then
    return 'already';
  end if;
  if exists (select 1 from public.lexa_org_logins
             where org_id = s.org_id and lower(org_username) = lower(s.org_username)) then
    return 'username_taken';
  end if;
  update public.lexa_org_students set user_id = auth.uid(), official_since = now() where id = s.id;
  insert into public.lexa_org_logins (org_id, org_username, user_id, kind)
  values (s.org_id, s.org_username, auth.uid(), 'student');
  update public.lexa_org_activation_codes set used_at = now(), used_by = auth.uid() where id = c.id;
  delete from public.lexa_rate_events where key = rk;
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(s.org_id, 'student.redeem_code', auth.uid(), jsonb_build_object('student', s.id));
  return 'ok:' || s.org_id::text;
end $$;

-- roster for managers (two-factor session); includes last sign-in time
create or replace function public.lexa_org_roster(o uuid)
returns table (id uuid, user_id uuid, org_username text, student_no text, external_id text,
               full_name text, field text, entry_year text, status text, access_after_exit text,
               access_until date, official_since timestamptz, terms_accepted_at timestamptz,
               managed boolean, must_change_password boolean, last_sign_in_at timestamptz,
               pending_code boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.lexa_org_can_manage(o) then raise exception 'not a manager of this organisation'; end if;
  if not public.lexa_mfa_ok() then raise exception 'mfa required'; end if;
  return query
    select s.id, s.user_id, s.org_username, s.student_no, s.external_id, s.full_name, s.field,
      s.entry_year, s.status, s.access_after_exit, s.access_until, s.official_since, s.terms_accepted_at,
      coalesce(f.managed_by_org = o, false), coalesce(f.must_change_password, false), u.last_sign_in_at,
      exists (select 1 from public.lexa_org_activation_codes a
              where a.student_id = s.id and a.used_at is null and a.expires_at > now()),
      s.created_at
    from public.lexa_org_students s
    left join public.lexa_account_flags f on f.user_id = s.user_id
    left join auth.users u on u.id = s.user_id
    where s.org_id = o
    order by s.created_at desc;
end $$;

-- capacity for the panel header
create or replace function public.lexa_org_capacity(o uuid)
returns table (student_seats int, students_used int, teacher_seats int, teachers_used int, code text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.lexa_org_can_manage(o) then raise exception 'not a manager of this organisation'; end if;
  return query
    select g.student_seats, public.lexa_org_students_used(o), g.seats, public.lexa_org_seats_used(o), g.code
    from public.lexa_orgs g where g.id = o;
end $$;

-- labels on profiles ("فارغ‌التحصیل [centre]"), for signed-in users only
create or replace function public.lexa_org_badges(ids uuid[])
returns table (user_id uuid, org_name text, org_slug text, status text)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if coalesce(cardinality(ids), 0) > 200 then raise exception 'too many ids'; end if;
  return query
    select s.user_id, o.name, o.slug, s.status
    from public.lexa_org_students s join public.lexa_orgs o on o.id = s.org_id
    where s.user_id = any(coalesce(ids, '{}'::uuid[])) and s.terms_accepted_at is not null
      and s.status in ('active', 'graduated', 'withdrawn') and o.status = 'active';
end $$;

-- Lexa admin: centre code + student capacity
create or replace function public.lexa_admin_set_org_accounts(o uuid, new_code text, new_student_seats int)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.lexa_is_admin() then raise exception 'admin only'; end if;
  perform set_config('lexa.trusted', '1', true);
  update public.lexa_orgs set
    code = coalesce(nullif(lower(trim(new_code)), ''), code),
    student_seats = coalesce(new_student_seats, student_seats)
  where id = o;
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(o, 'admin.set_accounts', null,
    jsonb_build_object('code', new_code, 'student_seats', new_student_seats));
  return 'ok';
end $$;

-- service-key only: end every session of a user (refresh tokens); false if not permitted
create or replace function public.lexa_svc_revoke_sessions(uid uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and coalesce(current_setting('role', true), '') <> 'service_role' then
    raise exception 'service key only';
  end if;
  begin
    delete from auth.sessions where user_id = uid;
    return true;
  exception when insufficient_privilege or undefined_table then
    return false;
  end;
end $$;

-- --- function grants (002 granted every function to anon; be explicit) ---
revoke execute on function public.lexa_orgs_guard_accounts() from public, anon, authenticated;
revoke execute on function public.lexa_audit_immutable() from public, anon, authenticated;
revoke execute on function public.lexa_audit(uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.lexa_svc_revoke_sessions(uuid) from public, anon, authenticated;
revoke execute on function public.lexa_org_students_used(uuid) from public, anon, authenticated;
revoke execute on function public.lexa_my_org_accounts() from public, anon;
revoke execute on function public.lexa_org_accept_terms(uuid) from public, anon;
revoke execute on function public.lexa_org_redeem_code(text) from public, anon;
revoke execute on function public.lexa_org_roster(uuid) from public, anon;
revoke execute on function public.lexa_org_capacity(uuid) from public, anon;
revoke execute on function public.lexa_org_badges(uuid[]) from public, anon;
revoke execute on function public.lexa_admin_set_org_accounts(uuid, text, integer) from public, anon;

grant execute on function public.lexa_mfa_ok() to anon, authenticated;
grant execute on function public.lexa_org_manage_mfa(uuid) to anon, authenticated;
grant execute on function public.lexa_org_official(uuid) to anon, authenticated;
grant execute on function public.lexa_my_org_accounts() to authenticated;
grant execute on function public.lexa_org_accept_terms(uuid) to authenticated;
grant execute on function public.lexa_org_redeem_code(text) to authenticated;
grant execute on function public.lexa_org_roster(uuid) to authenticated;
grant execute on function public.lexa_org_capacity(uuid) to authenticated;
grant execute on function public.lexa_org_badges(uuid[]) to authenticated;
grant execute on function public.lexa_admin_set_org_accounts(uuid, text, integer) to authenticated;
grant execute on function public.lexa_svc_revoke_sessions(uuid) to service_role;

notify pgrst, 'reload schema';
