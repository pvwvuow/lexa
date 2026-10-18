-- Lexa 010: Lexa API for centres (phase 5) and the connector framework (phase 7)
-- of docs/ORG_LEARNING.md. Run after 009. Safe to re-run.
--
-- API keys: the centre manager creates a key in the panel; the secret part is shown once
-- and stored ONLY inside Supabase Vault. Requests to the org-api edge function carry the
-- key prefix, a timestamp and HMAC-SHA256(secret, timestamp + "." + sha256(body)) so a
-- captured request can never be replayed. Keys have scopes (read / write), optional IP
-- allowlist and an expiry; they are revoked, never deleted (audit keeps the trail).
--
-- Connector (we read from the centre's own system): one configuration per centre, the
-- read-only password lives in Vault too, every run leaves a row in lexa_integration_runs.
--
-- All tables here are service-only: clients never read or write them directly.

-- --- API keys ---
create table if not exists public.lexa_org_api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.lexa_orgs(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  prefix text not null unique check (prefix ~ '^lxk_[0-9a-f]{10}$'),
  secret_ref uuid,                                   -- vault secret uuid (no FK on purpose)
  scopes text[] not null default '{write}'
    check (scopes <@ '{read,write}' and cardinality(scopes) between 1 and 2),
  ip_allowlist text[] not null default '{}',
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.lexa_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists lexa_org_api_keys_org_idx on public.lexa_org_api_keys (org_id, created_at desc);

alter table public.lexa_org_api_keys enable row level security;
revoke all on public.lexa_org_api_keys from anon, authenticated;

-- --- idempotency of bulk posts (answer replayed for 48 h with the same result) ---
create table if not exists public.lexa_api_idempotency (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.lexa_orgs(id) on delete cascade,
  idem text not null check (char_length(idem) between 8 and 100),
  endpoint text not null check (char_length(endpoint) <= 120),
  body_hash text not null check (char_length(body_hash) = 64),
  status int not null,
  response jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (org_id, idem)
);
create index if not exists lexa_api_idempotency_created on public.lexa_api_idempotency (created_at);

alter table public.lexa_api_idempotency enable row level security;
revoke all on public.lexa_api_idempotency from anon, authenticated;

-- --- connector configuration (one per centre) ---
create table if not exists public.lexa_org_integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.lexa_orgs(id) on delete cascade,
  base_url text not null check (base_url ~ '^https://[A-Za-z0-9.-]+'),
  username text not null default '' check (char_length(username) <= 80),
  secret_ref uuid,
  schedule text not null default 'manual' check (schedule in ('manual', 'hourly', '6h', 'daily')),
  enabled boolean not null default true,
  last_status text not null default 'never' check (last_status in ('never', 'ok', 'failed', 'running')),
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lexa_org_integrations enable row level security;
revoke all on public.lexa_org_integrations from anon, authenticated;

-- --- connector runs (log) ---
create table if not exists public.lexa_integration_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.lexa_orgs(id) on delete cascade,
  trigger text not null default 'manual' check (trigger in ('manual', 'schedule', 'api')),
  status text not null check (status in ('running', 'ok', 'failed')),
  stats jsonb not null default '{}',
  message text not null default '' check (char_length(message) <= 500),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists lexa_integration_runs_org_idx on public.lexa_integration_runs (org_id, started_at desc);

alter table public.lexa_integration_runs enable row level security;
revoke all on public.lexa_integration_runs from anon, authenticated;

-- --- key management (manager with aal2; service passes) ---

-- delete a vault secret whichever table name this project's vault uses
create or replace function public.lexa_vault_del(p_ref uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_ref is null then return; end if;
  begin
    delete from vault.secrets where uuid = p_ref;
  exception when others then
    begin
      delete from vault.secret where uuid = p_ref;
    exception when others then null;
    end;
  end;
end $$;

-- create: returns the full key exactly once
create or replace function public.lexa_api_key_create(o uuid, p_name text, p_scopes text[],
  p_expires timestamptz default null, p_ips text[] default '{}')
returns table (id uuid, prefix text, key text) language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_prefix text;
  v_secret text;
  v_key text;
  v_ref uuid;
begin
  perform public.lexa_org_require_manager(o, true);
  if p_name is null or btrim(p_name) = '' or char_length(btrim(p_name)) > 60 then
    raise exception 'bad_input';
  end if;
  if p_scopes is null or not (p_scopes <@ '{read,write}') or cardinality(p_scopes) = 0 then
    raise exception 'bad_input';
  end if;
  if p_ips is not null and exists (select 1 from unnest(p_ips) ip where ip !~ '^[0-9a-fA-F.:]{1,45}$') then
    raise exception 'bad_input';
  end if;
  if p_expires is not null and p_expires < now() then raise exception 'bad_input'; end if;

  v_id := gen_random_uuid();
  v_prefix := 'lxk_' || substr(encode(gen_random_bytes(5), 'hex'), 1, 10);
  v_secret := encode(gen_random_bytes(20), 'hex');
  v_key := v_prefix || '_' || v_secret;
  select vault.create_secret(v_secret, 'lexa api key ' || v_prefix) into v_ref;

  insert into public.lexa_org_api_keys (id, org_id, name, prefix, secret_ref, scopes, ip_allowlist, expires_at, created_by)
  values (v_id, o, btrim(p_name), v_prefix, v_ref, p_scopes, coalesce(p_ips, '{}'), p_expires, auth.uid());
  id := v_id; prefix := v_prefix; key := v_key;
  perform public.set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(o, 'apikey.create', v_id, jsonb_build_object('name', btrim(p_name), 'scopes', p_scopes));
end $$;

create or replace function public.lexa_api_key_list(o uuid)
returns table (id uuid, name text, prefix text, scopes text[], ip_allowlist text[],
  expires_at timestamptz, last_used_at timestamptz, revoked_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select id, name, prefix, scopes, ip_allowlist, expires_at, last_used_at, revoked_at, created_at
  from public.lexa_org_api_keys where org_id = o
  order by created_at desc limit 100
$$;

create or replace function public.lexa_api_key_revoke(o uuid, p_key uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_ref uuid;
begin
  perform public.lexa_org_require_manager(o, true);
  update public.lexa_org_api_keys set revoked_at = now()
    where id = p_key and org_id = o and revoked_at is null
    returning secret_ref into v_ref;
  if not found then raise exception 'not_found'; end if;
  perform public.set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(o, 'apikey.revoke', p_key, '{}');
  perform public.lexa_vault_del(v_ref);
end $$;

-- --- verification used by the org-api edge function (service key only) ---
create or replace function public.lexa_api_verify(p_prefix text, p_ts text, p_sig text, p_body_hash text, p_ip text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  k public.lexa_org_api_keys;
  v_secret text;
  v_expect text;
  v_ts numeric;
begin
  if not public.lexa_is_service() then raise exception 'internal function'; end if;
  select * into k from public.lexa_org_api_keys where prefix = p_prefix;
  if k.id is null or k.revoked_at is not null then raise exception 'bad_key'; end if;
  if k.expires_at is not null and k.expires_at < now() then raise exception 'bad_key'; end if;
  if array_length(k.ip_allowlist, 1) is not null
     and not (p_ip = any(k.ip_allowlist)) then raise exception 'bad_ip'; end if;
  -- timestamp is unix seconds (or milliseconds); 5 minutes of clock drift allowed
  if p_ts !~ '^[0-9]{10,13}$' then raise exception 'bad_ts'; end if;
  v_ts := p_ts::numeric / (case when char_length(p_ts) = 13 then 1000 else 1 end);
  if abs(extract(epoch from now()) - v_ts) > 300 then raise exception 'bad_ts'; end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where uuid = k.secret_ref;
  if v_secret is null then raise exception 'bad_key'; end if;
  v_expect := encode(hmac(convert_to(p_ts || '.' || p_body_hash, 'UTF8'), convert_to(v_secret, 'UTF8'), 'sha256'), 'hex');
  if v_expect <> lower(p_sig) then raise exception 'bad_sig'; end if;
  update public.lexa_org_api_keys set last_used_at = now() where id = k.id;
  return jsonb_build_object('org_id', k.org_id, 'key_id', k.id, 'scopes', to_jsonb(k.scopes));
end $$;

-- --- service helpers for the edge functions (never exposed to users) ---

-- audit from the edge function
create or replace function public.lexa_svc_audit(o uuid, act text, tgt uuid, info jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.lexa_is_service() then raise exception 'internal function'; end if;
  perform public.set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(o, act, tgt, info);
end $$;

-- rate limit shared with org-auth's lexa_rate_events
create or replace function public.lexa_svc_rate_ok(p_key text, p_max int, p_window_s int)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not public.lexa_is_service() then raise exception 'internal function'; end if;
  insert into public.lexa_rate_events (key) values (p_key);
  delete from public.lexa_rate_events where at < now() - make_interval(hours => 1);
  select count(*) into v_n from public.lexa_rate_events
    where key = p_key and at > now() - make_interval(secs => p_window_s);
  return v_n <= p_max;
end $$;

-- connector: manager reads and saves the configuration (password only into Vault)
create or replace function public.lexa_integration_get(o uuid)
returns table (base_url text, username text, schedule text, enabled boolean,
  has_password boolean, last_status text, last_run_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare g record;
begin
  perform public.lexa_org_require_manager(o, false);
  select * into g from public.lexa_org_integrations where org_id = o;
  return query select
    coalesce(g.base_url, ''), coalesce(g.username, ''), coalesce(g.schedule, 'manual'),
    coalesce(g.enabled, true), g.secret_ref is not null,
    coalesce(g.last_status, 'never'), g.last_run_at, g.updated_at;
end $$;

create or replace function public.lexa_integration_save(o uuid, p_base_url text, p_username text,
  p_password text, p_schedule text, p_enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
declare g record; v_ref uuid;
begin
  perform public.lexa_org_require_manager(o, true);
  if p_base_url !~ '^https://[A-Za-z0-9.-]+' then raise exception 'bad_input'; end if;
  if p_schedule not in ('manual', 'hourly', '6h', 'daily') then raise exception 'bad_input'; end if;
  select * into g from public.lexa_org_integrations where org_id = o;
  if g.id is null then
    insert into public.lexa_org_integrations (org_id, base_url, username, schedule, enabled)
    values (o, p_base_url, coalesce(p_username, ''), p_schedule, coalesce(p_enabled, true))
    returning secret_ref into v_ref;
  else
    v_ref := g.secret_ref;
    update public.lexa_org_integrations set
      base_url = p_base_url, username = coalesce(p_username, username),
      schedule = p_schedule, enabled = coalesce(p_enabled, enabled), updated_at = now()
    where org_id = o;
  end if;
  if p_password is not null and p_password <> '' then
    perform public.lexa_vault_del(v_ref);
    update public.lexa_org_integrations
      set secret_ref = vault.create_secret(p_password, 'lexa connector ' || o)
    where org_id = o;
  end if;
  perform public.set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(o, 'integration.save', o, jsonb_build_object('base_url', p_base_url, 'schedule', p_schedule));
end $$;

-- the edge function fetches the connector password (manager session or service)
create or replace function public.lexa_integration_secret(o uuid)
returns table (base_url text, username text, password text)
language plpgsql stable security definer set search_path = public as $$
declare g record; v_pass text;
begin
  if not public.lexa_is_service() then perform public.lexa_org_require_manager(o, true); end if;
  select * into g from public.lexa_org_integrations where org_id = o;
  if g.id is null or not g.enabled or g.secret_ref is null then raise exception 'no_integration'; end if;
  select decrypted_secret into v_pass from vault.decrypted_secrets where uuid = g.secret_ref;
  return query select g.base_url, g.username, v_pass;
end $$;

create or replace function public.lexa_integration_runs_list(o uuid, p_limit int default 20)
returns table (id uuid, trigger text, status text, stats jsonb, message text, started_at timestamptz, finished_at timestamptz)
language sql stable security definer set search_path = public as $$
  select id, trigger, status, stats, message, started_at, finished_at
  from public.lexa_integration_runs where org_id = o
  order by started_at desc limit greatest(1, least(coalesce(p_limit, 20), 50))
$$;

-- internal functions stay internal (the pattern of 007)
revoke execute on function public.lexa_api_verify(text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.lexa_svc_audit(uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.lexa_svc_rate_ok(text, int, int) from public, anon, authenticated;
revoke execute on function public.lexa_vault_del(uuid) from public, anon, authenticated;
revoke execute on function public.lexa_integration_secret(uuid) from public, anon, authenticated;
revoke execute on function public.lexa_study_org_of(uuid) from public, anon, authenticated;
