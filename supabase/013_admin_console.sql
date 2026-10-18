-- Lexa 013: platform admin console (phase A1 of docs/ADMIN_PLATFORM.md; setup in docs/ADMIN_A1_SETUP.md)
-- Run in the Supabase SQL editor after 002-012. Safe to re-run. If 010 or 012 were not run yet, the
-- parts that read API logs or connector runs are skipped.
--
--   * centre lifecycle: pending -> active <-> suspended -> archived -> deletion scheduled -> purge
--   * user suspension flags (the ban itself is done by the admin-users Edge Function)
--   * one-call RPCs for the console: home, centres overview, users, user detail, audit search
--   * every change needs a Lexa admin with a two-factor session (aal2), a reason where it matters,
--     and writes the append-only audit log

-- --- centre lifecycle ---
alter table public.lexa_orgs add column if not exists status_reason text not null default '';
alter table public.lexa_orgs add column if not exists status_changed_at timestamptz;
alter table public.lexa_orgs add column if not exists delete_after timestamptz;

do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.lexa_orgs'::regclass and contype = 'c' and conname <> 'lexa_orgs_status_chk'
      and pg_get_constraintdef(oid) ilike '%status%' and pg_get_constraintdef(oid) ilike '%suspended%'
  loop
    execute format('alter table public.lexa_orgs drop constraint %I', c.conname);
  end loop;
end $$;
do $$ begin
  alter table public.lexa_orgs add constraint lexa_orgs_status_chk
    check (status in ('pending', 'active', 'suspended', 'archived'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.lexa_orgs add constraint lexa_orgs_status_reason_len check (char_length(status_reason) <= 300);
exception when duplicate_object then null; end $$;

-- managers may edit the centre profile, never its lifecycle fields
create or replace function public.lexa_orgs_guard_lifecycle()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not public.lexa_is_admin()
     and coalesce(current_setting('lexa.trusted', true), '') <> '1'
     and (new.status_reason is distinct from old.status_reason
          or new.status_changed_at is distinct from old.status_changed_at
          or new.delete_after is distinct from old.delete_after) then
    raise exception 'only a Lexa admin can change the centre lifecycle';
  end if;
  return new;
end $$;
drop trigger if exists lexa_orgs_guard_lifecycle on public.lexa_orgs;
create trigger lexa_orgs_guard_lifecycle before update on public.lexa_orgs
  for each row execute function public.lexa_orgs_guard_lifecycle();

-- --- user flags (suspension mirror of the auth ban) ---
create table if not exists public.lexa_user_flags (
  user_id uuid primary key references public.lexa_profiles(id) on delete cascade,
  suspended boolean not null default false,
  reason text not null default '' check (char_length(reason) <= 300),
  changed_by uuid references public.lexa_profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
alter table public.lexa_user_flags enable row level security;
revoke all on public.lexa_user_flags from public, anon, authenticated;

create index if not exists lexa_audit_log_at_idx on public.lexa_audit_log (at desc);
create index if not exists lexa_audit_log_target_idx on public.lexa_audit_log (target, at desc);
create index if not exists lexa_audit_log_actor_idx on public.lexa_audit_log (actor, at desc);

-- --- helpers ---
create or replace function public.lexa_admin_require(need_mfa boolean default true)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.lexa_is_admin() then raise exception 'admin only'; end if;
  if need_mfa and not public.lexa_mfa_ok() then raise exception 'mfa required'; end if;
end $$;

create or replace function public.lexa_mask_email(e text)
returns text language sql immutable as $$
  select case
    when e is null or position('@' in e) = 0 then coalesce(e, '')
    else left(split_part(e, '@', 1), 1)
      || repeat('*', greatest(1, least(6, char_length(split_part(e, '@', 1)) - 1)))
      || '@' || split_part(e, '@', 2)
  end
$$;

create or replace function public.lexa_tehran_today()
returns date language sql stable as $$
  select (now() at time zone 'Asia/Tehran')::date
$$;

-- --- console home: KPIs, queues, alerts, 30-day series, recent audit ---
create or replace function public.lexa_admin_home()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := public.lexa_tehran_today();
  v_k jsonb;
  v_q jsonb;
  v_alerts jsonb := '[]'::jsonb;
  v_series jsonb;
  v_recent jsonb := '[]'::jsonb;
  v_no_mfa int;
  v_conn int;
  v_api int;
  v_x jsonb;
begin
  perform public.lexa_admin_require(false);

  begin
    select count(*)::int into v_no_mfa from public.lexa_profiles p
    where p.role = 'admin'
      and not exists (select 1 from auth.mfa_factors f where f.user_id = p.id and f.status = 'verified');
  exception when others then v_no_mfa := null;
  end;

  if to_regclass('public.lexa_org_integration_runs') is not null then
    execute $q$select count(*)::int from public.lexa_org_integration_runs
               where status = 'failed' and started_at > now() - interval '24 hours'$q$ into v_conn;
  end if;
  if to_regclass('public.lexa_org_api_log') is not null then
    execute $q$select count(*)::int from public.lexa_org_api_log
               where status >= 500 and at > now() - interval '24 hours'$q$ into v_api;
  end if;

  v_k := jsonb_build_object(
    'users', (select count(*) from public.lexa_profiles),
    'users_new_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'users_new_30d', (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'signins_7d', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'teachers', (select count(*) from public.lexa_profiles where role = 'teacher'),
    'admins', (select count(*) from public.lexa_profiles where role = 'admin'),
    'admins_no_mfa', v_no_mfa,
    'suspended_users', (select count(*) from public.lexa_user_flags where suspended),
    'learners_1d', (select count(distinct d.user_id) from public.lexa_study_daily d where d.day = v_today and d.seconds > 0),
    'learners_7d', (select count(distinct d.user_id) from public.lexa_study_daily d where d.day > v_today - 7 and d.seconds > 0),
    'learners_30d', (select count(distinct d.user_id) from public.lexa_study_daily d where d.day > v_today - 30 and d.seconds > 0),
    'study_seconds_7d', (select coalesce(sum(d.seconds), 0) from public.lexa_study_daily d where d.day > v_today - 7),
    'study_seconds_30d', (select coalesce(sum(d.seconds), 0) from public.lexa_study_daily d where d.day > v_today - 30),
    'orgs_active', (select count(*) from public.lexa_orgs where status = 'active' and (expires_at is null or expires_at > now())),
    'orgs_expired', (select count(*) from public.lexa_orgs where status = 'active' and expires_at <= now()),
    'orgs_pending', (select count(*) from public.lexa_orgs where status = 'pending'),
    'orgs_suspended', (select count(*) from public.lexa_orgs where status = 'suspended'),
    'orgs_archived', (select count(*) from public.lexa_orgs where status = 'archived'),
    'official_students', (select count(*) from public.lexa_org_students where status = 'active'),
    'student_seats', (select coalesce(sum(student_seats), 0) from public.lexa_orgs where status = 'active'),
    'classes_active', (select count(*) from public.lexa_org_classes where status = 'active'),
    'exams_next_7d', (select count(*) from public.lexa_org_exams
                      where status = 'published' and starts_at > now() and starts_at < now() + interval '7 days'),
    'connector_failed_24h', v_conn,
    'api_errors_24h', v_api
  );

  v_q := jsonb_build_object(
    'teacher_requests', (select count(*) from public.lexa_teacher_requests where status = 'pending'),
    'teacher_requests_oldest', (select min(created_at) from public.lexa_teacher_requests where status = 'pending'),
    'org_requests', (select count(*) from public.lexa_orgs where status = 'pending'),
    'org_requests_oldest', (select min(created_at) from public.lexa_orgs where status = 'pending'),
    'orgs_delete_due', (select count(*) from public.lexa_orgs where delete_after is not null and delete_after <= now()),
    'orgs_delete_scheduled', (select count(*) from public.lexa_orgs where delete_after is not null)
  );

  -- alerts (the client words them): most urgent first, at most 40
  select coalesce(jsonb_agg(a order by (a ->> 'rank')::int, a ->> 'at'), '[]'::jsonb) into v_alerts from (
    select jsonb_build_object('rank', 1, 'kind', 'org_delete_due', 'org_id', o.id, 'slug', o.slug, 'name', o.name,
                              'at', o.delete_after) as a
    from public.lexa_orgs o where o.delete_after is not null and o.delete_after <= now()
    union all
    select jsonb_build_object('rank', 2, 'kind', 'org_expired', 'org_id', o.id, 'slug', o.slug, 'name', o.name, 'at', o.expires_at)
    from public.lexa_orgs o where o.status = 'active' and o.expires_at <= now()
    union all
    select jsonb_build_object('rank', 3, 'kind', 'org_expiring', 'org_id', o.id, 'slug', o.slug, 'name', o.name, 'at', o.expires_at)
    from public.lexa_orgs o where o.status = 'active' and o.expires_at > now() and o.expires_at <= now() + interval '14 days'
    union all
    select jsonb_build_object('rank', 4, 'kind', 'org_students_full', 'org_id', o.id, 'slug', o.slug, 'name', o.name,
                              'used', public.lexa_org_students_used(o.id), 'cap', o.student_seats)
    from public.lexa_orgs o where o.status = 'active' and o.student_seats > 0
      and public.lexa_org_students_used(o.id) >= o.student_seats
    union all
    select jsonb_build_object('rank', 5, 'kind', 'org_teachers_full', 'org_id', o.id, 'slug', o.slug, 'name', o.name,
                              'used', public.lexa_org_seats_used(o.id), 'cap', o.seats)
    from public.lexa_orgs o where o.status = 'active' and public.lexa_org_seats_used(o.id) >= o.seats
  ) z;
  if coalesce(v_no_mfa, 0) > 0 then
    v_alerts := jsonb_build_array(jsonb_build_object('rank', 0, 'kind', 'admins_no_mfa', 'count', v_no_mfa)) || v_alerts;
  end if;
  if coalesce(v_conn, 0) > 0 then
    execute $q$select coalesce(jsonb_agg(jsonb_build_object('rank', 2, 'kind', 'connector_failed', 'org_id', o.id,
                 'slug', o.slug, 'name', o.name, 'count', r.n, 'at', r.last_at)), '[]'::jsonb)
               from (select org_id, count(*)::int as n, max(started_at) as last_at
                     from public.lexa_org_integration_runs
                     where status = 'failed' and started_at > now() - interval '24 hours' group by org_id) r
               join public.lexa_orgs o on o.id = r.org_id$q$ into v_x;
    v_alerts := v_alerts || v_x;
  end if;
  if coalesce(v_api, 0) > 0 then
    execute $q$select coalesce(jsonb_agg(jsonb_build_object('rank', 3, 'kind', 'api_errors', 'org_id', o.id,
                 'slug', o.slug, 'name', o.name, 'count', r.n, 'at', r.last_at)), '[]'::jsonb)
               from (select org_id, count(*)::int as n, max(at) as last_at from public.lexa_org_api_log
                     where status >= 500 and at > now() - interval '24 hours' group by org_id) r
               join public.lexa_orgs o on o.id = r.org_id$q$ into v_x;
    v_alerts := v_alerts || v_x;
  end if;
  select coalesce(jsonb_agg(s.x order by s.r), '[]'::jsonb) into v_alerts
  from (select e.x, (e.x ->> 'rank')::int as r from jsonb_array_elements(v_alerts) as e(x)
        order by (e.x ->> 'rank')::int limit 40) s;

  -- 30 Tehran days: sign-ups, learners, study seconds
  select jsonb_agg(jsonb_build_object(
      'day', g.day,
      'signups', coalesce(s.n, 0),
      'learners', coalesce(l.n, 0),
      'seconds', coalesce(l.secs, 0)) order by g.day)
  into v_series
  from (select (v_today - i) as day from generate_series(0, 29) i) g
  left join (
    select (u.created_at at time zone 'Asia/Tehran')::date as day, count(*)::int as n
    from auth.users u where u.created_at > now() - interval '31 days' group by 1
  ) s on s.day = g.day
  left join (
    select d.day, (count(*) filter (where d.seconds > 0))::int as n, sum(d.seconds)::bigint as secs
    from public.lexa_study_daily d where d.day > v_today - 30 group by d.day
  ) l on l.day = g.day;

  -- recent audit (two-factor sessions only, like the audit page)
  if public.lexa_mfa_ok() then
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'at', a.at, 'action', a.action, 'actor', p.username, 'org', o.name, 'target', a.target,
        'target_name', t.username) order by a.at desc), '[]'::jsonb)
    into v_recent
    from (select * from public.lexa_audit_log order by at desc limit 15) a
    left join public.lexa_profiles p on p.id = a.actor
    left join public.lexa_profiles t on t.id = a.target
    left join public.lexa_orgs o on o.id = a.org_id;
  end if;

  return jsonb_build_object('kpis', v_k, 'queues', v_q, 'alerts', v_alerts, 'series', coalesce(v_series, '[]'::jsonb),
    'recent', v_recent, 'mfa', public.lexa_mfa_ok(), 'today', v_today, 'generated_at', now());
end $$;

-- --- centres overview ---
create or replace function public.lexa_admin_orgs_overview()
returns table (id uuid, slug text, name text, kind text, city text, logo_url text, status text, plan text,
               seats int, teachers_used int, student_seats int, students_used int, code text,
               expires_at timestamptz, created_at timestamptz, owner_id uuid, owner_username text, owner_name text,
               status_reason text, status_changed_at timestamptz, delete_after timestamptz, classes int,
               learners_7d int, study_seconds_30d bigint, last_study_day date, admin_note text, contact text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare v_today date := public.lexa_tehran_today();
begin
  perform public.lexa_admin_require(false);
  return query
    select o.id, o.slug, o.name, o.kind, o.city, o.logo_url, o.status, o.plan,
      o.seats, public.lexa_org_seats_used(o.id), o.student_seats, public.lexa_org_students_used(o.id), o.code,
      o.expires_at, o.created_at, ow.user_id, pw.username, pw.display_name,
      o.status_reason, o.status_changed_at, o.delete_after,
      (select count(*)::int from public.lexa_org_classes c where c.org_id = o.id and c.status = 'active'),
      (select count(distinct d.user_id)::int from public.lexa_study_daily d
        where d.day > v_today - 7 and coalesce((d.by_org ->> o.id::text)::int, 0) > 0),
      (select coalesce(sum(coalesce((d.by_org ->> o.id::text)::int, 0)), 0)::bigint from public.lexa_study_daily d
        where d.day > v_today - 30 and d.by_org ? o.id::text),
      (select max(d.day) from public.lexa_study_daily d where d.by_org ? o.id::text),
      coalesce(pv.admin_note, ''), coalesce(pv.contact, '')
    from public.lexa_orgs o
    left join lateral (
      select m.user_id from public.lexa_org_members m
      where m.org_id = o.id and m.role = 'owner' and m.status = 'active' order by m.created_at limit 1
    ) ow on true
    left join public.lexa_profiles pw on pw.id = ow.user_id
    left join public.lexa_org_private pv on pv.org_id = o.id
    order by case o.status when 'pending' then 0 when 'active' then 1 when 'suspended' then 2 else 3 end, o.created_at desc;
end $$;

-- --- centre lifecycle actions ---
-- act: activate | suspend | archive | restore | schedule_delete | cancel_delete
create or replace function public.lexa_admin_org_lifecycle(o uuid, act text, reason text default '', grace_days int default 30)
returns text language plpgsql security definer set search_path = public as $$
declare
  v record;
  v_reason text := left(trim(coalesce(reason, '')), 300);
  v_to text;
  v_delete timestamptz;
begin
  perform public.lexa_admin_require(true);
  select * into v from public.lexa_orgs where id = o for update;
  if v.id is null then raise exception 'org not found'; end if;
  if act in ('suspend', 'archive', 'schedule_delete') and char_length(v_reason) < 3 then
    raise exception 'reason required';
  end if;
  v_to := v.status;
  v_delete := v.delete_after;
  if act = 'activate' then
    if v.status = 'archived' then raise exception 'restore first'; end if;
    v_to := 'active';
  elsif act = 'suspend' then
    if v.status not in ('active', 'pending') then raise exception 'bad transition'; end if;
    v_to := 'suspended';
  elsif act = 'archive' then
    if v.status not in ('suspended', 'pending') then raise exception 'suspend first'; end if;
    v_to := 'archived';
  elsif act = 'restore' then
    if v.status <> 'archived' then raise exception 'bad transition'; end if;
    if v.delete_after is not null then raise exception 'cancel deletion first'; end if;
    v_to := 'suspended';
  elsif act = 'schedule_delete' then
    if v.status <> 'archived' then raise exception 'archive first'; end if;
    v_delete := now() + make_interval(days => greatest(7, least(coalesce(grace_days, 30), 365)));
  elsif act = 'cancel_delete' then
    v_delete := null;
  else
    raise exception 'bad action';
  end if;
  perform set_config('lexa.trusted', '1', true);
  update public.lexa_orgs set status = v_to, delete_after = v_delete,
    status_reason = case when act in ('schedule_delete', 'cancel_delete') then status_reason else v_reason end,
    status_changed_at = case when v_to is distinct from v.status then now() else status_changed_at end
  where id = o;
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(o, 'admin.org.' || act, o, jsonb_build_object('from', v.status, 'to', v_to,
    'reason', v_reason, 'delete_after', v_delete));
  return v_to;
end $$;

-- plan, teacher seats, student seats, expiry, internal note (null = keep)
create or replace function public.lexa_admin_org_update(o uuid, p_plan text default null, p_seats int default null,
                                                        p_student_seats int default null, p_expires timestamptz default null,
                                                        p_clear_expiry boolean default false, p_note text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v record;
  v_note text;
begin
  perform public.lexa_admin_require(true);
  select * into v from public.lexa_orgs where id = o for update;
  if v.id is null then raise exception 'org not found'; end if;
  if p_plan is not null and p_plan not in ('trial', 'basic', 'pro') then raise exception 'bad plan'; end if;
  select admin_note into v_note from public.lexa_org_private where org_id = o;
  perform set_config('lexa.trusted', '1', true);
  update public.lexa_orgs set
    plan = coalesce(p_plan, plan),
    seats = coalesce(p_seats, seats),
    student_seats = coalesce(p_student_seats, student_seats),
    expires_at = case when p_clear_expiry then null else coalesce(p_expires, expires_at) end
  where id = o;
  if p_note is not null then
    insert into public.lexa_org_private (org_id, admin_note) values (o, left(p_note, 600))
    on conflict (org_id) do update set admin_note = excluded.admin_note;
  end if;
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(o, 'admin.org.update', o, jsonb_build_object(
    'plan', jsonb_build_array(v.plan, coalesce(p_plan, v.plan)),
    'seats', jsonb_build_array(v.seats, coalesce(p_seats, v.seats)),
    'student_seats', jsonb_build_array(v.student_seats, coalesce(p_student_seats, v.student_seats)),
    'expires_at', jsonb_build_array(v.expires_at, case when p_clear_expiry then null else coalesce(p_expires, v.expires_at) end),
    'note_changed', p_note is not null and p_note is distinct from coalesce(v_note, '')));
  return 'ok';
end $$;

-- permanent delete, only after the grace period and with the centre address typed again
create or replace function public.lexa_admin_org_purge(o uuid, confirm_slug text)
returns text language plpgsql security definer set search_path = public as $$
declare v record;
begin
  perform public.lexa_admin_require(true);
  select * into v from public.lexa_orgs where id = o for update;
  if v.id is null then raise exception 'org not found'; end if;
  if v.status <> 'archived' or v.delete_after is null or v.delete_after > now() then raise exception 'not due'; end if;
  if lower(trim(coalesce(confirm_slug, ''))) <> v.slug then raise exception 'confirm mismatch'; end if;
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(o, 'admin.org.purge', o, jsonb_build_object('slug', v.slug, 'name', v.name,
    'students', (select count(*) from public.lexa_org_students s where s.org_id = o),
    'classes', (select count(*) from public.lexa_org_classes c where c.org_id = o)));
  perform set_config('lexa.trusted', '1', true);
  delete from public.lexa_orgs where id = o;
  return 'purged';
end $$;

-- --- users ---
-- p_filter: all | suspended | staff | admins_no_mfa | new_7d | inactive_30d
create or replace function public.lexa_admin_users(q text default '', p_role text default 'all', p_filter text default 'all',
                                                   lim int default 50, off int default 0)
returns table (id uuid, username text, display_name text, avatar_url text, role text, email_masked text,
               created_at timestamptz, last_sign_in_at timestamptz, banned boolean, suspended boolean, mfa boolean,
               orgs int, official int, study_seconds_30d bigint, total bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_q text := trim(coalesce(q, ''));
  v_today date := public.lexa_tehran_today();
begin
  perform public.lexa_admin_require(true);
  return query
    with base as (
      select p.id, p.username, p.display_name, p.avatar_url, p.role, u.email,
        coalesce(u.created_at, p.created_at) as created_at, u.last_sign_in_at,
        coalesce(u.banned_until > now(), false) as banned, coalesce(f.suspended, false) as suspended,
        exists (select 1 from auth.mfa_factors m where m.user_id = p.id and m.status = 'verified') as mfa
      from public.lexa_profiles p
      left join auth.users u on u.id = p.id
      left join public.lexa_user_flags f on f.user_id = p.id
      where (v_q = '' or p.username ilike '%' || v_q || '%' or coalesce(p.display_name, '') ilike '%' || v_q || '%'
             or coalesce(u.email, '') ilike '%' || v_q || '%' or p.id::text = v_q)
        and (coalesce(p_role, 'all') = 'all' or p.role = p_role)
    )
    select b.id, b.username, coalesce(b.display_name, ''), b.avatar_url, b.role, public.lexa_mask_email(b.email),
      b.created_at, b.last_sign_in_at, b.banned, b.suspended, b.mfa,
      (select count(*)::int from public.lexa_org_members m where m.user_id = b.id and m.status = 'active'),
      (select count(*)::int from public.lexa_org_students s where s.user_id = b.id),
      (select coalesce(sum(d.seconds), 0)::bigint from public.lexa_study_daily d where d.user_id = b.id and d.day > v_today - 30),
      count(*) over ()
    from base b
    where case coalesce(p_filter, 'all')
      when 'suspended' then b.suspended or b.banned
      when 'staff' then b.role in ('teacher', 'admin')
      when 'admins_no_mfa' then b.role = 'admin' and not b.mfa
      when 'new_7d' then b.created_at > now() - interval '7 days'
      when 'inactive_30d' then b.last_sign_in_at is null or b.last_sign_in_at < now() - interval '30 days'
      else true end
    order by b.created_at desc nulls last
    limit greatest(1, least(coalesce(lim, 50), 200)) offset greatest(0, coalesce(off, 0));
end $$;

-- full record of one user; viewing it is audited
create or replace function public.lexa_admin_user_detail(uid uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_today date := public.lexa_tehran_today();
  v_p record;
  v_u record;
  v_out jsonb;
begin
  perform public.lexa_admin_require(true);
  select * into v_p from public.lexa_profiles where id = uid;
  if v_p.id is null then raise exception 'user not found'; end if;
  select u.email, u.phone, u.created_at, u.last_sign_in_at, u.banned_until, u.email_confirmed_at,
         u.raw_app_meta_data -> 'providers' as providers
    into v_u from auth.users u where u.id = uid;
  v_out := jsonb_build_object(
    'id', v_p.id, 'username', v_p.username, 'display_name', coalesce(v_p.display_name, ''), 'avatar_url', v_p.avatar_url,
    'bio', coalesce(v_p.bio, ''), 'role', v_p.role,
    'email', coalesce(v_u.email, ''), 'phone', coalesce(v_u.phone, ''), 'providers', coalesce(v_u.providers, '[]'::jsonb),
    'created_at', v_u.created_at, 'last_sign_in_at', v_u.last_sign_in_at, 'email_confirmed_at', v_u.email_confirmed_at,
    'banned_until', v_u.banned_until,
    'flags', (select jsonb_build_object('suspended', f.suspended, 'reason', f.reason, 'changed_at', f.changed_at,
                                        'changed_by', (select username from public.lexa_profiles where id = f.changed_by))
              from public.lexa_user_flags f where f.user_id = uid),
    'factors', (select coalesce(jsonb_agg(jsonb_build_object('type', m.factor_type, 'status', m.status,
                                          'name', coalesce(m.friendly_name, ''), 'created_at', m.created_at)
                                          order by m.created_at), '[]'::jsonb)
                from auth.mfa_factors m where m.user_id = uid),
    'memberships', (select coalesce(jsonb_agg(jsonb_build_object('org_id', o.id, 'slug', o.slug, 'name', o.name,
                                              'role', m.role, 'status', m.status, 'title', m.title) order by m.created_at), '[]'::jsonb)
                    from public.lexa_org_members m join public.lexa_orgs o on o.id = m.org_id where m.user_id = uid),
    'official', (select coalesce(jsonb_agg(jsonb_build_object('org_id', o.id, 'slug', o.slug, 'name', o.name,
                                           'username', s.org_username, 'status', s.status, 'student_no', s.student_no)
                                           order by s.created_at), '[]'::jsonb)
                 from public.lexa_org_students s join public.lexa_orgs o on o.id = s.org_id where s.user_id = uid),
    'teacher_request', (select jsonb_build_object('status', r.status, 'created_at', r.created_at)
                        from public.lexa_teacher_requests r where r.user_id = uid),
    'study', jsonb_build_object(
      'seconds_7d', (select coalesce(sum(d.seconds), 0) from public.lexa_study_daily d where d.user_id = uid and d.day > v_today - 7),
      'seconds_30d', (select coalesce(sum(d.seconds), 0) from public.lexa_study_daily d where d.user_id = uid and d.day > v_today - 30),
      'days_30d', (select count(*) from public.lexa_study_daily d where d.user_id = uid and d.day > v_today - 30 and d.seconds > 0),
      'last_day', (select max(d.day) from public.lexa_study_daily d where d.user_id = uid and d.seconds > 0),
      'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'seconds', d.seconds) order by d.day), '[]'::jsonb)
                from public.lexa_study_daily d where d.user_id = uid and d.day > v_today - 30)),
    'audit', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'at', a.at, 'action', a.action,
                                        'actor', p.username, 'org', o.name, 'detail', a.detail) order by a.at desc), '[]'::jsonb)
              from (select * from public.lexa_audit_log l where l.target = uid or l.actor = uid order by l.at desc limit 25) a
              left join public.lexa_profiles p on p.id = a.actor
              left join public.lexa_orgs o on o.id = a.org_id)
  );
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(null, 'admin.user.view', uid, '{}'::jsonb);
  return v_out;
end $$;

-- global role with a reason; the last admin cannot be demoted
create or replace function public.lexa_admin_change_role(uid uuid, new_role text, reason text default '')
returns text language plpgsql security definer set search_path = public as $$
declare
  v_old text;
  v_reason text := left(trim(coalesce(reason, '')), 300);
begin
  perform public.lexa_admin_require(true);
  if new_role not in ('user', 'teacher', 'admin') then raise exception 'bad role'; end if;
  if char_length(v_reason) < 3 then raise exception 'reason required'; end if;
  select role into v_old from public.lexa_profiles where id = uid;
  if v_old is null then raise exception 'user not found'; end if;
  if v_old = new_role then return new_role; end if;
  if uid = auth.uid() and new_role <> 'admin' then raise exception 'cannot demote yourself'; end if;
  if v_old = 'admin' and (select count(*) from public.lexa_profiles where role = 'admin') <= 1 then
    raise exception 'last admin';
  end if;
  perform set_config('lexa.trusted', '1', true);
  update public.lexa_profiles set role = new_role where id = uid;
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(null, 'admin.user.role', uid, jsonb_build_object('from', v_old, 'to', new_role, 'reason', v_reason));
  return new_role;
end $$;

-- the admin-users Edge Function calls this with the admin's own token before touching auth
-- act: suspend | unsuspend | revoke_sessions | reset_mfa
create or replace function public.lexa_admin_user_authorize(uid uuid, act text, reason text default '')
returns text language plpgsql security definer set search_path = public as $$
declare
  v_role text;
  v_reason text := left(trim(coalesce(reason, '')), 300);
begin
  perform public.lexa_admin_require(true);
  if act not in ('suspend', 'unsuspend', 'revoke_sessions', 'reset_mfa') then raise exception 'bad action'; end if;
  select role into v_role from public.lexa_profiles where id = uid;
  if v_role is null then raise exception 'user not found'; end if;
  if uid = auth.uid() and act in ('suspend', 'reset_mfa') then raise exception 'not on yourself'; end if;
  if act = 'suspend' and v_role = 'admin' then raise exception 'demote the admin first'; end if;
  if act in ('suspend', 'reset_mfa') and char_length(v_reason) < 3 then raise exception 'reason required'; end if;
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(null, 'admin.user.' || act, uid, jsonb_build_object('reason', v_reason, 'stage', 'authorized'));
  return 'ok';
end $$;

-- service key only (admin-users function): mirror flag + result entry
create or replace function public.lexa_svc_user_flag(uid uuid, p_suspended boolean, by_user uuid, p_reason text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.lexa_is_service() then raise exception 'service only'; end if;
  insert into public.lexa_user_flags (user_id, suspended, reason, changed_by, changed_at)
  values (uid, coalesce(p_suspended, false), left(coalesce(p_reason, ''), 300), by_user, now())
  on conflict (user_id) do update set suspended = excluded.suspended, reason = excluded.reason,
    changed_by = excluded.changed_by, changed_at = now();
end $$;

create or replace function public.lexa_svc_admin_audit(by_user uuid, act text, tgt uuid, info jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.lexa_is_service() then raise exception 'service only'; end if;
  insert into public.lexa_audit_log (actor, org_id, action, target, detail)
  values (by_user, null, left(coalesce(act, ''), 60), tgt, coalesce(info, '{}'::jsonb));
end $$;

-- --- audit search ---
create or replace function public.lexa_admin_audit(p_from timestamptz default null, p_to timestamptz default null,
                                                   p_action text default '', p_org uuid default null, p_actor text default '',
                                                   lim int default 100, off int default 0)
returns table (id bigint, at timestamptz, actor uuid, actor_username text, org_id uuid, org_name text, action text,
               target uuid, target_username text, detail jsonb, total bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_act text := trim(coalesce(p_action, ''));
  v_actor text := lower(trim(coalesce(p_actor, '')));
begin
  perform public.lexa_admin_require(true);
  return query
    select a.id, a.at, a.actor, p.username, a.org_id, o.name, a.action, a.target, t.username, a.detail, count(*) over ()
    from public.lexa_audit_log a
    left join public.lexa_profiles p on p.id = a.actor
    left join public.lexa_profiles t on t.id = a.target
    left join public.lexa_orgs o on o.id = a.org_id
    where (p_from is null or a.at >= p_from) and (p_to is null or a.at < p_to)
      and (v_act = '' or a.action like v_act || '%')
      and (p_org is null or a.org_id = p_org)
      and (v_actor = '' or lower(coalesce(p.username, '')) = v_actor)
    order by a.at desc
    limit greatest(1, least(coalesce(lim, 100), 1000)) offset greatest(0, coalesce(off, 0));
end $$;

-- --- grants ---
revoke execute on function public.lexa_orgs_guard_lifecycle() from public, anon, authenticated;
revoke execute on function public.lexa_admin_require(boolean) from public, anon, authenticated;
revoke execute on function public.lexa_mask_email(text) from public, anon, authenticated;
revoke execute on function public.lexa_tehran_today() from public, anon;
revoke execute on function public.lexa_admin_home() from public, anon;
revoke execute on function public.lexa_admin_orgs_overview() from public, anon;
revoke execute on function public.lexa_admin_org_lifecycle(uuid, text, text, integer) from public, anon;
revoke execute on function public.lexa_admin_org_update(uuid, text, integer, integer, timestamptz, boolean, text) from public, anon;
revoke execute on function public.lexa_admin_org_purge(uuid, text) from public, anon;
revoke execute on function public.lexa_admin_users(text, text, text, integer, integer) from public, anon;
revoke execute on function public.lexa_admin_user_detail(uuid) from public, anon;
revoke execute on function public.lexa_admin_change_role(uuid, text, text) from public, anon;
revoke execute on function public.lexa_admin_user_authorize(uuid, text, text) from public, anon;
revoke execute on function public.lexa_svc_user_flag(uuid, boolean, uuid, text) from public, anon, authenticated;
revoke execute on function public.lexa_svc_admin_audit(uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.lexa_admin_audit(timestamptz, timestamptz, text, uuid, text, integer, integer) from public, anon;

grant execute on function public.lexa_tehran_today() to authenticated;
grant execute on function public.lexa_admin_home() to authenticated;
grant execute on function public.lexa_admin_orgs_overview() to authenticated;
grant execute on function public.lexa_admin_org_lifecycle(uuid, text, text, integer) to authenticated;
grant execute on function public.lexa_admin_org_update(uuid, text, integer, integer, timestamptz, boolean, text) to authenticated;
grant execute on function public.lexa_admin_org_purge(uuid, text) to authenticated;
grant execute on function public.lexa_admin_users(text, text, text, integer, integer) to authenticated;
grant execute on function public.lexa_admin_user_detail(uuid) to authenticated;
grant execute on function public.lexa_admin_change_role(uuid, text, text) to authenticated;
grant execute on function public.lexa_admin_user_authorize(uuid, text, text) to authenticated;
grant execute on function public.lexa_admin_audit(timestamptz, timestamptz, text, uuid, text, integer, integer) to authenticated;
grant execute on function public.lexa_svc_user_flag(uuid, boolean, uuid, text) to service_role;
grant execute on function public.lexa_svc_admin_audit(uuid, text, uuid, jsonb) to service_role;

notify pgrst, 'reload schema';
