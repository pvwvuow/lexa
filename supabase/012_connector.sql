-- Lexa 012: connector (phase 7 of docs/ORG_LEARNING.md): Lexa reads the centre's own server.
-- Run in the Supabase SQL editor after 006 to 011. Safe to re-run. Needs Supabase Vault (on by default).
--
--   * a centre (owner / manager, two-factor) sets up to 5 integrations: an HTTPS address on its own
--     server that answers JSON or CSV, a read-only credential (kept in Supabase Vault, never shown
--     again, never logged), which resources to read and which source field feeds which Lexa field
--   * only the mapped fields are read; nothing raw is stored, the run log keeps counts and error
--     codes with row numbers only
--   * runs: by hand, or on a schedule (hourly / daily / weekly at a Tehran hour) through
--     supabase/functions/org-connector (pg_cron calls /tick, see docs/ORG_P7_SETUP.md)
--   * students and staff go through the centre API (010) with a key made for the integration;
--     classes, enrolments, grades and prior GPA go straight to the same SQL as the API, marked
--     source = 'connector'

do $$ begin
  if to_regprocedure('public.lexa_compare_terms(uuid)') is null then
    raise exception 'run 006, 007, 008, 009, 010 and 011 first';
  end if;
  if to_regclass('vault.secrets') is null then
    raise exception 'enable Supabase Vault first (Database > Extensions > supabase_vault)';
  end if;
end $$;

-- --- tables ---
create table if not exists public.lexa_org_integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.lexa_orgs(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null default 'rest_json' check (kind in ('rest_json', 'csv_url')),
  base_url text not null check (base_url ~ '^https://[^/\s?#@]+' and char_length(base_url) <= 300),
  auth_kind text not null default 'none' check (auth_kind in ('none', 'bearer', 'basic', 'header')),
  auth_user text not null default '' check (char_length(auth_user) <= 100),
  secret_id uuid,
  resources jsonb not null default '{}'::jsonb,
  options jsonb not null default '{}'::jsonb,
  schedule text not null default 'manual' check (schedule in ('manual', 'hourly', 'daily', 'weekly')),
  run_hour int not null default 3 check (run_hour between 0 and 23),
  enabled boolean not null default true,
  api_key_id uuid references public.lexa_org_api_keys(id) on delete set null,
  next_run_at timestamptz,
  last_run_at timestamptz,
  last_status text not null default '',
  created_by uuid references public.lexa_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lexa_org_integrations_org_idx on public.lexa_org_integrations (org_id);
create index if not exists lexa_org_integrations_due_idx on public.lexa_org_integrations (next_run_at) where enabled;

create table if not exists public.lexa_org_integration_runs (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.lexa_org_integrations(id) on delete cascade,
  org_id uuid not null references public.lexa_orgs(id) on delete cascade,
  via text not null default 'manual' check (via in ('manual', 'schedule')),
  dry boolean not null default false,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'ok', 'partial', 'failed')),
  counts jsonb not null default '{}'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  message text not null default '' check (char_length(message) <= 300),
  started_by uuid references public.lexa_profiles(id) on delete set null
);
create index if not exists lexa_org_integration_runs_idx on public.lexa_org_integration_runs (integration_id, started_at desc);
create index if not exists lexa_org_integration_runs_org_idx on public.lexa_org_integration_runs (org_id, started_at desc);

drop trigger if exists lexa_org_integrations_touch on public.lexa_org_integrations;
create trigger lexa_org_integrations_touch before update on public.lexa_org_integrations
  for each row execute function public.lexa_touch_updated();

alter table public.lexa_org_integrations enable row level security;
alter table public.lexa_org_integration_runs enable row level security;
revoke all on public.lexa_org_integrations, public.lexa_org_integration_runs from public, anon, authenticated;

-- grades and prior GPA written by the connector are marked as such (lexa_connector_bulk sets lexa.source)
create or replace function public.lexa_connector_source()
returns trigger language plpgsql as $$
begin
  if new.source = 'api' and coalesce(current_setting('lexa.source', true), '') = 'connector' then
    new.source := 'connector';
  end if;
  return new;
end $$;
drop trigger if exists lexa_org_grades_connector on public.lexa_org_grades;
create trigger lexa_org_grades_connector before insert or update on public.lexa_org_grades
  for each row execute function public.lexa_connector_source();
drop trigger if exists lexa_org_prior_gpa_connector on public.lexa_org_prior_gpa;
create trigger lexa_org_prior_gpa_connector before insert or update on public.lexa_org_prior_gpa
  for each row execute function public.lexa_connector_source();

-- --- helpers ---
create or replace function public.lexa_url_host(u text)
returns text language sql immutable as $$
  select lower(substring(coalesce(u, '') from '^https://([^/:?#@]+)'))
$$;

-- next slot after a moment (Tehran hours); null for manual
create or replace function public.lexa_connector_next(sched text, hour int, after timestamptz)
returns timestamptz language plpgsql stable as $$
declare
  v_local timestamp := after at time zone 'Asia/Tehran';
  v_slot timestamp;
begin
  if sched = 'hourly' then return date_trunc('hour', after) + interval '1 hour'; end if;
  if sched not in ('daily', 'weekly') then return null; end if;
  if sched = 'weekly' then v_local := v_local + interval '6 days'; end if;
  v_slot := date_trunc('day', v_local) + make_interval(hours => coalesce(hour, 3));
  if v_slot <= v_local then v_slot := v_slot + interval '1 day'; end if;
  return v_slot at time zone 'Asia/Tehran';
end $$;

-- checks the shape of a configuration; raises bad_config:<what>
create or replace function public.lexa_connector_check(cfg jsonb)
returns void language plpgsql immutable as $$
declare
  v_res text;
  v_r jsonb;
  v_path text;
begin
  if jsonb_typeof(cfg) <> 'object' then raise exception 'bad_config:shape'; end if;
  if char_length(trim(coalesce(cfg ->> 'name', ''))) not between 1 and 60 then raise exception 'bad_config:name'; end if;
  if coalesce(cfg ->> 'kind', 'rest_json') not in ('rest_json', 'csv_url') then raise exception 'bad_config:kind'; end if;
  if coalesce(cfg ->> 'base_url', '') !~ '^https://[^/\s?#@]+' or char_length(cfg ->> 'base_url') > 300 then
    raise exception 'bad_config:base_url';
  end if;
  if coalesce(cfg ->> 'auth_kind', 'none') not in ('none', 'bearer', 'basic', 'header') then raise exception 'bad_config:auth'; end if;
  if cfg ->> 'auth_kind' = 'header' and coalesce(cfg ->> 'auth_user', '') !~ '^[A-Za-z0-9-]{1,60}$' then
    raise exception 'bad_config:auth_header';
  end if;
  if lower(coalesce(cfg ->> 'auth_user', '')) in ('host', 'cookie', 'content-length', 'transfer-encoding', 'connection')
     and cfg ->> 'auth_kind' = 'header' then
    raise exception 'bad_config:auth_header';
  end if;
  if char_length(coalesce(cfg ->> 'auth_user', '')) > 100 then raise exception 'bad_config:auth_user'; end if;
  if coalesce(cfg ->> 'schedule', 'manual') not in ('manual', 'hourly', 'daily', 'weekly') then raise exception 'bad_config:schedule'; end if;
  if coalesce((cfg ->> 'run_hour')::int, 3) not between 0 and 23 then raise exception 'bad_config:run_hour'; end if;
  if jsonb_typeof(coalesce(cfg -> 'resources', '{}'::jsonb)) <> 'object' or char_length(coalesce(cfg -> 'resources', '{}'::jsonb)::text) > 20000 then
    raise exception 'bad_config:resources';
  end if;
  if jsonb_typeof(coalesce(cfg -> 'options', '{}'::jsonb)) <> 'object' or char_length(coalesce(cfg -> 'options', '{}'::jsonb)::text) > 4000 then
    raise exception 'bad_config:options';
  end if;
  for v_res, v_r in select key, value from jsonb_each(coalesce(cfg -> 'resources', '{}'::jsonb)) loop
    if v_res not in ('students', 'staff', 'classes', 'enrollments', 'grades', 'prior_gpa') then
      raise exception 'bad_config:resource';
    end if;
    if jsonb_typeof(v_r) <> 'object' or jsonb_typeof(coalesce(v_r -> 'map', '{}'::jsonb)) <> 'object' then
      raise exception 'bad_config:resource';
    end if;
    v_path := coalesce(v_r ->> 'path', '');
    if v_path <> '' and (v_path !~ '^[/?]' or v_path ~ '\s|@|^//|\.\.' or char_length(v_path) > 300) then
      raise exception 'bad_config:path';
    end if;
  end loop;
exception when invalid_text_representation then
  raise exception 'bad_config:run_hour';
end $$;

-- --- manager RPCs (owner / manager / Lexa admin, two-factor) ---
create or replace function public.lexa_org_integrations(o uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.lexa_org_require_manager(o, true);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', i.id, 'name', i.name, 'kind', i.kind, 'base_url', i.base_url, 'auth_kind', i.auth_kind,
      'auth_user', i.auth_user, 'has_secret', i.secret_id is not null, 'resources', i.resources, 'options', i.options,
      'schedule', i.schedule, 'run_hour', i.run_hour, 'enabled', i.enabled,
      'key_ok', exists (select 1 from public.lexa_org_api_keys k where k.id = i.api_key_id and k.revoked_at is null
                        and (k.expires_at is null or k.expires_at > now())),
      'next_run_at', i.next_run_at, 'last_run_at', i.last_run_at, 'last_status', i.last_status,
      'created_at', i.created_at, 'updated_at', i.updated_at) order by i.created_at)
    from public.lexa_org_integrations i where i.org_id = o), '[]'::jsonb);
end $$;

-- create (i = null) or update; returns the id
create or replace function public.lexa_org_integration_save(o uuid, i uuid, cfg jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_old public.lexa_org_integrations;
  v_id uuid := i;
  v_key uuid;
  v_name text := trim(coalesce(cfg ->> 'name', ''));
  v_sched text := coalesce(cfg ->> 'schedule', 'manual');
  v_hour int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  perform public.lexa_org_require_manager(o, true);
  if not public.lexa_org_active(o) then raise exception 'org_not_active'; end if;
  perform public.lexa_connector_check(cfg);
  v_hour := coalesce((cfg ->> 'run_hour')::int, 3);
  if v_id is null then
    if (select count(*) from public.lexa_org_integrations x where x.org_id = o) >= 5 then raise exception 'too_many_integrations'; end if;
    insert into public.lexa_org_api_keys (org_id, name, salt, scopes, created_by)
    values (o, left('connector: ' || v_name, 60),
            replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
            array['students:write', 'staff:write', 'status:write'], auth.uid())
    returning id into v_key;
    insert into public.lexa_org_integrations (org_id, name, kind, base_url, auth_kind, auth_user, resources, options,
                                              schedule, run_hour, enabled, api_key_id, next_run_at, created_by)
    values (o, v_name, coalesce(cfg ->> 'kind', 'rest_json'), trim(cfg ->> 'base_url'), coalesce(cfg ->> 'auth_kind', 'none'),
            trim(coalesce(cfg ->> 'auth_user', '')), coalesce(cfg -> 'resources', '{}'::jsonb), coalesce(cfg -> 'options', '{}'::jsonb),
            v_sched, v_hour, coalesce((cfg ->> 'enabled')::boolean, true), v_key,
            public.lexa_connector_next(v_sched, v_hour, now()), auth.uid())
    returning id into v_id;
  else
    select * into v_old from public.lexa_org_integrations x where x.id = v_id and x.org_id = o for update;
    if not found then raise exception 'not_found'; end if;
    -- a credential never follows the integration to another server
    if public.lexa_url_host(v_old.base_url) <> public.lexa_url_host(cfg ->> 'base_url')
       or v_old.auth_kind <> coalesce(cfg ->> 'auth_kind', 'none') then
      if v_old.secret_id is not null then delete from vault.secrets s where s.id = v_old.secret_id; end if;
      v_old.secret_id := null;
    end if;
    update public.lexa_org_integrations set
      name = v_name, kind = coalesce(cfg ->> 'kind', 'rest_json'), base_url = trim(cfg ->> 'base_url'),
      auth_kind = coalesce(cfg ->> 'auth_kind', 'none'), auth_user = trim(coalesce(cfg ->> 'auth_user', '')),
      secret_id = v_old.secret_id, resources = coalesce(cfg -> 'resources', '{}'::jsonb),
      options = coalesce(cfg -> 'options', '{}'::jsonb), schedule = v_sched, run_hour = v_hour,
      enabled = coalesce((cfg ->> 'enabled')::boolean, true),
      next_run_at = case when v_sched = v_old.schedule and v_hour = v_old.run_hour and v_old.next_run_at is not null
                         then v_old.next_run_at else public.lexa_connector_next(v_sched, v_hour, now()) end
    where id = v_id;
    update public.lexa_org_api_keys set name = left('connector: ' || v_name, 60)
    where id = v_old.api_key_id and revoked_at is null;
  end if;
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(o, 'connector.save', v_id, jsonb_build_object('name', v_name, 'kind', cfg ->> 'kind',
    'host', public.lexa_url_host(cfg ->> 'base_url'), 'schedule', v_sched, 'created', i is null));
  return v_id;
end $$;

-- sets (or with an empty value removes) the read-only credential; it can never be read back
create or replace function public.lexa_org_integration_secret(i uuid, p_secret text)
returns text language plpgsql security definer set search_path = public as $$
declare v_row public.lexa_org_integrations;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into v_row from public.lexa_org_integrations x where x.id = i for update;
  if not found then raise exception 'not_found'; end if;
  perform public.lexa_org_require_manager(v_row.org_id, true);
  if char_length(coalesce(p_secret, '')) > 4000 then raise exception 'bad_input'; end if;
  if coalesce(p_secret, '') = '' then
    if v_row.secret_id is not null then delete from vault.secrets s where s.id = v_row.secret_id; end if;
    update public.lexa_org_integrations set secret_id = null where id = i;
  elsif v_row.secret_id is null then
    update public.lexa_org_integrations
      set secret_id = vault.create_secret(p_secret, 'lexa-connector-' || i::text, 'Lexa connector credential')
    where id = i;
  else
    perform vault.update_secret(v_row.secret_id, p_secret);
  end if;
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(v_row.org_id, 'connector.secret', i, jsonb_build_object('set', coalesce(p_secret, '') <> ''));
  return 'ok';
end $$;

create or replace function public.lexa_org_integration_delete(i uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_row public.lexa_org_integrations;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into v_row from public.lexa_org_integrations x where x.id = i for update;
  if not found then raise exception 'not_found'; end if;
  perform public.lexa_org_require_manager(v_row.org_id, true);
  if v_row.secret_id is not null then delete from vault.secrets s where s.id = v_row.secret_id; end if;
  update public.lexa_org_api_keys set revoked_at = now(), revoked_by = auth.uid()
  where id = v_row.api_key_id and revoked_at is null;
  delete from public.lexa_org_integrations where id = i;
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(v_row.org_id, 'connector.delete', i, jsonb_build_object('name', v_row.name));
  return 'ok';
end $$;

-- a new key for the integration (after someone revoked it in the API panel)
create or replace function public.lexa_org_integration_rekey(i uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_row public.lexa_org_integrations;
  v_key uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into v_row from public.lexa_org_integrations x where x.id = i for update;
  if not found then raise exception 'not_found'; end if;
  perform public.lexa_org_require_manager(v_row.org_id, true);
  update public.lexa_org_api_keys set revoked_at = now(), revoked_by = auth.uid()
  where id = v_row.api_key_id and revoked_at is null;
  insert into public.lexa_org_api_keys (org_id, name, salt, scopes, created_by)
  values (v_row.org_id, left('connector: ' || v_row.name, 60),
          replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
          array['students:write', 'staff:write', 'status:write'], auth.uid())
  returning id into v_key;
  update public.lexa_org_integrations set api_key_id = v_key where id = i;
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(v_row.org_id, 'connector.rekey', i, '{}'::jsonb);
  return 'ok';
end $$;

create or replace function public.lexa_org_integration_runs(o uuid, i uuid default null, lim int default 50)
returns table (id uuid, integration_id uuid, integration_name text, via text, dry boolean, started_at timestamptz,
               finished_at timestamptz, status text, counts jsonb, errors jsonb, message text, started_by_name text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.lexa_org_require_manager(o, true);
  return query
    select r.id, r.integration_id, g.name, r.via, r.dry, r.started_at, r.finished_at, r.status, r.counts, r.errors,
      r.message, coalesce(nullif(p.display_name, ''), p.username, '')
    from public.lexa_org_integration_runs r
    join public.lexa_org_integrations g on g.id = r.integration_id
    left join public.lexa_profiles p on p.id = r.started_by
    where r.org_id = o and (i is null or r.integration_id = i)
    order by r.started_at desc
    limit least(greatest(coalesce(lim, 50), 1), 500);
end $$;

-- --- the Edge Function (service key only) ---
-- configuration with the decrypted credential and the integration's API key (id + salt)
create or replace function public.lexa_connector_get(i uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_row public.lexa_org_integrations;
  v_secret text;
  v_key public.lexa_org_api_keys;
begin
  perform public.lexa_api_require_service();
  select * into v_row from public.lexa_org_integrations x where x.id = i;
  if not found then raise exception 'not_found'; end if;
  if v_row.secret_id is not null then
    select s.decrypted_secret into v_secret from vault.decrypted_secrets s where s.id = v_row.secret_id;
  end if;
  select * into v_key from public.lexa_org_api_keys k
  where k.id = v_row.api_key_id and k.revoked_at is null and (k.expires_at is null or k.expires_at > now());
  return jsonb_build_object(
    'id', v_row.id, 'org_id', v_row.org_id, 'name', v_row.name, 'kind', v_row.kind, 'base_url', v_row.base_url,
    'auth_kind', v_row.auth_kind, 'auth_user', v_row.auth_user, 'secret', v_secret,
    'resources', v_row.resources, 'options', v_row.options, 'enabled', v_row.enabled,
    'org_active', public.lexa_org_active(v_row.org_id),
    'key_id', v_key.id, 'key_salt', v_key.salt);
end $$;

-- integrations whose time has come; each is leased for 20 minutes so two ticks never take the same one
create or replace function public.lexa_connector_due(lim int default 3)
returns setof uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.lexa_api_require_service();
  for v_id in
    with d as (
      select x.id from public.lexa_org_integrations x
      where x.enabled and x.schedule <> 'manual' and x.next_run_at is not null and x.next_run_at <= now()
        and public.lexa_org_active(x.org_id)
      order by x.next_run_at
      limit least(greatest(coalesce(lim, 3), 1), 20)
      for update skip locked
    )
    update public.lexa_org_integrations x set next_run_at = now() + interval '20 minutes'
    from d where x.id = d.id
    returning x.id
  loop
    return next v_id;
  end loop;
end $$;

-- opens a run; null when another run of the same integration is still going (younger than 30 min)
create or replace function public.lexa_connector_run_begin(i uuid, trig text, p_dry boolean, by_user uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_id uuid;
begin
  perform public.lexa_api_require_service();
  select x.org_id into v_org from public.lexa_org_integrations x where x.id = i for update;
  if v_org is null then raise exception 'not_found'; end if;
  update public.lexa_org_integration_runs set status = 'failed', finished_at = now(), message = 'timeout'
  where integration_id = i and status = 'running' and started_at < now() - interval '30 minutes';
  if exists (select 1 from public.lexa_org_integration_runs r where r.integration_id = i and r.status = 'running') then
    return null;
  end if;
  insert into public.lexa_org_integration_runs (integration_id, org_id, via, dry, started_by)
  values (i, v_org, case when trig = 'schedule' then 'schedule' else 'manual' end, coalesce(p_dry, false), by_user)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.lexa_connector_run_end(run uuid, st text, p_counts jsonb, p_errors jsonb, msg text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.lexa_org_integration_runs;
begin
  perform public.lexa_api_require_service();
  update public.lexa_org_integration_runs set
    status = case when st in ('ok', 'partial', 'failed') then st else 'failed' end,
    finished_at = now(), counts = coalesce(p_counts, '{}'::jsonb),
    errors = (select coalesce(jsonb_agg(z.v), '[]'::jsonb)
              from (select t.v from jsonb_array_elements(case when jsonb_typeof(p_errors) = 'array' then p_errors else '[]'::jsonb end) as t(v)
                    limit 100) z),
    message = left(coalesce(msg, ''), 300)
  where id = run and status = 'running'
  returning * into r;
  if not found then return; end if;
  if not r.dry then
    update public.lexa_org_integrations x set last_run_at = now(), last_status = r.status,
      next_run_at = public.lexa_connector_next(x.schedule, x.run_hour, now())
    where x.id = r.integration_id;
    perform set_config('lexa.audit_ok', '1', true);
    perform public.lexa_audit(r.org_id, 'connector.run', r.integration_id,
      jsonb_build_object('status', r.status, 'via', r.via, 'counts', r.counts));
  end if;
  delete from public.lexa_org_integration_runs where integration_id = r.integration_id and started_at < now() - interval '180 days';
end $$;

-- classes, enrolments, grades and prior GPA through the same SQL as the API, marked as connector
create or replace function public.lexa_connector_bulk(o uuid, which text, items jsonb, dry boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_out jsonb;
begin
  perform public.lexa_api_require_service();
  perform set_config('lexa.source', 'connector', true);
  v_out := case which
    when 'classes' then public.lexa_api_classes(o, items, dry)
    when 'enrollments' then public.lexa_api_enrollments(o, items, dry)
    when 'grades' then public.lexa_api_grades(o, items, dry)
    when 'prior_gpa' then public.lexa_api_prior_gpa(o, items, dry)
  end;
  if v_out is null then raise exception 'bad_input'; end if;
  perform set_config('lexa.source', '', true);
  return v_out;
end $$;

revoke execute on function public.lexa_connector_source() from public, anon, authenticated;
revoke execute on function public.lexa_connector_check(jsonb) from public, anon, authenticated;
revoke execute on function public.lexa_connector_next(text, integer, timestamptz) from public, anon;
revoke execute on function public.lexa_org_integrations(uuid) from public, anon;
revoke execute on function public.lexa_org_integration_save(uuid, uuid, jsonb) from public, anon;
revoke execute on function public.lexa_org_integration_secret(uuid, text) from public, anon;
revoke execute on function public.lexa_org_integration_delete(uuid) from public, anon;
revoke execute on function public.lexa_org_integration_rekey(uuid) from public, anon;
revoke execute on function public.lexa_org_integration_runs(uuid, uuid, integer) from public, anon;
revoke execute on function public.lexa_connector_get(uuid) from public, anon, authenticated;
revoke execute on function public.lexa_connector_due(integer) from public, anon, authenticated;
revoke execute on function public.lexa_connector_run_begin(uuid, text, boolean, uuid) from public, anon, authenticated;
revoke execute on function public.lexa_connector_run_end(uuid, text, jsonb, jsonb, text) from public, anon, authenticated;
revoke execute on function public.lexa_connector_bulk(uuid, text, jsonb, boolean) from public, anon, authenticated;

grant execute on function public.lexa_connector_next(text, integer, timestamptz) to authenticated, service_role;
grant execute on function public.lexa_org_integrations(uuid) to authenticated, service_role;
grant execute on function public.lexa_org_integration_save(uuid, uuid, jsonb) to authenticated;
grant execute on function public.lexa_org_integration_secret(uuid, text) to authenticated;
grant execute on function public.lexa_org_integration_delete(uuid) to authenticated;
grant execute on function public.lexa_org_integration_rekey(uuid) to authenticated;
grant execute on function public.lexa_org_integration_runs(uuid, uuid, integer) to authenticated, service_role;
grant execute on function public.lexa_connector_get(uuid) to service_role;
grant execute on function public.lexa_connector_due(integer) to service_role;
grant execute on function public.lexa_connector_run_begin(uuid, text, boolean, uuid) to service_role;
grant execute on function public.lexa_connector_run_end(uuid, text, jsonb, jsonb, text) to service_role;
grant execute on function public.lexa_connector_bulk(uuid, text, jsonb, boolean) to service_role;

notify pgrst, 'reload schema';
