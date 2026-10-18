-- Lexa 010: the Lexa API for centres (phase 5 of docs/ORG_LEARNING.md, docs/ORG_API.md).
-- Run in the Supabase SQL editor after 006, 007, 008 and 009. Safe to re-run.
--
--   * API keys per centre: name, scopes, optional IP allow-list, expiry, sandbox (dry run)
--   * the secret is never stored: supabase/functions/org-api derives it as
--     HMAC(LEXA_API_PEPPER, key id + salt) and shows it once; requests are signed with it
--     (timestamp + method + path + body hash), so the secret never travels either
--   * idempotency keys, a per-key rate limit and a request log without bodies or personal data
--   * bulk upserts for classes, enrolments, grades and prior GPA (service key only); accounts,
--     staff and status changes are done in the Edge Function (they need the Auth admin API)
-- Clients get no table access; managers manage keys with a two-factor session (aal2).

do $$ begin
  if to_regprocedure('public.lexa_grades_upsert(uuid, jsonb, text)') is null
     or to_regprocedure('public.lexa_org_study_report(uuid, date, date)') is null then
    raise exception 'run 006, 007, 008 and 009 first';
  end if;
end $$;

-- terms get an optional code so an outside system can match them (e.g. "1404-1")
alter table public.lexa_org_terms add column if not exists code text not null default '';
do $$ begin
  alter table public.lexa_org_terms add constraint lexa_org_terms_code_len check (char_length(code) <= 30);
exception when duplicate_object then null;
end $$;
create unique index if not exists lexa_org_terms_code_key on public.lexa_org_terms (org_id, lower(code)) where code <> '';

-- --- tables ---
create table if not exists public.lexa_org_api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.lexa_orgs(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  salt text not null,
  hint text not null default '' check (char_length(hint) <= 12),
  scopes text[] not null default '{}',
  allowed_ips text[] not null default '{}',
  sandbox boolean not null default false,
  expires_at timestamptz,
  created_by uuid references public.lexa_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.lexa_profiles(id) on delete set null
);
create index if not exists lexa_org_api_keys_org_idx on public.lexa_org_api_keys (org_id);

create table if not exists public.lexa_org_api_idem (
  key_id uuid not null references public.lexa_org_api_keys(id) on delete cascade,
  idem_key text not null check (char_length(idem_key) between 1 and 100),
  req_hash text not null,
  status_code int not null default 0,
  response jsonb,
  created_at timestamptz not null default now(),
  primary key (key_id, idem_key)
);

create table if not exists public.lexa_org_api_usage (
  key_id uuid not null references public.lexa_org_api_keys(id) on delete cascade,
  minute timestamptz not null,
  n int not null default 0,
  primary key (key_id, minute)
);

create table if not exists public.lexa_org_api_log (
  id bigint generated always as identity primary key,
  key_id uuid references public.lexa_org_api_keys(id) on delete set null,
  org_id uuid references public.lexa_orgs(id) on delete cascade,
  at timestamptz not null default now(),
  method text not null default '',
  path text not null default '' check (char_length(path) <= 120),
  status int not null default 0,
  ms int not null default 0,
  n_rows int not null default 0,
  error text not null default '' check (char_length(error) <= 80),
  sandbox boolean not null default false
);
create index if not exists lexa_org_api_log_org_idx on public.lexa_org_api_log (org_id, at desc);

alter table public.lexa_org_api_keys enable row level security;
alter table public.lexa_org_api_idem enable row level security;
alter table public.lexa_org_api_usage enable row level security;
alter table public.lexa_org_api_log enable row level security;
revoke all on public.lexa_org_api_keys, public.lexa_org_api_idem, public.lexa_org_api_usage, public.lexa_org_api_log
  from public, anon, authenticated;

create or replace function public.lexa_api_scopes()
returns text[] language sql immutable as $$
  select array['students:write', 'staff:write', 'classes:write', 'enrollments:write', 'grades:write',
               'status:write', 'reports:read']
$$;

-- --- key management (owner / manager / Lexa admin, two-factor) ---
-- returns id + salt; only the Edge Function (which knows the pepper) can turn them into the secret
create or replace function public.lexa_org_api_key_new(o uuid, k_name text, k_scopes text[], k_ips text[],
                                                      k_days int, k_sandbox boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_salt text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_ips text[] := coalesce(k_ips, '{}');
  v_ip text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  perform public.lexa_org_require_manager(o, true);
  if not public.lexa_org_active(o) then raise exception 'org_not_active'; end if;
  if char_length(trim(coalesce(k_name, ''))) not between 1 and 60 then raise exception 'bad_input'; end if;
  if coalesce(cardinality(k_scopes), 0) = 0 or not (k_scopes <@ public.lexa_api_scopes()) then
    raise exception 'bad_scopes';
  end if;
  if cardinality(v_ips) > 20 then raise exception 'bad_ips'; end if;
  foreach v_ip in array v_ips loop
    begin
      perform trim(v_ip)::inet;
    exception when others then
      raise exception 'bad_ips';
    end;
  end loop;
  if k_days is not null and (k_days < 1 or k_days > 730) then raise exception 'bad_input'; end if;
  if (select count(*) from public.lexa_org_api_keys
      where org_id = o and revoked_at is null and (expires_at is null or expires_at > now())) >= 10 then
    raise exception 'too_many_keys';
  end if;
  insert into public.lexa_org_api_keys (org_id, name, salt, scopes, allowed_ips, sandbox, expires_at, created_by)
  values (o, trim(k_name), v_salt, k_scopes, (select coalesce(array_agg(trim(x)), '{}') from unnest(v_ips) x),
          coalesce(k_sandbox, false), case when k_days is null then null else now() + make_interval(days => k_days) end,
          auth.uid())
  returning id into v_id;
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(o, 'api.key_create', v_id, jsonb_build_object('name', trim(k_name), 'scopes', k_scopes,
    'sandbox', coalesce(k_sandbox, false), 'ips', cardinality(v_ips), 'days', k_days));
  return jsonb_build_object('id', v_id, 'salt', v_salt);
end $$;

create or replace function public.lexa_org_api_keys(o uuid)
returns table (id uuid, name text, hint text, scopes text[], allowed_ips text[], sandbox boolean,
               expires_at timestamptz, created_at timestamptz, created_by_name text, last_used_at timestamptz,
               revoked_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.lexa_org_require_manager(o, true);
  return query
    select k.id, k.name, k.hint, k.scopes, k.allowed_ips, k.sandbox, k.expires_at, k.created_at,
      coalesce(nullif(p.display_name, ''), p.username, ''), k.last_used_at, k.revoked_at
    from public.lexa_org_api_keys k
    left join public.lexa_profiles p on p.id = k.created_by
    where k.org_id = o
    order by (k.revoked_at is null) desc, k.created_at desc;
end $$;

-- revoke now, or let it expire after grace_hours (to rotate without downtime)
create or replace function public.lexa_org_api_key_revoke(k uuid, grace_hours int default 0)
returns text language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select a.org_id into v_org from public.lexa_org_api_keys a where a.id = k;
  if v_org is null then raise exception 'not_found'; end if;
  perform public.lexa_org_require_manager(v_org, true);
  if coalesce(grace_hours, 0) < 0 or coalesce(grace_hours, 0) > 168 then raise exception 'bad_input'; end if;
  if coalesce(grace_hours, 0) = 0 then
    update public.lexa_org_api_keys set revoked_at = now(), revoked_by = auth.uid() where id = k and revoked_at is null;
  else
    update public.lexa_org_api_keys
      set expires_at = least(coalesce(expires_at, 'infinity'::timestamptz), now() + make_interval(hours => grace_hours))
    where id = k and revoked_at is null;
  end if;
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(v_org, 'api.key_revoke', k, jsonb_build_object('grace_hours', coalesce(grace_hours, 0)));
  return 'ok';
end $$;

create or replace function public.lexa_org_api_log_list(o uuid, lim int default 200)
returns table (at timestamptz, key_name text, method text, path text, status int, ms int, n_rows int, error text,
               sandbox boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.lexa_org_require_manager(o, true);
  return query
    select l.at, coalesce(k.name, ''), l.method, l.path, l.status, l.ms, l.n_rows, l.error, l.sandbox
    from public.lexa_org_api_log l
    left join public.lexa_org_api_keys k on k.id = l.key_id
    where l.org_id = o
    order by l.at desc
    limit least(greatest(coalesce(lim, 200), 1), 1000);
end $$;

-- --- the Edge Function (service key only) ---
create or replace function public.lexa_api_require_service()
returns void language plpgsql stable as $$
begin
  if not public.lexa_is_service() then raise exception 'service only'; end if;
end $$;

-- the key, its centre, and whether this caller IP may use it. The salt is returned even when the
-- key is not usable, so the function can check the signature before it tells the caller why.
create or replace function public.lexa_api_key_check(k uuid, ip text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  r public.lexa_org_api_keys;
  v_ip inet;
  v_reason text := '';
begin
  perform public.lexa_api_require_service();
  select * into r from public.lexa_org_api_keys a where a.id = k;
  if not found then return jsonb_build_object('found', false); end if;
  if r.revoked_at is not null then v_reason := 'key_revoked';
  elsif r.expires_at is not null and r.expires_at <= now() then v_reason := 'key_expired';
  elsif not public.lexa_org_active(r.org_id) then v_reason := 'org_not_active';
  elsif cardinality(r.allowed_ips) > 0 then
    begin
      v_ip := trim(coalesce(ip, ''))::inet;
    exception when others then
      v_ip := null;
    end;
    if v_ip is null or not exists (select 1 from unnest(r.allowed_ips) a where v_ip <<= a::inet) then
      v_reason := 'ip_not_allowed';
    end if;
  end if;
  return jsonb_build_object('found', true, 'ok', v_reason = '', 'reason', v_reason, 'org_id', r.org_id,
    'salt', r.salt, 'scopes', to_jsonb(r.scopes), 'sandbox', r.sandbox, 'name', r.name);
end $$;

-- one more request this minute; false when the key is over its limit. Also sweeps old rows.
create or replace function public.lexa_api_rate_hit(k uuid, per_min int)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  perform public.lexa_api_require_service();
  insert into public.lexa_org_api_usage (key_id, minute, n) values (k, date_trunc('minute', now()), 1)
  on conflict (key_id, minute) do update set n = public.lexa_org_api_usage.n + 1
  returning n into v_n;
  update public.lexa_org_api_keys set last_used_at = now()
  where id = k and (last_used_at is null or last_used_at < now() - interval '1 minute');
  if random() < 0.01 then
    delete from public.lexa_org_api_usage where minute < now() - interval '1 day';
    delete from public.lexa_org_api_idem where created_at < now() - interval '1 day';
    delete from public.lexa_org_api_log where at < now() - interval '180 days';
  end if;
  return v_n <= greatest(coalesce(per_min, 120), 1);
end $$;

-- idempotency: "new" (go ahead), "replay" (same request: stored answer), "conflict" (same key,
-- different request) or "busy" (the first request is still running)
create or replace function public.lexa_api_idem_begin(k uuid, ikey text, h text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.lexa_org_api_idem;
begin
  perform public.lexa_api_require_service();
  insert into public.lexa_org_api_idem (key_id, idem_key, req_hash) values (k, ikey, h)
  on conflict (key_id, idem_key) do nothing;
  if found then return jsonb_build_object('state', 'new'); end if;
  select * into r from public.lexa_org_api_idem i where i.key_id = k and i.idem_key = ikey;
  if r.req_hash <> h then return jsonb_build_object('state', 'conflict'); end if;
  if r.status_code = 0 then
    if r.created_at < now() - interval '10 minutes' then
      update public.lexa_org_api_idem set created_at = now() where key_id = k and idem_key = ikey;
      return jsonb_build_object('state', 'new');
    end if;
    return jsonb_build_object('state', 'busy');
  end if;
  return jsonb_build_object('state', 'replay', 'status', r.status_code, 'response', r.response);
end $$;

create or replace function public.lexa_api_idem_end(k uuid, ikey text, code int, resp jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.lexa_api_require_service();
  if code is null or code = 0 or code >= 500 then
    delete from public.lexa_org_api_idem where key_id = k and idem_key = ikey;
  else
    update public.lexa_org_api_idem set status_code = code, response = resp where key_id = k and idem_key = ikey;
  end if;
end $$;

-- roster row by external id, username, student number or roster id
create or replace function public.lexa_api_find_student(o uuid, ref text)
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    (select s.id from public.lexa_org_students s
     where s.org_id = o and s.external_id <> '' and s.external_id = trim(coalesce(ref, '')) limit 1),
    public.lexa_org_find_student(o, coalesce(ref, '')))
$$;

-- --- bulk upserts. dry = true checks and reports everything, then rolls it all back. ---
-- classes: [{ "external_id": "c-101", "title": "group 1", "status": "active",
--             "term": { "code": "1404-1", "title": "...", "starts_on": "2025-09-23", "ends_on": "...", "status": "current" },
--             "course": { "code": "LAW101", "title": "...", "units": 3 }, "teacher": "<staff username>" }]
create or replace function public.lexa_api_classes(o uuid, items jsonb, dry boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_out jsonb := '[]'::jsonb;
  v_row jsonb;
  v_i int := 0;
  v_ext text;
  v_t jsonb;
  v_c jsonb;
  v_tcode text;
  v_ttitle text;
  v_tstatus text;
  v_tid uuid;
  v_ccode text;
  v_ctitle text;
  v_cid uuid;
  v_teacher uuid;
  v_has_teacher boolean;
  v_kid uuid;
  v_status text;
  v_res text;
  v_old_status text;
begin
  perform public.lexa_api_require_service();
  if not public.lexa_org_active(o) then raise exception 'org_not_active'; end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 or jsonb_array_length(items) > 500 then
    raise exception 'bad_batch';
  end if;
  begin
    for v_row in select value from jsonb_array_elements(items) loop
      v_i := v_i + 1;
      v_ext := left(trim(coalesce(v_row ->> 'external_id', '')), 80);
      begin
        if v_ext = '' then raise exception 'missing_external_id'; end if;
        v_t := coalesce(v_row -> 'term', '{}'::jsonb);
        v_c := coalesce(v_row -> 'course', '{}'::jsonb);
        v_tcode := left(trim(coalesce(v_t ->> 'code', '')), 30);
        v_ttitle := left(trim(coalesce(v_t ->> 'title', '')), 60);
        v_tstatus := nullif(trim(coalesce(v_t ->> 'status', '')), '');
        v_ccode := left(trim(coalesce(v_c ->> 'code', '')), 30);
        v_ctitle := left(trim(coalesce(v_c ->> 'title', '')), 120);
        v_status := coalesce(nullif(trim(coalesce(v_row ->> 'status', '')), ''), 'active');
        if v_status not in ('active', 'archived') or coalesce(v_tstatus, 'current') not in ('planned', 'current', 'closed') then
          raise exception 'bad_status';
        end if;

        -- term: by code, else by title
        v_tid := null;
        if v_tcode <> '' then
          select t.id, t.status into v_tid, v_old_status from public.lexa_org_terms t where t.org_id = o and lower(t.code) = lower(v_tcode);
        elsif v_ttitle <> '' then
          select t.id, t.status into v_tid, v_old_status from public.lexa_org_terms t where t.org_id = o and t.title = v_ttitle
          order by t.created_at desc limit 1;
        else
          raise exception 'missing_term';
        end if;
        if v_tid is null then
          if v_ttitle = '' then v_ttitle := v_tcode; end if;
          insert into public.lexa_org_terms (org_id, code, title, starts_on, ends_on, status)
          values (o, v_tcode, v_ttitle, nullif(v_t ->> 'starts_on', '')::date, nullif(v_t ->> 'ends_on', '')::date,
                  coalesce(v_tstatus, 'current'))
          returning id into v_tid;
        else
          update public.lexa_org_terms set
            title = case when v_ttitle <> '' then v_ttitle else title end,
            starts_on = coalesce(nullif(v_t ->> 'starts_on', '')::date, starts_on),
            ends_on = coalesce(nullif(v_t ->> 'ends_on', '')::date, ends_on),
            status = coalesce(v_tstatus, status)
          where id = v_tid;
          if v_tstatus = 'closed' and v_old_status <> 'closed' then
            update public.lexa_org_enrollments e set status = 'completed'
            from public.lexa_org_classes c
            where c.id = e.class_id and c.term_id = v_tid and e.status = 'enrolled';
          end if;
        end if;

        -- subject: by code, else by title
        v_cid := null;
        if v_ccode <> '' then
          select s.id into v_cid from public.lexa_org_courses s where s.org_id = o and lower(s.code) = lower(v_ccode);
        elsif v_ctitle <> '' then
          select s.id into v_cid from public.lexa_org_courses s where s.org_id = o and s.title = v_ctitle
          order by s.created_at desc limit 1;
        else
          raise exception 'missing_course';
        end if;
        if v_cid is null then
          if v_ctitle = '' then raise exception 'missing_course'; end if;
          insert into public.lexa_org_courses (org_id, code, title, units)
          values (o, v_ccode, v_ctitle, coalesce(nullif(v_c ->> 'units', '')::numeric, 0))
          returning id into v_cid;
        else
          update public.lexa_org_courses set
            title = case when v_ctitle <> '' then v_ctitle else title end,
            units = coalesce(nullif(v_c ->> 'units', '')::numeric, units)
          where id = v_cid;
        end if;

        -- teacher: a staff username of this centre, still an active member
        v_has_teacher := v_row ? 'teacher';
        v_teacher := null;
        if v_has_teacher and coalesce(v_row ->> 'teacher', '') <> '' then
          select l.user_id into v_teacher from public.lexa_org_logins l
          join public.lexa_org_members m on m.org_id = o and m.user_id = l.user_id and m.status = 'active'
          where l.org_id = o and l.kind = 'staff' and lower(l.org_username) = lower(trim(v_row ->> 'teacher'))
          limit 1;
          if v_teacher is null then raise exception 'teacher_not_found'; end if;
        end if;

        select c.id into v_kid from public.lexa_org_classes c where c.org_id = o and c.external_id = v_ext;
        if v_kid is null then
          insert into public.lexa_org_classes (org_id, term_id, course_id, title, teacher_id, external_id, status)
          values (o, v_tid, v_cid, left(trim(coalesce(v_row ->> 'title', '')), 120), v_teacher, v_ext, v_status)
          returning id into v_kid;
          v_res := 'created';
        else
          update public.lexa_org_classes set term_id = v_tid, course_id = v_cid,
            title = case when v_row ? 'title' then left(trim(coalesce(v_row ->> 'title', '')), 120) else title end,
            teacher_id = case when v_has_teacher then v_teacher else teacher_id end,
            status = v_status
          where id = v_kid;
          v_res := 'updated';
        end if;
        v_out := v_out || jsonb_build_object('row', v_i, 'external_id', v_ext, 'result', v_res, 'id', v_kid);
      exception when others then
        v_out := v_out || jsonb_build_object('row', v_i, 'external_id', v_ext, 'result', 'error',
          'error', case when sqlstate = 'P0001' then sqlerrm when sqlstate in ('22007', '22008', '22P02') then 'bad_value' else 'error' end);
      end;
    end loop;
    if dry then raise exception 'lexa_dry_run'; end if;
  exception when raise_exception then
    if sqlerrm <> 'lexa_dry_run' then raise; end if;
  end;
  return v_out;
end $$;

-- enrolments: [{ "class": "<class external_id>", "student": "<external_id | username | student no>",
--                "status": "enrolled" | "completed" | "dropped" }]
create or replace function public.lexa_api_enrollments(o uuid, items jsonb, dry boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_out jsonb := '[]'::jsonb;
  v_row jsonb;
  v_i int := 0;
  v_kid uuid;
  v_sid uuid;
  v_st text;
  v_sstatus text;
  v_prev text;
begin
  perform public.lexa_api_require_service();
  if not public.lexa_org_active(o) then raise exception 'org_not_active'; end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 or jsonb_array_length(items) > 2000 then
    raise exception 'bad_batch';
  end if;
  begin
    for v_row in select value from jsonb_array_elements(items) loop
      v_i := v_i + 1;
      begin
        select c.id into v_kid from public.lexa_org_classes c
        where c.org_id = o and c.external_id <> '' and c.external_id = trim(coalesce(v_row ->> 'class', ''));
        if v_kid is null then raise exception 'class_not_found'; end if;
        v_sid := public.lexa_api_find_student(o, v_row ->> 'student');
        if v_sid is null then raise exception 'student_not_found'; end if;
        v_st := coalesce(nullif(trim(coalesce(v_row ->> 'status', '')), ''), 'enrolled');
        if v_st not in ('enrolled', 'completed', 'dropped') then raise exception 'bad_status'; end if;
        select s.status into v_sstatus from public.lexa_org_students s where s.id = v_sid;
        if v_st = 'enrolled' and v_sstatus <> 'active' then raise exception 'student_not_active'; end if;
        select e.status into v_prev from public.lexa_org_enrollments e where e.class_id = v_kid and e.student_id = v_sid;
        if v_prev is null then
          if v_st = 'dropped' then raise exception 'not_enrolled'; end if;
          insert into public.lexa_org_enrollments (class_id, student_id, org_id, status) values (v_kid, v_sid, o, v_st);
          v_out := v_out || jsonb_build_object('row', v_i, 'result', 'created', 'status', v_st);
        elsif v_prev = v_st then
          v_out := v_out || jsonb_build_object('row', v_i, 'result', 'same', 'status', v_st);
        else
          update public.lexa_org_enrollments set status = v_st where class_id = v_kid and student_id = v_sid;
          v_out := v_out || jsonb_build_object('row', v_i, 'result', 'updated', 'status', v_st);
        end if;
      exception when others then
        v_out := v_out || jsonb_build_object('row', v_i, 'result', 'error',
          'error', case when sqlstate = 'P0001' then sqlerrm else 'error' end);
      end;
    end loop;
    if dry then raise exception 'lexa_dry_run'; end if;
  exception when raise_exception then
    if sqlerrm <> 'lexa_dry_run' then raise; end if;
  end;
  return v_out;
end $$;

-- grades: [{ "class": "<class external_id>", "student": "...", "component": "midterm" | "final_exam" | "final",
--            "score": 17.5, "max": 20, "note": "" }]  (uses lexa_grades_upsert of 008 with source "api")
create or replace function public.lexa_api_grades(o uuid, items jsonb, dry boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_res jsonb := '{}'::jsonb;
  v_groups jsonb := '{}'::jsonb;
  v_row jsonb;
  v_i int := 0;
  v_kid uuid;
  v_sid uuid;
  v_k text;
  v_list jsonb;
  r record;
begin
  perform public.lexa_api_require_service();
  if not public.lexa_org_active(o) then raise exception 'org_not_active'; end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 or jsonb_array_length(items) > 2000 then
    raise exception 'bad_batch';
  end if;
  for v_row in select value from jsonb_array_elements(items) loop
    v_i := v_i + 1;
    select c.id into v_kid from public.lexa_org_classes c
    where c.org_id = o and c.external_id <> '' and c.external_id = trim(coalesce(v_row ->> 'class', ''));
    v_sid := public.lexa_api_find_student(o, v_row ->> 'student');
    if v_kid is null then
      v_res := v_res || jsonb_build_object(v_i::text, 'class_not_found');
    elsif v_sid is null then
      v_res := v_res || jsonb_build_object(v_i::text, 'student_not_found');
    else
      v_groups := jsonb_set(v_groups, array[v_kid::text],
        coalesce(v_groups -> v_kid::text, '[]'::jsonb) || jsonb_build_object('i', v_i, 'item', jsonb_build_object(
          'ref', v_sid::text, 'component', v_row ->> 'component', 'score', v_row ->> 'score',
          'max', v_row ->> 'max', 'note', coalesce(v_row ->> 'note', ''))));
    end if;
  end loop;
  begin
    for v_k, v_list in select key, value from jsonb_each(v_groups) loop
      for r in select g.row_no, g.result
               from public.lexa_grades_upsert(v_k::uuid, (select jsonb_agg(x -> 'item' order by ord)
                                                         from jsonb_array_elements(v_list) with ordinality as t(x, ord)), 'api') g loop
        v_res := v_res || jsonb_build_object((v_list -> (r.row_no - 1) ->> 'i'), r.result);
      end loop;
    end loop;
    if dry then raise exception 'lexa_dry_run'; end if;
  exception when raise_exception then
    if sqlerrm <> 'lexa_dry_run' then raise; end if;
  end;
  return (select coalesce(jsonb_agg(jsonb_build_object('row', n, 'result', coalesce(v_res ->> n::text, 'error'))
                          order by n), '[]'::jsonb)
          from generate_series(1, v_i) n);
end $$;

-- prior GPA (for the comparison report): [{ "student": "...", "gpa": 16.4, "as_of": "1403-2" }]
create or replace function public.lexa_api_prior_gpa(o uuid, items jsonb, dry boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_res jsonb := '{}'::jsonb;
  v_ok jsonb := '[]'::jsonb;
  v_map int[] := '{}';
  v_row jsonb;
  v_i int := 0;
  v_sid uuid;
  r record;
begin
  perform public.lexa_api_require_service();
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 or jsonb_array_length(items) > 5000 then
    raise exception 'bad_batch';
  end if;
  for v_row in select value from jsonb_array_elements(items) loop
    v_i := v_i + 1;
    v_sid := public.lexa_api_find_student(o, v_row ->> 'student');
    if v_sid is null then
      v_res := v_res || jsonb_build_object(v_i::text, 'student_not_found');
    else
      v_ok := v_ok || jsonb_build_object('ref', v_sid::text, 'gpa', v_row ->> 'gpa', 'as_of', coalesce(v_row ->> 'as_of', ''));
      v_map := v_map || v_i;
    end if;
  end loop;
  begin
    if jsonb_array_length(v_ok) > 0 then
      for r in select g.row_no, g.result from public.lexa_prior_gpa_upsert(o, v_ok, 'api') g loop
        v_res := v_res || jsonb_build_object(v_map[r.row_no]::text, r.result);
      end loop;
    end if;
    if dry then raise exception 'lexa_dry_run'; end if;
  exception when raise_exception then
    if sqlerrm <> 'lexa_dry_run' then raise; end if;
  end;
  return (select coalesce(jsonb_agg(jsonb_build_object('row', n, 'result', coalesce(v_res ->> n::text, 'error'))
                          order by n), '[]'::jsonb)
          from generate_series(1, v_i) n);
end $$;

-- --- reads for GET /v1/reports/... ---
create or replace function public.lexa_api_report_students(o uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.lexa_api_require_service();
  return coalesce((select jsonb_agg(jsonb_build_object(
      'username', s.org_username, 'student_no', s.student_no, 'external_id', s.external_id, 'full_name', s.full_name,
      'field', s.field, 'entry_year', s.entry_year, 'status', s.status, 'access_after_exit', s.access_after_exit,
      'access_until', s.access_until, 'official_since', s.official_since, 'linked', s.user_id is not null,
      'terms_accepted', s.terms_accepted_at is not null) order by s.org_username)
    from public.lexa_org_students s where s.org_id = o), '[]'::jsonb);
end $$;

create or replace function public.lexa_api_report_classes(o uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.lexa_api_require_service();
  return coalesce((select jsonb_agg(jsonb_build_object(
      'external_id', c.external_id, 'title', c.title, 'status', c.status,
      'term', jsonb_build_object('code', t.code, 'title', t.title, 'status', t.status, 'starts_on', t.starts_on, 'ends_on', t.ends_on),
      'course', jsonb_build_object('code', s.code, 'title', s.title, 'units', s.units),
      'teacher', (select l.org_username from public.lexa_org_logins l
                  where l.org_id = o and l.user_id = c.teacher_id and l.kind = 'staff' limit 1),
      'students', (select count(*) from public.lexa_org_enrollments e where e.class_id = c.id and e.status <> 'dropped'))
      order by t.created_at desc, s.title, c.title)
    from public.lexa_org_classes c
    join public.lexa_org_terms t on t.id = c.term_id
    join public.lexa_org_courses s on s.id = c.course_id
    where c.org_id = o), '[]'::jsonb);
end $$;

create or replace function public.lexa_api_report_grades(o uuid, term_code text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.lexa_api_require_service();
  return coalesce((select jsonb_agg(jsonb_build_object(
      'class', c.external_id, 'term', t.code, 'course', s.code, 'student', st.org_username,
      'student_external_id', st.external_id, 'component', g.component, 'score', g.score, 'max', g.max_score,
      'source', g.source, 'updated_at', g.updated_at) order by c.external_id, st.org_username, g.component)
    from public.lexa_org_grades g
    join public.lexa_org_classes c on c.id = g.class_id
    join public.lexa_org_terms t on t.id = c.term_id
    join public.lexa_org_courses s on s.id = c.course_id
    join public.lexa_org_students st on st.id = g.student_id
    where g.org_id = o and (coalesce(term_code, '') = '' or lower(t.code) = lower(term_code))), '[]'::jsonb);
end $$;

-- --- grants (002 granted every function to anon; be explicit) ---
revoke execute on function public.lexa_api_scopes() from public, anon;
revoke execute on function public.lexa_org_api_key_new(uuid, text, text[], text[], integer, boolean) from public, anon;
revoke execute on function public.lexa_org_api_keys(uuid) from public, anon;
revoke execute on function public.lexa_org_api_key_revoke(uuid, integer) from public, anon;
revoke execute on function public.lexa_org_api_log_list(uuid, integer) from public, anon;
revoke execute on function public.lexa_api_require_service() from public, anon, authenticated;
revoke execute on function public.lexa_api_key_check(uuid, text) from public, anon, authenticated;
revoke execute on function public.lexa_api_rate_hit(uuid, integer) from public, anon, authenticated;
revoke execute on function public.lexa_api_idem_begin(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.lexa_api_idem_end(uuid, text, integer, jsonb) from public, anon, authenticated;
revoke execute on function public.lexa_api_find_student(uuid, text) from public, anon, authenticated;
revoke execute on function public.lexa_api_classes(uuid, jsonb, boolean) from public, anon, authenticated;
revoke execute on function public.lexa_api_enrollments(uuid, jsonb, boolean) from public, anon, authenticated;
revoke execute on function public.lexa_api_grades(uuid, jsonb, boolean) from public, anon, authenticated;
revoke execute on function public.lexa_api_prior_gpa(uuid, jsonb, boolean) from public, anon, authenticated;
revoke execute on function public.lexa_api_report_students(uuid) from public, anon, authenticated;
revoke execute on function public.lexa_api_report_classes(uuid) from public, anon, authenticated;
revoke execute on function public.lexa_api_report_grades(uuid, text) from public, anon, authenticated;

grant execute on function public.lexa_api_scopes() to authenticated, service_role;
grant execute on function public.lexa_org_api_key_new(uuid, text, text[], text[], integer, boolean) to authenticated;
grant execute on function public.lexa_org_api_keys(uuid) to authenticated;
grant execute on function public.lexa_org_api_key_revoke(uuid, integer) to authenticated;
grant execute on function public.lexa_org_api_log_list(uuid, integer) to authenticated;
grant execute on function public.lexa_api_require_service() to service_role;
grant execute on function public.lexa_api_key_check(uuid, text) to service_role;
grant execute on function public.lexa_api_rate_hit(uuid, integer) to service_role;
grant execute on function public.lexa_api_idem_begin(uuid, text, text) to service_role;
grant execute on function public.lexa_api_idem_end(uuid, text, integer, jsonb) to service_role;
grant execute on function public.lexa_api_find_student(uuid, text) to service_role;
grant execute on function public.lexa_api_classes(uuid, jsonb, boolean) to service_role;
grant execute on function public.lexa_api_enrollments(uuid, jsonb, boolean) to service_role;
grant execute on function public.lexa_api_grades(uuid, jsonb, boolean) to service_role;
grant execute on function public.lexa_api_prior_gpa(uuid, jsonb, boolean) to service_role;
grant execute on function public.lexa_api_report_students(uuid) to service_role;
grant execute on function public.lexa_api_report_classes(uuid) to service_role;
grant execute on function public.lexa_api_report_grades(uuid, text) to service_role;
grant execute on function public.lexa_org_study_report(uuid, date, date) to service_role;
grant execute on function public.lexa_grades_upsert(uuid, jsonb, text) to service_role;
grant execute on function public.lexa_prior_gpa_upsert(uuid, jsonb, text) to service_role;

notify pgrst, 'reload schema';
