-- Lexa 014: centre console (phase A2 of docs/ADMIN_PLATFORM.md; setup in docs/ADMIN_A2_SETUP.md)
-- Run in the Supabase SQL editor after 013. Safe to re-run.
--
--   * organisation tree lexa_org_units (faculty > department > program, or branch > track > section)
--   * subjects, classes, students and staff can hang on a unit (unit_id; empty = whole centre)
--   * named permissions (org.*), role templates and custom roles per centre
--   * role grants scoped to the whole centre or to one unit with everything under it, optional expiry
--   * lexa_org_can(o, perm, unit): owner = everything, manager = template "manager", plus every live
--     grant. The old owner / manager / teacher roles keep working exactly as before.
--   * new member kind "staff" (takes no teacher seat): advisors, finance, exam office, ...
--   * one-call centre home (lexa_org_home) and a centre audit search
--   * every change is checked on the server, needs a two-factor session and is written to the audit log
--   * nobody can create or grant a role with a permission they do not hold themselves

do $$ begin
  if to_regprocedure('public.lexa_admin_require(boolean)') is null
     or to_regprocedure('public.lexa_org_dashboard(uuid)') is null then
    raise exception 'run 008, 009 and 013 first';
  end if;
end $$;

-- --- member kind "staff" ---
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.lexa_org_members'::regclass and contype = 'c' and conname <> 'lexa_org_members_role_chk'
      and pg_get_constraintdef(oid) ilike '%role%' and pg_get_constraintdef(oid) ilike '%teacher%'
  loop
    execute format('alter table public.lexa_org_members drop constraint %I', c.conname);
  end loop;
end $$;
do $$ begin
  alter table public.lexa_org_members add constraint lexa_org_members_role_chk
    check (role in ('owner', 'manager', 'teacher', 'staff'));
exception when duplicate_object then null; end $$;

-- --- permissions and role templates ---
create or replace function public.lexa_org_perm_keys()
returns text[] language sql immutable as $$
  select array['org.settings.manage', 'org.units.manage', 'org.roles.manage', 'org.members.manage',
    'org.students.manage', 'org.terms.manage', 'org.classes.manage', 'org.enroll.manage',
    'org.content.publish', 'org.exams.manage', 'org.grades.enter', 'org.grades.approve',
    'org.grades.publish', 'org.grades.unlock', 'org.appeals.handle', 'org.reports.read',
    'org.reports.export', 'org.announce', 'org.api.manage', 'org.audit.read', 'org.billing.read']::text[]
$$;

-- base = comes from the membership (owner / manager / teacher), not from a grant.
-- The teacher's permissions apply to their own classes only and are not centre-wide rights.
create or replace function public.lexa_org_role_templates()
returns table (key text, name text, description text, perms text[], base boolean, sort int)
language sql immutable as $$
  select * from (values
    ('owner', 'مالک', 'همه‌ی دسترسی‌ها؛ حداقل یک مالک فعال لازم است.', public.lexa_org_perm_keys(), true, 0),
    ('manager', 'مدیر کل', 'همه‌ی دسترسی‌ها جز ساخت و اعطای نقش.',
      array_remove(public.lexa_org_perm_keys(), 'org.roles.manage'), true, 10),
    ('teacher', 'مدرس', 'فقط کلاس‌های خودش: نمره، محتوا و آزمون.',
      array['org.content.publish', 'org.exams.manage', 'org.grades.enter']::text[], true, 20),
    ('academic', 'مدیر آموزش', 'ترم، درس و کلاس، ثبت‌نام، آزمون، تأیید و انتشار نمره، اعتراض.',
      array['org.announce', 'org.appeals.handle', 'org.classes.manage', 'org.content.publish', 'org.enroll.manage',
            'org.exams.manage', 'org.grades.approve', 'org.grades.publish', 'org.reports.export', 'org.reports.read',
            'org.students.manage', 'org.terms.manage']::text[], false, 30),
    ('unit_head', 'مدیر شعبه یا گروه', 'برای یک شاخه‌ی درخت: ساختار، دانشجو، کلاس، تأیید نمره و گزارش.',
      array['org.announce', 'org.classes.manage', 'org.content.publish', 'org.enroll.manage', 'org.grades.approve',
            'org.reports.read', 'org.students.manage', 'org.units.manage']::text[], false, 40),
    ('assistant', 'دستیار و مصحح', 'ورود نمره.', array['org.grades.enter']::text[], false, 50),
    ('exam_officer', 'مسئول آزمون', 'ساخت و زمان‌بندی آزمون، ورود نمره‌ی آزمون، گزارش.',
      array['org.exams.manage', 'org.grades.enter', 'org.reports.read']::text[], false, 60),
    ('advisor', 'مشاور', 'دیدن گزارش دانشجو و اطلاعیه.', array['org.announce', 'org.reports.read']::text[], false, 70),
    ('support', 'مالی و پشتیبانی', 'حساب دانشجو، ثبت‌نام، پلن و مصرف.',
      array['org.billing.read', 'org.enroll.manage', 'org.reports.read', 'org.students.manage']::text[], false, 80),
    ('auditor', 'ناظر فقط‌خواندنی', 'دیدن گزارش، لاگ ممیزی و پلن؛ بدون هیچ تغییر.',
      array['org.audit.read', 'org.billing.read', 'org.reports.read']::text[], false, 90)
  ) as t(key, name, description, perms, base, sort)
$$;

-- --- organisation tree ---
create table if not exists public.lexa_org_units (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.lexa_orgs(id) on delete cascade,
  parent_id uuid references public.lexa_org_units(id) on delete cascade,
  kind text not null default 'other'
    check (kind in ('faculty', 'department', 'program', 'branch', 'track', 'section', 'other')),
  name text not null check (char_length(name) between 1 and 80),
  code text not null default '' check (char_length(code) <= 30),
  sort int not null default 0 check (sort between -100000 and 100000),
  status text not null default 'active' check (status in ('active', 'archived')),
  path uuid[] not null default '{}'::uuid[],
  depth int not null default 0 check (depth between 0 and 5),
  created_by uuid references public.lexa_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists lexa_org_units_code_key on public.lexa_org_units (org_id, lower(code)) where code <> '';
create index if not exists lexa_org_units_parent_idx on public.lexa_org_units (org_id, parent_id);
create index if not exists lexa_org_units_path_idx on public.lexa_org_units using gin (path);

-- path = ids from the root down to the unit itself; at most 6 levels; no cycles; never across centres
create or replace function public.lexa_org_units_path()
returns trigger language plpgsql as $$
declare p record;
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.org_id := old.org_id;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  if new.parent_id is null then
    new.path := array[new.id];
    new.depth := 0;
  else
    select u.org_id, u.path, u.depth into p from public.lexa_org_units u where u.id = new.parent_id;
    if p.org_id is null or p.org_id <> new.org_id then raise exception 'parent unit not found'; end if;
    if new.id = any(p.path) then raise exception 'a unit cannot move under itself'; end if;
    if p.depth >= 5 then raise exception 'tree too deep'; end if;
    new.path := p.path || new.id;
    new.depth := p.depth + 1;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists lexa_org_units_path on public.lexa_org_units;
create trigger lexa_org_units_path before insert or update on public.lexa_org_units
  for each row execute function public.lexa_org_units_path();

-- a moved unit re-computes the path of its children (and they of theirs)
create or replace function public.lexa_org_units_cascade()
returns trigger language plpgsql as $$
begin
  if new.path is distinct from old.path then
    update public.lexa_org_units set updated_at = now() where parent_id = new.id;
  end if;
  return null;
end $$;
drop trigger if exists lexa_org_units_cascade on public.lexa_org_units;
create trigger lexa_org_units_cascade after update on public.lexa_org_units
  for each row execute function public.lexa_org_units_cascade();

-- things that hang on a unit (empty = the whole centre)
alter table public.lexa_org_classes add column if not exists unit_id uuid references public.lexa_org_units(id) on delete set null;
alter table public.lexa_org_courses add column if not exists unit_id uuid references public.lexa_org_units(id) on delete set null;
alter table public.lexa_org_students add column if not exists unit_id uuid references public.lexa_org_units(id) on delete set null;
alter table public.lexa_org_members add column if not exists unit_id uuid references public.lexa_org_units(id) on delete set null;
create index if not exists lexa_org_classes_unit_idx on public.lexa_org_classes (unit_id) where unit_id is not null;
create index if not exists lexa_org_courses_unit_idx on public.lexa_org_courses (unit_id) where unit_id is not null;
create index if not exists lexa_org_students_unit_idx on public.lexa_org_students (unit_id) where unit_id is not null;
create index if not exists lexa_org_members_unit_idx on public.lexa_org_members (unit_id) where unit_id is not null;

-- --- roles and grants ---
create table if not exists public.lexa_org_roles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.lexa_orgs(id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,30}$'),
  name text not null check (char_length(name) between 2 and 60),
  description text not null default '' check (char_length(description) <= 300),
  perms text[] not null default '{}'::text[] check (perms <@ public.lexa_org_perm_keys()),
  is_system boolean not null default false,
  base boolean not null default false,
  sort int not null default 100,
  created_by uuid references public.lexa_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, key)
);
create unique index if not exists lexa_org_roles_name_key on public.lexa_org_roles (org_id, lower(name));

create table if not exists public.lexa_org_role_grants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.lexa_orgs(id) on delete cascade,
  user_id uuid not null references public.lexa_profiles(id) on delete cascade,
  role_id uuid not null references public.lexa_org_roles(id) on delete cascade,
  unit_id uuid references public.lexa_org_units(id) on delete cascade,
  expires_at timestamptz,
  note text not null default '' check (char_length(note) <= 200),
  granted_by uuid references public.lexa_profiles(id) on delete set null,
  granted_at timestamptz not null default now()
);
create unique index if not exists lexa_org_role_grants_key on public.lexa_org_role_grants
  (org_id, user_id, role_id, (coalesce(unit_id, '00000000-0000-0000-0000-000000000000'::uuid)));
create index if not exists lexa_org_role_grants_user_idx on public.lexa_org_role_grants (user_id, org_id);
create index if not exists lexa_org_role_grants_role_idx on public.lexa_org_role_grants (role_id);

alter table public.lexa_org_units enable row level security;
alter table public.lexa_org_roles enable row level security;
alter table public.lexa_org_role_grants enable row level security;
-- no client policies: everything goes through the RPCs below
revoke all on public.lexa_org_units, public.lexa_org_roles, public.lexa_org_role_grants from public, anon, authenticated;

-- system roles of a centre follow the templates (custom roles are never touched)
create or replace function public.lexa_org_roles_seed(o uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.lexa_org_roles as r (org_id, key, name, description, perms, is_system, base, sort)
  select o, t.key, t.name, t.description, t.perms, true, t.base, t.sort from public.lexa_org_role_templates() t
  on conflict (org_id, key) do update set
    name = excluded.name, description = excluded.description, perms = excluded.perms,
    base = excluded.base, sort = excluded.sort, updated_at = now()
  where r.is_system and (r.name is distinct from excluded.name or r.description is distinct from excluded.description
    or r.perms is distinct from excluded.perms or r.base is distinct from excluded.base or r.sort is distinct from excluded.sort);
end $$;

create or replace function public.lexa_orgs_seed_roles()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.lexa_org_roles_seed(new.id);
  return null;
end $$;
drop trigger if exists lexa_orgs_seed_roles on public.lexa_orgs;
create trigger lexa_orgs_seed_roles after insert on public.lexa_orgs
  for each row execute function public.lexa_orgs_seed_roles();

-- --- permission checks ---
-- permissions of the caller at a unit (null = the whole centre). A unit of another centre gives nothing.
create or replace function public.lexa_org_perms_at(o uuid, u uuid default null)
returns text[] language plpgsql stable security definer set search_path = public as $$
declare
  v_role text;
  v_base text[] := '{}'::text[];
  v_path uuid[] := '{}'::uuid[];
begin
  if o is null or auth.uid() is null then return '{}'::text[]; end if;
  if public.lexa_is_admin() then return public.lexa_org_perm_keys(); end if;
  select m.role into v_role from public.lexa_org_members m
  where m.org_id = o and m.user_id = auth.uid() and m.status = 'active';
  if v_role is null then return '{}'::text[]; end if;
  if v_role = 'owner' then return public.lexa_org_perm_keys(); end if;
  if u is not null then
    select x.path into v_path from public.lexa_org_units x where x.id = u and x.org_id = o;
    if v_path is null then return '{}'::text[]; end if;
  end if;
  if v_role = 'manager' then
    select t.perms into v_base from public.lexa_org_role_templates() t where t.key = 'manager';
  end if;
  return coalesce((
    select array_agg(distinct z.p order by z.p) from (
      select unnest(coalesce(v_base, '{}'::text[])) as p
      union
      select unnest(r.perms) from public.lexa_org_role_grants g
      join public.lexa_org_roles r on r.id = g.role_id
      where g.org_id = o and g.user_id = auth.uid() and (g.expires_at is null or g.expires_at > now())
        and (g.unit_id is null or g.unit_id = any(v_path))
    ) z), '{}'::text[]);
end $$;

-- every permission the caller holds somewhere in the centre (whole centre or any unit)
create or replace function public.lexa_org_perms_any(o uuid)
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce((
    select array_agg(distinct z.p order by z.p) from (
      select unnest(public.lexa_org_perms_at(o, null)) as p
      union
      select unnest(r.perms) from public.lexa_org_role_grants g
      join public.lexa_org_roles r on r.id = g.role_id
      where g.org_id = o and g.user_id = auth.uid() and (g.expires_at is null or g.expires_at > now())
        and exists (select 1 from public.lexa_org_members m
                    where m.org_id = o and m.user_id = auth.uid() and m.status = 'active')
    ) z), '{}'::text[])
$$;

create or replace function public.lexa_org_can(o uuid, perm text, u uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select perm = any(public.lexa_org_perms_at(o, u))
$$;

create or replace function public.lexa_org_require(o uuid, perm text, u uuid, need_mfa boolean default true)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if public.lexa_is_service() then return; end if;
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not (perm = any(public.lexa_org_perms_at(o, u))) then raise exception 'forbidden: %', perm; end if;
  if need_mfa and not public.lexa_mfa_ok() then raise exception 'mfa required'; end if;
end $$;

-- at least one of the permissions, at least somewhere in the centre
create or replace function public.lexa_org_require_any(o uuid, perms text[], need_mfa boolean default true)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if public.lexa_is_service() then return; end if;
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not (public.lexa_org_perms_any(o) && perms) then
    raise exception 'forbidden: %', array_to_string(perms, '|');
  end if;
  if need_mfa and not public.lexa_mfa_ok() then raise exception 'mfa required'; end if;
end $$;

-- what the console shows to the caller
create or replace function public.lexa_org_my_access(o uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_role text;
  v_admin boolean := public.lexa_is_admin();
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select m.role into v_role from public.lexa_org_members m
  where m.org_id = o and m.user_id = auth.uid() and m.status = 'active';
  if v_role is null and not v_admin then raise exception 'not_staff'; end if;
  return jsonb_build_object(
    'base_role', v_role,
    'platform_admin', v_admin,
    'mfa', public.lexa_mfa_ok(),
    'perms', to_jsonb(public.lexa_org_perms_at(o, null)),
    'perms_any', to_jsonb(public.lexa_org_perms_any(o)),
    'grants', coalesce((
      select jsonb_agg(jsonb_build_object('role', r.name, 'role_key', r.key, 'unit_id', g.unit_id, 'unit', x.name,
                                          'perms', to_jsonb(r.perms), 'expires_at', g.expires_at) order by r.sort, r.name)
      from public.lexa_org_role_grants g
      join public.lexa_org_roles r on r.id = g.role_id
      left join public.lexa_org_units x on x.id = g.unit_id
      where g.org_id = o and g.user_id = auth.uid() and (g.expires_at is null or g.expires_at > now())), '[]'::jsonb)
  );
end $$;

-- internal: active classes / students of a set of units (null = whole centre)
create or replace function public.lexa_org_scope_classes(o uuid, units uuid[])
returns setof public.lexa_org_classes language sql stable security definer set search_path = public as $$
  select c.* from public.lexa_org_classes c
  where c.org_id = o and c.status = 'active' and (units is null or c.unit_id = any(units))
$$;
create or replace function public.lexa_org_scope_students(o uuid, units uuid[])
returns setof public.lexa_org_students language sql stable security definer set search_path = public as $$
  select s.* from public.lexa_org_students s
  where s.org_id = o and (units is null or s.unit_id = any(units))
$$;

-- --- organisation tree RPCs ---
-- any active member of the centre may read the structure
create or replace function public.lexa_org_unit_tree(o uuid)
returns table (id uuid, parent_id uuid, kind text, name text, code text, sort int, status text, depth int,
               classes int, courses int, students int, staff int, grants int, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not (public.lexa_is_admin() or public.lexa_org_active_member(o)) then raise exception 'not_staff'; end if;
  return query
    select u.id, u.parent_id, u.kind, u.name, u.code, u.sort, u.status, u.depth,
      (select count(*)::int from public.lexa_org_classes c where c.unit_id = u.id and c.status = 'active'),
      (select count(*)::int from public.lexa_org_courses c where c.unit_id = u.id),
      (select count(*)::int from public.lexa_org_students s where s.unit_id = u.id and s.status = 'active'),
      (select count(*)::int from public.lexa_org_members m
        where m.org_id = o and m.unit_id = u.id and m.status = 'active'),
      (select count(*)::int from public.lexa_org_role_grants g
        where g.unit_id = u.id and (g.expires_at is null or g.expires_at > now())),
      u.created_at
    from public.lexa_org_units u
    where u.org_id = o
    order by u.depth, u.sort, u.name;
end $$;

-- create (u_id null) or edit / move a unit. Moving needs the right at the old and the new place.
create or replace function public.lexa_org_unit_save(o uuid, u_id uuid, p_parent uuid, p_kind text, p_name text,
                                                     p_code text default '', p_sort int default 0)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  cur public.lexa_org_units;
  v_id uuid;
  v_name text := trim(coalesce(p_name, ''));
  v_code text := lower(trim(coalesce(p_code, '')));
begin
  if char_length(v_name) not between 1 and 80 then raise exception 'bad unit name'; end if;
  if v_code <> '' and v_code !~ '^[a-z0-9][a-z0-9._-]{0,29}$' then raise exception 'bad unit code'; end if;
  if coalesce(p_kind, '') not in ('faculty', 'department', 'program', 'branch', 'track', 'section', 'other') then
    raise exception 'bad unit kind';
  end if;
  if p_parent is not null and not exists (
    select 1 from public.lexa_org_units where id = p_parent and org_id = o and status = 'active') then
    raise exception 'parent unit not found';
  end if;
  perform set_config('lexa.audit_ok', '1', true);
  if u_id is null then
    perform public.lexa_org_require(o, 'org.units.manage', p_parent, true);
    if (select count(*) from public.lexa_org_units where org_id = o) >= 500 then raise exception 'too many units'; end if;
    insert into public.lexa_org_units (org_id, parent_id, kind, name, code, sort, created_by)
    values (o, p_parent, p_kind, v_name, v_code, coalesce(p_sort, 0), auth.uid())
    returning id into v_id;
    perform public.lexa_audit(o, 'unit.create', v_id,
      jsonb_build_object('name', v_name, 'kind', p_kind, 'parent', p_parent));
    return v_id;
  end if;
  select * into cur from public.lexa_org_units where id = u_id and org_id = o;
  if cur.id is null then raise exception 'unit not found'; end if;
  perform public.lexa_org_require(o, 'org.units.manage', u_id, true);
  if p_parent is distinct from cur.parent_id then
    perform public.lexa_org_require(o, 'org.units.manage', cur.parent_id, true);
    perform public.lexa_org_require(o, 'org.units.manage', p_parent, true);
  end if;
  update public.lexa_org_units set parent_id = p_parent, kind = p_kind, name = v_name, code = v_code,
    sort = coalesce(p_sort, cur.sort)
  where id = u_id;
  perform public.lexa_audit(o, case when p_parent is distinct from cur.parent_id then 'unit.move' else 'unit.update' end, u_id,
    jsonb_build_object('name', v_name, 'old_name', cur.name, 'kind', p_kind, 'old_kind', cur.kind,
                       'parent', p_parent, 'old_parent', cur.parent_id, 'code', v_code));
  return u_id;
exception when unique_violation then
  raise exception 'unit code taken';
end $$;

-- archive / restore (needs the right one level up: a branch head cannot archive their own branch)
create or replace function public.lexa_org_unit_status(u uuid, archive boolean, reason text default '')
returns text language plpgsql security definer set search_path = public as $$
declare cur public.lexa_org_units;
begin
  select * into cur from public.lexa_org_units where id = u;
  if cur.id is null then raise exception 'unit not found'; end if;
  perform public.lexa_org_require(cur.org_id, 'org.units.manage', cur.parent_id, true);
  if archive then
    if exists (select 1 from public.lexa_org_units where parent_id = u and status = 'active') then
      raise exception 'unit has active sub-units';
    end if;
  elsif cur.parent_id is not null and exists (
    select 1 from public.lexa_org_units where id = cur.parent_id and status = 'archived') then
    raise exception 'parent unit is archived';
  end if;
  update public.lexa_org_units set status = case when archive then 'archived' else 'active' end where id = u;
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(cur.org_id, case when archive then 'unit.archive' else 'unit.restore' end, u,
    jsonb_build_object('name', cur.name, 'reason', left(coalesce(reason, ''), 300)));
  return 'ok';
end $$;

-- delete an empty unit only (no sub-units, classes, subjects, students, staff or grants)
create or replace function public.lexa_org_unit_delete(u uuid, reason text default '')
returns text language plpgsql security definer set search_path = public as $$
declare cur public.lexa_org_units;
begin
  select * into cur from public.lexa_org_units where id = u;
  if cur.id is null then raise exception 'unit not found'; end if;
  perform public.lexa_org_require(cur.org_id, 'org.units.manage', cur.parent_id, true);
  if exists (select 1 from public.lexa_org_units where parent_id = u)
     or exists (select 1 from public.lexa_org_classes where unit_id = u)
     or exists (select 1 from public.lexa_org_courses where unit_id = u)
     or exists (select 1 from public.lexa_org_students where unit_id = u)
     or exists (select 1 from public.lexa_org_members where unit_id = u and status in ('active', 'invited', 'requested'))
     or exists (select 1 from public.lexa_org_role_grants where unit_id = u) then
    raise exception 'unit not empty';
  end if;
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(cur.org_id, 'unit.delete', u,
    jsonb_build_object('name', cur.name, 'kind', cur.kind, 'reason', left(coalesce(reason, ''), 300)));
  delete from public.lexa_org_units where id = u;
  return 'ok';
end $$;

-- a ready starting tree for an empty centre
create or replace function public.lexa_org_unit_preset(o uuid, preset text)
returns int language plpgsql security definer set search_path = public as $$
declare
  a uuid;
  b uuid;
  n int;
begin
  perform public.lexa_org_require(o, 'org.units.manage', null, true);
  if exists (select 1 from public.lexa_org_units where org_id = o) then raise exception 'tree not empty'; end if;
  if preset = 'university' then
    insert into public.lexa_org_units (org_id, kind, name, sort, created_by)
      values (o, 'faculty', 'دانشکده‌ی حقوق', 10, auth.uid()) returning id into a;
    insert into public.lexa_org_units (org_id, parent_id, kind, name, sort, created_by)
      values (o, a, 'department', 'گروه حقوق خصوصی', 10, auth.uid()) returning id into b;
    insert into public.lexa_org_units (org_id, parent_id, kind, name, sort, created_by) values
      (o, b, 'program', 'کارشناسی حقوق', 10, auth.uid()),
      (o, b, 'program', 'کارشناسی ارشد حقوق خصوصی', 20, auth.uid());
    insert into public.lexa_org_units (org_id, parent_id, kind, name, sort, created_by) values
      (o, a, 'department', 'گروه حقوق عمومی', 20, auth.uid()),
      (o, a, 'department', 'گروه حقوق جزا و جرم‌شناسی', 30, auth.uid());
  elsif preset = 'institute' then
    insert into public.lexa_org_units (org_id, kind, name, sort, created_by)
      values (o, 'branch', 'شعبه‌ی مرکزی', 10, auth.uid()) returning id into a;
    insert into public.lexa_org_units (org_id, parent_id, kind, name, sort, created_by)
      values (o, a, 'track', 'دوره‌ی جامع آزمون وکالت', 10, auth.uid()) returning id into b;
    insert into public.lexa_org_units (org_id, parent_id, kind, name, sort, created_by) values
      (o, b, 'section', 'گروه صبح', 10, auth.uid()),
      (o, b, 'section', 'گروه عصر', 20, auth.uid());
    insert into public.lexa_org_units (org_id, parent_id, kind, name, sort, created_by)
      values (o, a, 'track', 'دوره‌ی آزمون قضاوت', 20, auth.uid());
  else
    raise exception 'bad preset';
  end if;
  select count(*)::int into n from public.lexa_org_units where org_id = o;
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(o, 'unit.preset', null, jsonb_build_object('preset', preset, 'units', n));
  return n;
end $$;

-- items that can be placed on units, limited to what the caller may move
-- p_kind: class | course | student | member
create or replace function public.lexa_org_unit_items(o uuid, p_kind text)
returns table (id uuid, title text, sub text, unit_id uuid, status text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare v_all boolean;
begin
  perform public.lexa_org_require_any(o, array['org.units.manage'], true);
  v_all := public.lexa_org_can(o, 'org.units.manage', null);
  if p_kind = 'class' then
    return query
      select c.id, coalesce(nullif(c.title, ''), s.title),
        concat_ws(' · ', nullif(s.code, ''), t.title, nullif(coalesce(nullif(p.display_name, ''), p.username), '')),
        c.unit_id, c.status
      from public.lexa_org_classes c
      join public.lexa_org_courses s on s.id = c.course_id
      join public.lexa_org_terms t on t.id = c.term_id
      left join public.lexa_profiles p on p.id = c.teacher_id
      where c.org_id = o and c.status = 'active'
        and (v_all or (c.unit_id is not null and public.lexa_org_can(o, 'org.units.manage', c.unit_id)))
      order by t.created_at desc, 2
      limit 3000;
  elsif p_kind = 'course' then
    return query
      select s.id, s.title, nullif(s.code, ''), s.unit_id, 'active'::text
      from public.lexa_org_courses s
      where s.org_id = o
        and (v_all or (s.unit_id is not null and public.lexa_org_can(o, 'org.units.manage', s.unit_id)))
      order by s.title
      limit 3000;
  elsif p_kind = 'student' then
    return query
      select s.id, coalesce(nullif(s.full_name, ''), s.org_username),
        concat_ws(' · ', s.org_username, nullif(s.student_no, ''), nullif(s.field, ''), nullif(s.entry_year, '')),
        s.unit_id, s.status
      from public.lexa_org_students s
      where s.org_id = o and s.status in ('active', 'suspended')
        and (v_all or (s.unit_id is not null and public.lexa_org_can(o, 'org.units.manage', s.unit_id)))
      order by 2
      limit 3000;
  elsif p_kind = 'member' then
    return query
      select m.user_id, coalesce(nullif(p.display_name, ''), p.username),
        concat_ws(' · ', '@' || p.username, nullif(m.title, '')), m.unit_id, m.status
      from public.lexa_org_members m
      join public.lexa_profiles p on p.id = m.user_id
      where m.org_id = o and m.status in ('active', 'invited')
        and (v_all or (m.unit_id is not null and public.lexa_org_can(o, 'org.units.manage', m.unit_id)))
      order by 2
      limit 3000;
  else
    raise exception 'bad kind';
  end if;
end $$;

-- place items on a unit (u null = back to the whole centre). Needs the right at the target and at
-- each item's current place.
create or replace function public.lexa_org_unit_assign(o uuid, p_kind text, ids uuid[], u uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_all boolean;
  v_bad int;
  n int := 0;
begin
  if coalesce(cardinality(ids), 0) = 0 then return 0; end if;
  if cardinality(ids) > 500 then raise exception 'too many items'; end if;
  if p_kind not in ('class', 'course', 'student', 'member') then raise exception 'bad kind'; end if;
  if u is not null and not exists (
    select 1 from public.lexa_org_units where id = u and org_id = o and status = 'active') then
    raise exception 'unit not found';
  end if;
  perform public.lexa_org_require(o, 'org.units.manage', u, true);
  v_all := public.lexa_org_can(o, 'org.units.manage', null);
  if not v_all then
    select count(*)::int into v_bad from (
      select c.unit_id from public.lexa_org_classes c where p_kind = 'class' and c.org_id = o and c.id = any(ids)
      union all
      select s.unit_id from public.lexa_org_courses s where p_kind = 'course' and s.org_id = o and s.id = any(ids)
      union all
      select s.unit_id from public.lexa_org_students s where p_kind = 'student' and s.org_id = o and s.id = any(ids)
      union all
      select m.unit_id from public.lexa_org_members m where p_kind = 'member' and m.org_id = o and m.user_id = any(ids)
    ) x
    where x.unit_id is null or not public.lexa_org_can(o, 'org.units.manage', x.unit_id);
    if v_bad > 0 then raise exception 'forbidden: org.units.manage'; end if;
  end if;
  if p_kind = 'class' then
    update public.lexa_org_classes set unit_id = u where org_id = o and id = any(ids) and unit_id is distinct from u;
  elsif p_kind = 'course' then
    update public.lexa_org_courses set unit_id = u where org_id = o and id = any(ids) and unit_id is distinct from u;
  elsif p_kind = 'student' then
    update public.lexa_org_students set unit_id = u where org_id = o and id = any(ids) and unit_id is distinct from u;
  else
    update public.lexa_org_members set unit_id = u where org_id = o and user_id = any(ids) and unit_id is distinct from u;
  end if;
  get diagnostics n = row_count;
  if n > 0 then
    perform set_config('lexa.audit_ok', '1', true);
    perform public.lexa_audit(o, 'unit.assign', u, jsonb_build_object('kind', p_kind, 'count', n));
  end if;
  return n;
end $$;

-- --- roles RPCs ---
create or replace function public.lexa_org_role_list(o uuid)
returns table (id uuid, key text, name text, description text, perms text[], is_system boolean, base boolean,
               sort int, holders int, updated_at timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.lexa_org_require_any(o, array['org.roles.manage', 'org.members.manage'], true);
  perform public.lexa_org_roles_seed(o);
  return query
    select r.id, r.key, r.name, r.description, r.perms, r.is_system, r.base, r.sort,
      case when r.base then
        (select count(*)::int from public.lexa_org_members m where m.org_id = o and m.role = r.key and m.status = 'active')
      else
        (select count(distinct g.user_id)::int from public.lexa_org_role_grants g
         where g.role_id = r.id and (g.expires_at is null or g.expires_at > now()))
      end,
      r.updated_at
    from public.lexa_org_roles r
    where r.org_id = o
    order by r.is_system desc, r.sort, r.name;
end $$;

-- create (r_id null) or change a custom role. Only permissions the caller holds centre-wide.
create or replace function public.lexa_org_role_save(o uuid, r_id uuid, p_name text, p_description text,
                                                     p_perms text[], reason text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  cur public.lexa_org_roles;
  v_name text := trim(coalesce(p_name, ''));
  v_perms text[];
  v_mine text[];
  v_id uuid;
begin
  perform public.lexa_org_require(o, 'org.roles.manage', null, true);
  perform public.lexa_org_roles_seed(o);
  if char_length(v_name) not between 2 and 60 then raise exception 'bad role name'; end if;
  select coalesce(array_agg(distinct p order by p), '{}'::text[]) into v_perms
  from unnest(coalesce(p_perms, '{}'::text[])) as p;
  if not v_perms <@ public.lexa_org_perm_keys() then raise exception 'unknown permission'; end if;
  v_mine := public.lexa_org_perms_at(o, null);
  if not public.lexa_is_service() and not v_perms <@ v_mine then
    raise exception 'cannot give permissions you do not have';
  end if;
  perform set_config('lexa.audit_ok', '1', true);
  if r_id is null then
    if (select count(*) from public.lexa_org_roles where org_id = o and not is_system) >= 40 then
      raise exception 'too many roles';
    end if;
    insert into public.lexa_org_roles (org_id, key, name, description, perms, created_by)
    values (o, 'c_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10), v_name,
            left(coalesce(p_description, ''), 300), v_perms, auth.uid())
    returning id into v_id;
    perform public.lexa_audit(o, 'role.create', v_id,
      jsonb_build_object('name', v_name, 'perms', to_jsonb(v_perms), 'reason', left(coalesce(reason, ''), 300)));
    return v_id;
  end if;
  select * into cur from public.lexa_org_roles where id = r_id and org_id = o;
  if cur.id is null then raise exception 'role not found'; end if;
  if cur.is_system then raise exception 'system roles cannot be changed'; end if;
  if not public.lexa_is_service() and not cur.perms <@ v_mine then
    raise exception 'cannot change a role stronger than yours';
  end if;
  update public.lexa_org_roles set name = v_name, description = left(coalesce(p_description, ''), 300),
    perms = v_perms, updated_at = now()
  where id = r_id;
  perform public.lexa_audit(o, 'role.update', r_id, jsonb_build_object(
    'name', v_name, 'old_name', cur.name,
    'added', to_jsonb(array(select unnest(v_perms) except select unnest(cur.perms))),
    'removed', to_jsonb(array(select unnest(cur.perms) except select unnest(v_perms))),
    'reason', left(coalesce(reason, ''), 300)));
  return r_id;
exception when unique_violation then
  raise exception 'role name taken';
end $$;

-- delete a custom role and every grant of it
create or replace function public.lexa_org_role_delete(o uuid, r_id uuid, reason text default '')
returns int language plpgsql security definer set search_path = public as $$
declare
  cur public.lexa_org_roles;
  n int;
begin
  perform public.lexa_org_require(o, 'org.roles.manage', null, true);
  select * into cur from public.lexa_org_roles where id = r_id and org_id = o;
  if cur.id is null then raise exception 'role not found'; end if;
  if cur.is_system then raise exception 'system roles cannot be changed'; end if;
  if not public.lexa_is_service() and not cur.perms <@ public.lexa_org_perms_at(o, null) then
    raise exception 'cannot change a role stronger than yours';
  end if;
  select count(*)::int into n from public.lexa_org_role_grants where role_id = r_id;
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(o, 'role.delete', r_id, jsonb_build_object(
    'name', cur.name, 'perms', to_jsonb(cur.perms), 'grants', n, 'reason', left(coalesce(reason, ''), 300)));
  delete from public.lexa_org_roles where id = r_id;
  return n;
end $$;

-- --- grants RPCs ---
create or replace function public.lexa_org_grant_list(o uuid)
returns table (id uuid, user_id uuid, username text, display_name text, avatar_url text, role_id uuid, role_key text,
               role_name text, unit_id uuid, unit_name text, expires_at timestamptz, expired boolean, note text,
               granted_by_name text, granted_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare v_all boolean;
begin
  perform public.lexa_org_require_any(o, array['org.roles.manage', 'org.members.manage'], true);
  v_all := public.lexa_org_perms_at(o, null) && array['org.roles.manage', 'org.members.manage'];
  return query
    select g.id, g.user_id, p.username, p.display_name, p.avatar_url, g.role_id, r.key, r.name, g.unit_id, x.name,
      g.expires_at, (g.expires_at is not null and g.expires_at <= now()), g.note,
      coalesce(nullif(b.display_name, ''), b.username), g.granted_at
    from public.lexa_org_role_grants g
    join public.lexa_org_roles r on r.id = g.role_id
    join public.lexa_profiles p on p.id = g.user_id
    left join public.lexa_org_units x on x.id = g.unit_id
    left join public.lexa_profiles b on b.id = g.granted_by
    where g.org_id = o
      and (v_all or (g.unit_id is not null
           and public.lexa_org_perms_at(o, g.unit_id) && array['org.roles.manage', 'org.members.manage']))
    order by p.display_name, r.sort, r.name;
end $$;

-- give a role to a member (active or invited), for the whole centre (u null) or one unit
create or replace function public.lexa_org_grant(o uuid, uid uuid, r_id uuid, u uuid default null,
                                                 p_expires timestamptz default null, p_note text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r public.lexa_org_roles;
  m record;
  v_id uuid;
begin
  perform public.lexa_org_require(o, 'org.roles.manage', u, true);
  if u is not null and not exists (
    select 1 from public.lexa_org_units where id = u and org_id = o and status = 'active') then
    raise exception 'unit not found';
  end if;
  perform public.lexa_org_roles_seed(o);
  select * into r from public.lexa_org_roles where id = r_id and org_id = o;
  if r.id is null then raise exception 'role not found'; end if;
  if r.base then raise exception 'base roles are set on the membership'; end if;
  if not public.lexa_is_service() and not r.perms <@ public.lexa_org_perms_at(o, u) then
    raise exception 'cannot give permissions you do not have';
  end if;
  select mm.role, mm.status into m from public.lexa_org_members mm where mm.org_id = o and mm.user_id = uid;
  if m.status is null or m.status not in ('active', 'invited') then raise exception 'member not found'; end if;
  if m.role = 'owner' then raise exception 'the owner already has every permission'; end if;
  if uid = auth.uid() and not public.lexa_is_admin() then raise exception 'cannot grant yourself'; end if;
  if p_expires is not null and (p_expires <= now() or p_expires > now() + interval '3 years') then
    raise exception 'bad expiry';
  end if;
  if (select count(*) from public.lexa_org_role_grants where org_id = o and user_id = uid) >= 30 then
    raise exception 'too many grants';
  end if;
  insert into public.lexa_org_role_grants (org_id, user_id, role_id, unit_id, expires_at, note, granted_by)
  values (o, uid, r_id, u, p_expires, left(coalesce(p_note, ''), 200), auth.uid())
  on conflict (org_id, user_id, role_id, (coalesce(unit_id, '00000000-0000-0000-0000-000000000000'::uuid)))
  do update set expires_at = excluded.expires_at, note = excluded.note, granted_by = excluded.granted_by,
    granted_at = now()
  returning id into v_id;
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(o, 'role.grant', uid, jsonb_build_object(
    'role', r.key, 'role_name', r.name, 'unit', u, 'expires_at', p_expires, 'note', left(coalesce(p_note, ''), 200)));
  return v_id;
end $$;

create or replace function public.lexa_org_grant_revoke(g uuid, reason text default '')
returns text language plpgsql security definer set search_path = public as $$
declare
  cur public.lexa_org_role_grants;
  r public.lexa_org_roles;
begin
  select * into cur from public.lexa_org_role_grants where id = g;
  if cur.id is null then raise exception 'grant not found'; end if;
  perform public.lexa_org_require(cur.org_id, 'org.roles.manage', cur.unit_id, true);
  select * into r from public.lexa_org_roles where id = cur.role_id;
  if not public.lexa_is_service() and cur.user_id <> auth.uid()
     and not r.perms <@ public.lexa_org_perms_at(cur.org_id, cur.unit_id) then
    raise exception 'cannot change a role stronger than yours';
  end if;
  delete from public.lexa_org_role_grants where id = g;
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(cur.org_id, 'role.revoke', cur.user_id, jsonb_build_object(
    'role', r.key, 'role_name', r.name, 'unit', cur.unit_id, 'reason', left(coalesce(reason, ''), 300)));
  return 'ok';
end $$;

-- --- staff RPCs ---
create or replace function public.lexa_org_staff(o uuid)
returns table (user_id uuid, username text, display_name text, avatar_url text, base_role text, status text,
               title text, unit_id uuid, unit_name text, since timestamptz, last_sign_in_at timestamptz,
               mfa boolean, grants int, classes int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.lexa_org_require_any(o, array['org.members.manage', 'org.roles.manage'], true);
  return query
    select m.user_id, p.username, p.display_name, p.avatar_url, m.role, m.status, m.title, m.unit_id, x.name,
      m.created_at, au.last_sign_in_at,
      exists (select 1 from auth.mfa_factors f where f.user_id = m.user_id and f.status = 'verified'),
      (select count(*)::int from public.lexa_org_role_grants g
        where g.org_id = o and g.user_id = m.user_id and (g.expires_at is null or g.expires_at > now())),
      (select count(*)::int from public.lexa_org_classes c
        where c.org_id = o and c.teacher_id = m.user_id and c.status = 'active')
    from public.lexa_org_members m
    join public.lexa_profiles p on p.id = m.user_id
    left join auth.users au on au.id = m.user_id
    left join public.lexa_org_units x on x.id = m.unit_id
    where m.org_id = o and m.status in ('active', 'invited', 'requested')
    order by case m.role when 'owner' then 0 when 'manager' then 1 when 'staff' then 2 else 3 end,
      coalesce(nullif(p.display_name, ''), p.username);
end $$;

-- invite a person as staff (no teacher seat); optionally give a role at once
create or replace function public.lexa_org_staff_invite(o uuid, uid uuid, p_title text default '', r_id uuid default null,
                                                        u uuid default null, p_expires timestamptz default null)
returns text language plpgsql security definer set search_path = public as $$
declare cur record;
begin
  perform public.lexa_org_require(o, 'org.members.manage', u, true);
  if not public.lexa_org_active(o) then raise exception 'organisation panel is not active'; end if;
  if not exists (select 1 from public.lexa_profiles where id = uid) then raise exception 'user not found'; end if;
  if u is not null and not exists (
    select 1 from public.lexa_org_units where id = u and org_id = o and status = 'active') then
    raise exception 'unit not found';
  end if;
  select * into cur from public.lexa_org_members where org_id = o and user_id = uid;
  if cur.user_id is not null and cur.status in ('active', 'invited', 'requested') then
    raise exception 'already a member';
  end if;
  if (select count(*) from public.lexa_org_members
      where org_id = o and role = 'staff' and status in ('active', 'invited')) >= 200 then
    raise exception 'too many staff';
  end if;
  insert into public.lexa_org_members as mm (org_id, user_id, role, status, title, message, invited_by, unit_id)
  values (o, uid, 'staff', 'invited', left(coalesce(p_title, ''), 80), '', auth.uid(), u)
  on conflict (org_id, user_id) do update set
    role = case when mm.role = 'owner' then 'owner' else 'staff' end, status = 'invited',
    title = excluded.title, message = '', invited_by = excluded.invited_by, unit_id = excluded.unit_id;
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(o, 'staff.invite', uid, jsonb_build_object('title', left(coalesce(p_title, ''), 80), 'unit', u));
  if r_id is not null then
    perform public.lexa_org_grant(o, uid, r_id, u, p_expires, '');
  end if;
  return 'invited';
end $$;

-- title and home unit of a member
create or replace function public.lexa_org_staff_update(o uuid, uid uuid, p_title text, p_unit uuid)
returns text language plpgsql security definer set search_path = public as $$
declare cur record;
begin
  select * into cur from public.lexa_org_members where org_id = o and user_id = uid;
  if cur.user_id is null or cur.status not in ('active', 'invited', 'requested') then raise exception 'member not found'; end if;
  perform public.lexa_org_require(o, 'org.members.manage', cur.unit_id, true);
  if p_unit is distinct from cur.unit_id then
    if p_unit is not null and not exists (
      select 1 from public.lexa_org_units where id = p_unit and org_id = o and status = 'active') then
      raise exception 'unit not found';
    end if;
    perform public.lexa_org_require(o, 'org.members.manage', p_unit, true);
  end if;
  if cur.role = 'owner' and uid <> auth.uid() and not public.lexa_is_admin() then
    raise exception 'the owner cannot be changed';
  end if;
  update public.lexa_org_members set title = left(coalesce(p_title, title), 80), unit_id = p_unit
  where org_id = o and user_id = uid;
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(o, 'staff.update', uid, jsonb_build_object(
    'title', left(coalesce(p_title, ''), 80), 'unit', p_unit, 'old_unit', cur.unit_id));
  return 'ok';
end $$;

-- base role (manager / teacher / staff): owner or Lexa admin only, like before, now with reason and audit
create or replace function public.lexa_org_set_base_role(o uuid, uid uuid, p_role text, reason text default '')
returns text language plpgsql security definer set search_path = public as $$
declare cur record;
begin
  if not (public.lexa_is_admin() or exists (
    select 1 from public.lexa_org_members
    where org_id = o and user_id = auth.uid() and role = 'owner' and status = 'active')) then
    raise exception 'only the owner can change base roles';
  end if;
  if not public.lexa_mfa_ok() then raise exception 'mfa required'; end if;
  if p_role not in ('manager', 'teacher', 'staff') then raise exception 'bad role'; end if;
  select * into cur from public.lexa_org_members where org_id = o and user_id = uid;
  if cur.user_id is null or cur.status not in ('active', 'invited') then raise exception 'member not found'; end if;
  if cur.role = 'owner' then raise exception 'the owner cannot be changed'; end if;
  if cur.role = p_role then return 'ok'; end if;
  if p_role = 'teacher' and public.lexa_org_seats_used(o) >= (select seats from public.lexa_orgs where id = o) then
    raise exception 'no free seats';
  end if;
  update public.lexa_org_members set role = p_role where org_id = o and user_id = uid;
  if p_role = 'teacher' and cur.status = 'active' then perform public.lexa_promote_member(o, uid); end if;
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(o, 'member.base_role', uid, jsonb_build_object(
    'from', cur.role, 'to', p_role, 'reason', left(coalesce(reason, ''), 300)));
  return 'ok';
end $$;

-- remove a member from the centre: membership, every grant, links of their posts / courses
create or replace function public.lexa_org_staff_remove(o uuid, uid uuid, reason text default '')
returns text language plpgsql security definer set search_path = public as $$
declare
  cur record;
  n int;
begin
  select * into cur from public.lexa_org_members where org_id = o and user_id = uid;
  if cur.user_id is null or cur.status not in ('active', 'invited', 'requested') then raise exception 'member not found'; end if;
  if cur.role = 'owner' then raise exception 'the owner cannot be removed'; end if;
  if uid = auth.uid() then raise exception 'cannot remove yourself'; end if;
  perform public.lexa_org_require(o, 'org.members.manage', cur.unit_id, true);
  if cur.role = 'manager' and not (public.lexa_is_admin() or exists (
    select 1 from public.lexa_org_members
    where org_id = o and user_id = auth.uid() and role = 'owner' and status = 'active')) then
    raise exception 'only the owner can remove a manager';
  end if;
  update public.lexa_org_members set status = 'removed' where org_id = o and user_id = uid;
  delete from public.lexa_org_role_grants where org_id = o and user_id = uid;
  get diagnostics n = row_count;
  update public.lexa_posts set org_id = null where org_id = o and author_id = uid;
  update public.lexa_tcourses set org_id = null where org_id = o and teacher_id = uid;
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(o, 'member.remove', uid, jsonb_build_object(
    'role', cur.role, 'grants', n, 'reason', left(coalesce(reason, ''), 300)));
  return 'removed';
end $$;

-- --- centre home: KPIs, to-do list, 30-day study trend, units breakdown, recent activity ---
-- u = a unit: every number is limited to that unit and everything under it
create or replace function public.lexa_org_home(o uuid, u uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := public.lexa_tehran_today();
  v_units uuid[];
  v_org record;
  v_main jsonb;
  v_todo jsonb := '[]'::jsonb;
  v_recent jsonb := '[]'::jsonb;
  v_scope jsonb;
  v_wide boolean;
  v_n int;
  v_s jsonb;
begin
  perform public.lexa_org_require(o, 'org.reports.read', u, true);
  select x.id, x.name, x.seats, x.student_seats, x.expires_at, x.status into v_org from public.lexa_orgs x where x.id = o;
  if v_org.id is null then raise exception 'organisation not found'; end if;
  v_wide := u is null;
  if u is not null then
    select array_agg(x.id) into v_units from public.lexa_org_units x where x.org_id = o and u = any(x.path);
    if v_units is null then raise exception 'unit not found'; end if;
    select jsonb_build_object('unit_id', x.id, 'name', x.name, 'kind', x.kind,
      'path', (select jsonb_agg(y.name order by y.depth) from public.lexa_org_units y where y.id = any(x.path)))
    into v_scope from public.lexa_org_units x where x.id = u;
  end if;

  with st as (
    select s.id, s.user_id, s.status, s.unit_id, s.terms_accepted_at,
      public.lexa_official_day(s) as d0, coalesce(s.left_at, v_today) as d1
    from public.lexa_org_scope_students(o, v_units) s
  ), dd as (
    select d.user_id, st.unit_id, d.day, d.seconds
    from public.lexa_study_daily d
    join st on st.user_id = d.user_id and st.terms_accepted_at is not null and d.day between st.d0 and st.d1
    where d.day > v_today - 30
  ), cl as (
    select c.id, c.teacher_id, c.term_id, c.unit_id from public.lexa_org_scope_classes(o, v_units) c
  ), cur_cl as (
    select cl.* from cl join public.lexa_org_terms t on t.id = cl.term_id where t.status = 'current'
  ), un as (
    select x.id, x.path from public.lexa_org_units x where x.org_id = o
  )
  select jsonb_build_object(
    'kpis', jsonb_build_object(
      'students', (select count(*) from st where st.status = 'active'),
      'students_pending', (select count(*) from st where st.status = 'active'
                            and (st.user_id is null or st.terms_accepted_at is null)),
      'student_seats', v_org.student_seats,
      'students_used', public.lexa_org_students_used(o),
      'teachers', case when v_wide
        then (select count(*) from public.lexa_org_members m where m.org_id = o and m.role = 'teacher' and m.status = 'active')
        else (select count(distinct cl.teacher_id) from cl where cl.teacher_id is not null) end,
      'teacher_seats', v_org.seats,
      'teachers_used', public.lexa_org_seats_used(o),
      'staff', (select count(*) from public.lexa_org_members m
                where m.org_id = o and m.status = 'active' and m.role in ('owner', 'manager', 'staff')
                  and (v_wide or m.unit_id = any(v_units))),
      'classes', (select count(*) from cl),
      'classes_current', (select count(*) from cur_cl),
      'learners_7d', (select count(distinct dd.user_id) from dd where dd.day > v_today - 7 and dd.seconds > 0),
      'seconds_7d', (select coalesce(sum(dd.seconds), 0) from dd where dd.day > v_today - 7),
      'seconds_prev_7d', (select coalesce(sum(dd.seconds), 0) from dd where dd.day <= v_today - 7 and dd.day > v_today - 14),
      'seconds_30d', (select coalesce(sum(dd.seconds), 0) from dd),
      'exams_open', (select count(*) from public.lexa_org_exams x join cl on cl.id = x.class_id
                     where x.status = 'published' and x.starts_at <= now() and x.ends_at > now()),
      'exams_next_7d', (select count(*) from public.lexa_org_exams x join cl on cl.id = x.class_id
                        where x.status = 'published' and x.starts_at > now() and x.starts_at <= now() + interval '7 days'),
      'grades_30d', (select count(*) from public.lexa_org_grades r join cl on cl.id = r.class_id
                     where r.updated_at > now() - interval '30 days'),
      'avg_final', (select round(avg(r.score / r.max_score * 20), 2) from public.lexa_org_grades r
                    join cur_cl on cur_cl.id = r.class_id where r.component = 'final'),
      'invites_pending', (select count(*) from public.lexa_org_members m where m.org_id = o and m.status = 'invited'
                          and (v_wide or m.unit_id = any(v_units))),
      'requests_pending', (select count(*) from public.lexa_org_members m where m.org_id = o and m.status = 'requested'),
      'units', (select count(*) from public.lexa_org_units x where x.org_id = o and x.status = 'active'
                and (v_wide or x.id = any(v_units)))
    ),
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object('day', z.day, 'seconds', coalesce(a.s, 0), 'users', coalesce(a.n, 0))
                                order by z.day), '[]'::jsonb)
      from (select v_today - 29 + i as day from generate_series(0, 29) as i) z
      left join (select dd.day, sum(dd.seconds) as s, count(distinct dd.user_id) filter (where dd.seconds > 0) as n
                 from dd group by dd.day) a on a.day = z.day
    ),
    'breakdown', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'name', x.name, 'kind', x.kind,
        'students', (select count(*) from st where st.status = 'active'
                     and st.unit_id in (select y.id from un y where x.id = any(y.path))),
        'classes', (select count(*) from cl where cl.unit_id in (select y.id from un y where x.id = any(y.path))),
        'learners_7d', (select count(distinct dd.user_id) from dd where dd.day > v_today - 7 and dd.seconds > 0
                        and dd.unit_id in (select y.id from un y where x.id = any(y.path))),
        'seconds_7d', (select coalesce(sum(dd.seconds), 0) from dd where dd.day > v_today - 7
                       and dd.unit_id in (select y.id from un y where x.id = any(y.path)))
      ) order by x.sort, x.name)
      from public.lexa_org_units x
      where x.org_id = o and x.status = 'active' and x.parent_id is not distinct from u), '[]'::jsonb),
    'unassigned', case when v_wide then jsonb_build_object(
        'students', (select count(*) from st where st.status = 'active' and st.unit_id is null),
        'classes', (select count(*) from cl where cl.unit_id is null)) else null end
  ) into v_main;

  -- to-do list (each entry: kind, count, up to 5 samples)
  select count(*)::int, coalesce(jsonb_agg(jsonb_build_object('id', z.id, 'title', z.t)) filter (where z.rn <= 5), '[]'::jsonb)
  into v_n, v_s from (
    select c.id, coalesce(nullif(c.title, ''), k.title) as t, row_number() over (order by c.created_at desc) as rn
    from public.lexa_org_scope_classes(o, v_units) c join public.lexa_org_courses k on k.id = c.course_id
    join public.lexa_org_terms t on t.id = c.term_id
    where c.teacher_id is null and t.status <> 'closed') z;
  if v_n > 0 then v_todo := v_todo || jsonb_build_array(jsonb_build_object('kind', 'classes_no_teacher', 'count', v_n, 'items', v_s)); end if;

  select count(*)::int, coalesce(jsonb_agg(jsonb_build_object('id', z.id, 'title', z.t)) filter (where z.rn <= 5), '[]'::jsonb)
  into v_n, v_s from (
    select c.id, coalesce(nullif(c.title, ''), k.title) as t, row_number() over (order by c.created_at desc) as rn
    from public.lexa_org_scope_classes(o, v_units) c join public.lexa_org_courses k on k.id = c.course_id
    join public.lexa_org_terms t on t.id = c.term_id
    where t.status <> 'closed'
      and not exists (select 1 from public.lexa_org_enrollments e where e.class_id = c.id and e.status <> 'dropped')) z;
  if v_n > 0 then v_todo := v_todo || jsonb_build_array(jsonb_build_object('kind', 'classes_no_students', 'count', v_n, 'items', v_s)); end if;

  select count(*)::int, coalesce(jsonb_agg(jsonb_build_object('id', z.id, 'title', z.t)) filter (where z.rn <= 5), '[]'::jsonb)
  into v_n, v_s from (
    select c.id, coalesce(nullif(c.title, ''), k.title) as t, row_number() over (order by c.created_at desc) as rn
    from public.lexa_org_scope_classes(o, v_units) c join public.lexa_org_courses k on k.id = c.course_id
    join public.lexa_org_terms t on t.id = c.term_id
    where t.status <> 'closed'
      and not exists (select 1 from public.lexa_org_class_content x where x.class_id = c.id)) z;
  if v_n > 0 then v_todo := v_todo || jsonb_build_array(jsonb_build_object('kind', 'classes_no_content', 'count', v_n, 'items', v_s)); end if;

  select count(*)::int, coalesce(jsonb_agg(jsonb_build_object('id', z.id, 'title', z.t)) filter (where z.rn <= 5), '[]'::jsonb)
  into v_n, v_s from (
    select x.id, x.title || ' · ' || coalesce(x.starts_at::date::text, '') as t, row_number() over (order by x.starts_at) as rn
    from public.lexa_org_exams x join public.lexa_org_scope_classes(o, v_units) c on c.id = x.class_id
    where x.ends_at > now() and x.starts_at <= now() + interval '7 days'
      and not exists (select 1 from public.lexa_org_exam_questions q where q.exam_id = x.id)) z;
  if v_n > 0 then v_todo := v_todo || jsonb_build_array(jsonb_build_object('kind', 'exams_no_questions', 'count', v_n, 'items', v_s)); end if;

  select count(*)::int into v_n from public.lexa_org_scope_students(o, v_units) x
  where x.status = 'active' and (x.user_id is null or x.terms_accepted_at is null);
  if v_n > 0 then v_todo := v_todo || jsonb_build_array(jsonb_build_object('kind', 'students_not_activated', 'count', v_n, 'items', '[]'::jsonb)); end if;

  if v_wide then
    select count(*)::int, coalesce(jsonb_agg(jsonb_build_object('id', z.id, 'title', z.t)) filter (where z.rn <= 5), '[]'::jsonb)
    into v_n, v_s from (
      select t.id, t.title || ' · ' || t.ends_on::text as t, row_number() over (order by t.ends_on) as rn
      from public.lexa_org_terms t
      where t.org_id = o and t.status = 'current' and t.ends_on is not null
        and t.ends_on between v_today and v_today + 14) z;
    if v_n > 0 then v_todo := v_todo || jsonb_build_array(jsonb_build_object('kind', 'term_ending', 'count', v_n, 'items', v_s)); end if;

    select count(*)::int, coalesce(jsonb_agg(jsonb_build_object('id', z.id, 'title', z.t)) filter (where z.rn <= 5), '[]'::jsonb)
    into v_n, v_s from (
      select m.user_id as id, coalesce(nullif(p.display_name, ''), p.username) as t,
        row_number() over (order by m.updated_at) as rn
      from public.lexa_org_members m join public.lexa_profiles p on p.id = m.user_id
      where m.org_id = o and m.status = 'invited' and m.updated_at < now() - interval '7 days') z;
    if v_n > 0 then v_todo := v_todo || jsonb_build_array(jsonb_build_object('kind', 'invites_stale', 'count', v_n, 'items', v_s)); end if;

    select count(*)::int, coalesce(jsonb_agg(jsonb_build_object('id', z.id, 'title', z.t)) filter (where z.rn <= 5), '[]'::jsonb)
    into v_n, v_s from (
      select m.user_id as id, coalesce(nullif(p.display_name, ''), p.username) as t,
        row_number() over (order by m.updated_at) as rn
      from public.lexa_org_members m join public.lexa_profiles p on p.id = m.user_id
      where m.org_id = o and m.status = 'requested') z;
    if v_n > 0 then v_todo := v_todo || jsonb_build_array(jsonb_build_object('kind', 'join_requests', 'count', v_n, 'items', v_s)); end if;

    begin
      select count(*)::int, coalesce(jsonb_agg(jsonb_build_object('id', z.id, 'title', z.t)) filter (where z.rn <= 5), '[]'::jsonb)
      into v_n, v_s from (
        select m.user_id as id, coalesce(nullif(p.display_name, ''), p.username) as t,
          row_number() over (order by m.role, p.username) as rn
        from public.lexa_org_members m join public.lexa_profiles p on p.id = m.user_id
        where m.org_id = o and m.status = 'active' and m.role in ('owner', 'manager', 'staff')
          and not exists (select 1 from auth.mfa_factors f where f.user_id = m.user_id and f.status = 'verified')) z;
      if v_n > 0 then v_todo := v_todo || jsonb_build_array(jsonb_build_object('kind', 'staff_no_mfa', 'count', v_n, 'items', v_s)); end if;
    exception when others then null;
    end;

    if v_org.student_seats > 0 and public.lexa_org_students_used(o) >= ceil(v_org.student_seats * 0.9) then
      v_todo := v_todo || jsonb_build_array(jsonb_build_object('kind', 'student_seats', 'count', public.lexa_org_students_used(o),
        'cap', v_org.student_seats, 'items', '[]'::jsonb));
    end if;
    if v_org.seats > 0 and public.lexa_org_seats_used(o) >= ceil(v_org.seats * 0.9) then
      v_todo := v_todo || jsonb_build_array(jsonb_build_object('kind', 'teacher_seats', 'count', public.lexa_org_seats_used(o),
        'cap', v_org.seats, 'items', '[]'::jsonb));
    end if;
    if v_org.expires_at is not null and v_org.expires_at < now() + interval '30 days' then
      v_todo := v_todo || jsonb_build_array(jsonb_build_object('kind', 'org_expiring', 'count', 1, 'at', v_org.expires_at, 'items', '[]'::jsonb));
    end if;
  end if;

  if public.lexa_org_can(o, 'org.audit.read', null) then
    select coalesce(jsonb_agg(jsonb_build_object('id', z.id, 'at', z.at, 'action', z.action, 'actor', z.actor_name,
                                                 'target_name', z.target_name) order by z.at desc, z.id desc), '[]'::jsonb)
    into v_recent from (
      select a.id, a.at, a.action, coalesce(nullif(pa.display_name, ''), pa.username) as actor_name,
        coalesce(nullif(pt.display_name, ''), pt.username, ut.name, st.full_name) as target_name
      from public.lexa_audit_log a
      left join public.lexa_profiles pa on pa.id = a.actor
      left join public.lexa_profiles pt on pt.id = a.target
      left join public.lexa_org_units ut on ut.id = a.target
      left join public.lexa_org_students st on st.id = a.target
      where a.org_id = o
      order by a.at desc, a.id desc
      limit 12) z;
  end if;

  return v_main || jsonb_build_object(
    'todo', v_todo, 'recent', v_recent, 'scope', v_scope, 'centre_wide', v_wide,
    'org', jsonb_build_object('id', v_org.id, 'name', v_org.name, 'status', v_org.status, 'expires_at', v_org.expires_at),
    'today', v_today, 'generated_at', now());
end $$;

-- --- centre audit search ---
create or replace function public.lexa_org_audit_search(o uuid, p_from timestamptz default null, p_to timestamptz default null,
                                                        p_action text default '', p_actor text default '',
                                                        lim int default 50, off int default 0)
returns table (id bigint, at timestamptz, action text, actor uuid, actor_name text, target uuid, target_name text,
               detail jsonb, total bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_act text := trim(coalesce(p_action, ''));
  v_actor text := trim(coalesce(p_actor, ''));
begin
  perform public.lexa_org_require(o, 'org.audit.read', null, true);
  return query
    with f as (
      select a.* from public.lexa_audit_log a
      where a.org_id = o
        and (p_from is null or a.at >= p_from) and (p_to is null or a.at < p_to)
        and (v_act = '' or left(a.action, char_length(v_act)) = v_act)
        and (v_actor = '' or a.actor in (
          select p.id from public.lexa_profiles p
          where lower(p.username) = lower(v_actor) or p.display_name ilike '%' || v_actor || '%'))
    )
    select f.id, f.at, f.action, f.actor, coalesce(nullif(pa.display_name, ''), pa.username), f.target,
      coalesce(nullif(pt.display_name, ''), pt.username, ut.name, st.full_name, st.org_username),
      f.detail, count(*) over ()
    from f
    left join public.lexa_profiles pa on pa.id = f.actor
    left join public.lexa_profiles pt on pt.id = f.target
    left join public.lexa_org_units ut on ut.id = f.target
    left join public.lexa_org_students st on st.id = f.target
    order by f.at desc, f.id desc
    limit greatest(1, least(coalesce(lim, 50), 200)) offset greatest(0, coalesce(off, 0));
end $$;

-- --- system roles for every existing centre ---
do $$
declare r record;
begin
  for r in select id from public.lexa_orgs loop
    perform public.lexa_org_roles_seed(r.id);
  end loop;
end $$;

-- --- function grants ---
revoke execute on function public.lexa_org_units_path() from public, anon, authenticated;
revoke execute on function public.lexa_org_units_cascade() from public, anon, authenticated;
revoke execute on function public.lexa_orgs_seed_roles() from public, anon, authenticated;
revoke execute on function public.lexa_org_roles_seed(uuid) from public, anon, authenticated;
revoke execute on function public.lexa_org_scope_classes(uuid, uuid[]) from public, anon, authenticated;
revoke execute on function public.lexa_org_scope_students(uuid, uuid[]) from public, anon, authenticated;
revoke execute on function public.lexa_org_require(uuid, text, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.lexa_org_require_any(uuid, text[], boolean) from public, anon, authenticated;
revoke execute on function public.lexa_org_perm_keys() from public, anon;
revoke execute on function public.lexa_org_role_templates() from public, anon;
revoke execute on function public.lexa_org_perms_at(uuid, uuid) from public, anon;
revoke execute on function public.lexa_org_perms_any(uuid) from public, anon;
revoke execute on function public.lexa_org_can(uuid, text, uuid) from public, anon;
revoke execute on function public.lexa_org_my_access(uuid) from public, anon;
revoke execute on function public.lexa_org_unit_tree(uuid) from public, anon;
revoke execute on function public.lexa_org_unit_save(uuid, uuid, uuid, text, text, text, integer) from public, anon;
revoke execute on function public.lexa_org_unit_status(uuid, boolean, text) from public, anon;
revoke execute on function public.lexa_org_unit_delete(uuid, text) from public, anon;
revoke execute on function public.lexa_org_unit_preset(uuid, text) from public, anon;
revoke execute on function public.lexa_org_unit_items(uuid, text) from public, anon;
revoke execute on function public.lexa_org_unit_assign(uuid, text, uuid[], uuid) from public, anon;
revoke execute on function public.lexa_org_role_list(uuid) from public, anon;
revoke execute on function public.lexa_org_role_save(uuid, uuid, text, text, text[], text) from public, anon;
revoke execute on function public.lexa_org_role_delete(uuid, uuid, text) from public, anon;
revoke execute on function public.lexa_org_grant_list(uuid) from public, anon;
revoke execute on function public.lexa_org_grant(uuid, uuid, uuid, uuid, timestamptz, text) from public, anon;
revoke execute on function public.lexa_org_grant_revoke(uuid, text) from public, anon;
revoke execute on function public.lexa_org_staff(uuid) from public, anon;
revoke execute on function public.lexa_org_staff_invite(uuid, uuid, text, uuid, uuid, timestamptz) from public, anon;
revoke execute on function public.lexa_org_staff_update(uuid, uuid, text, uuid) from public, anon;
revoke execute on function public.lexa_org_set_base_role(uuid, uuid, text, text) from public, anon;
revoke execute on function public.lexa_org_staff_remove(uuid, uuid, text) from public, anon;
revoke execute on function public.lexa_org_home(uuid, uuid) from public, anon;
revoke execute on function public.lexa_org_audit_search(uuid, timestamptz, timestamptz, text, text, integer, integer) from public, anon;

grant execute on function public.lexa_org_perm_keys() to authenticated;
grant execute on function public.lexa_org_role_templates() to authenticated;
grant execute on function public.lexa_org_perms_at(uuid, uuid) to authenticated;
grant execute on function public.lexa_org_perms_any(uuid) to authenticated;
grant execute on function public.lexa_org_can(uuid, text, uuid) to authenticated;
grant execute on function public.lexa_org_my_access(uuid) to authenticated;
grant execute on function public.lexa_org_unit_tree(uuid) to authenticated;
grant execute on function public.lexa_org_unit_save(uuid, uuid, uuid, text, text, text, integer) to authenticated;
grant execute on function public.lexa_org_unit_status(uuid, boolean, text) to authenticated;
grant execute on function public.lexa_org_unit_delete(uuid, text) to authenticated;
grant execute on function public.lexa_org_unit_preset(uuid, text) to authenticated;
grant execute on function public.lexa_org_unit_items(uuid, text) to authenticated;
grant execute on function public.lexa_org_unit_assign(uuid, text, uuid[], uuid) to authenticated;
grant execute on function public.lexa_org_role_list(uuid) to authenticated;
grant execute on function public.lexa_org_role_save(uuid, uuid, text, text, text[], text) to authenticated;
grant execute on function public.lexa_org_role_delete(uuid, uuid, text) to authenticated;
grant execute on function public.lexa_org_grant_list(uuid) to authenticated;
grant execute on function public.lexa_org_grant(uuid, uuid, uuid, uuid, timestamptz, text) to authenticated;
grant execute on function public.lexa_org_grant_revoke(uuid, text) to authenticated;
grant execute on function public.lexa_org_staff(uuid) to authenticated;
grant execute on function public.lexa_org_staff_invite(uuid, uuid, text, uuid, uuid, timestamptz) to authenticated;
grant execute on function public.lexa_org_staff_update(uuid, uuid, text, uuid) to authenticated;
grant execute on function public.lexa_org_set_base_role(uuid, uuid, text, text) to authenticated;
grant execute on function public.lexa_org_staff_remove(uuid, uuid, text) to authenticated;
grant execute on function public.lexa_org_home(uuid, uuid) to authenticated;
grant execute on function public.lexa_org_audit_search(uuid, timestamptz, timestamptz, text, text, integer, integer) to authenticated;
grant execute on function public.lexa_org_require(uuid, text, uuid, boolean) to service_role;
grant execute on function public.lexa_org_require_any(uuid, text[], boolean) to service_role;

notify pgrst, 'reload schema';
