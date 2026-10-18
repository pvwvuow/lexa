-- Lexa 009: study time (phase 4 of docs/ORG_LEARNING.md). Run after 008. Safe to re-run.
--
-- Only ACTIVE time is recorded: the page is in front of the user AND there was user
-- activity in the last 2 minutes. The client sends one heartbeat per 60 seconds and
-- keeps an offline queue; the server is the trust boundary:
--   * one beat carries 1..120 seconds (a 60 s beat plus one network retry)
--   * a gap of more than 3 minutes between beats starts a fresh accumulation window
--   * at most 12 hours (43200 s) are counted per user per day; server rejects nonsense
--   * the org attribution is derived server-side from official enrolment, never from
--     what the client claims
-- Recorded for every signed-in user; the terms of use state that Lexa admins can see it.
-- Granular per-click learning events are deliberately NOT stored (minimal-data rule).
--
-- Who sees what:
--   * the user: own data («آمار من»)
--   * centre owner / managers: their official students, with a two-factor session
--   * the teacher of a class: the students of that class
--   * the Lexa admin: everything (stated in the terms of use)

-- --- table ---
create table if not exists public.lexa_study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid references public.lexa_orgs(id) on delete set null,
  session_uid text not null check (char_length(session_uid) between 8 and 64
    and session_uid ~ '^[A-Za-z0-9._-]+$'),
  day date not null,
  seconds int not null default 0 check (seconds >= 0),
  beats int not null default 0 check (beats >= 0),
  started_at timestamptz not null default now(),
  last_beat_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, session_uid)
);
create index if not exists lexa_study_sessions_user_day on public.lexa_study_sessions (user_id, day);
create index if not exists lexa_study_sessions_org_day on public.lexa_study_sessions (org_id, day);

alter table public.lexa_study_sessions enable row level security;
-- no direct reads or writes for clients at all: everything through the RPCs below
revoke all on public.lexa_study_sessions from anon, authenticated;

-- --- helpers ---

-- the Tehran calendar day of a moment (the audience is Persian; keep one clock)
create or replace function public.lexa_study_day()
returns date language sql stable as $$
  select (now() at time zone 'Asia/Tehran')::date
$$;

-- the centre this caller's time belongs to: an official student of exactly one active
-- centre (or the centre passed in, if the caller is its official student); null otherwise
create or replace function public.lexa_study_org_of(p_org uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select case
    when p_org is not null and public.lexa_org_official(p_org) then p_org
    else (
      select s.org_id from public.lexa_org_students s
      where s.user_id = auth.uid() and public.lexa_org_official(s.org_id)
      group by s.org_id having count(*) = 1
      limit 1
    )
  end
$$;

-- --- one heartbeat: 60 s of active time (client retries may carry up to 120 s) ---
create or replace function public.lexa_study_beat(p_session text, p_seconds int, p_org uuid default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_day date := public.lexa_study_day();
  v_used int;
  v_add int;
  v_row public.lexa_study_sessions;
begin
  if v_user is null then raise exception 'not signed in'; end if;
  if p_session is null or p_session !~ '^[A-Za-z0-9._-]{8,64}$' then raise exception 'bad_session'; end if;
  if p_seconds is null or p_seconds < 1 or p_seconds > 120 then raise exception 'bad_seconds'; end if;

  -- daily cap of 12 hours across every session of the user
  select coalesce(sum(seconds), 0) into v_used
    from public.lexa_study_sessions where user_id = v_user and day = v_day;
  v_add := least(p_seconds, greatest(43200 - v_used, 0));
  if v_add <= 0 then return v_used; end if;

  v_org := public.lexa_study_org_of(p_org);

  select * into v_row from public.lexa_study_sessions
    where user_id = v_user and session_uid = p_session;
  if v_row.id is null then
    insert into public.lexa_study_sessions (user_id, org_id, session_uid, day, seconds, beats)
    values (v_user, v_org, p_session, v_day, v_add, 1)
    returning * into v_row;
  elsif v_row.day <> v_day or now() - v_row.last_beat_at > interval '3 minutes' then
    -- midnight or a long pause: fresh window, same uid (one row per client session)
    update public.lexa_study_sessions set
      day = v_day, seconds = v_add, beats = 1, started_at = now(), last_beat_at = now(),
      org_id = coalesce(v_org, org_id)
    where id = v_row.id returning * into v_row;
  else
    update public.lexa_study_sessions set
      seconds = least(seconds + v_add, 43200), beats = beats + 1, last_beat_at = now()
    where id = v_row.id returning * into v_row;
  end if;
  return v_row.seconds;
end $$;

-- --- «آمار من»: the caller's own daily totals, at most 62 days per call ---
create or replace function public.lexa_study_my(p_from date default null, p_to date default null)
returns table (day date, seconds int) language sql stable security definer set search_path = public as $$
  select s.day, sum(s.seconds)::int
  from public.lexa_study_sessions s
  where s.user_id = auth.uid()
    and s.day >= coalesce(p_from, public.lexa_study_day() - 29)
    and s.day <= coalesce(p_to, public.lexa_study_day())
    and s.day >= public.lexa_study_day() - 365
  group by s.day
  order by s.day desc
  limit 62
$$;

-- --- centre dashboard: per-student totals of their official students (manager + aal2) ---
create or replace function public.lexa_study_org(o uuid, p_from date default null, p_to date default null)
returns table (student_id uuid, org_username text, full_name text, status text, seconds int, days int)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.lexa_org_require_manager(o, true);
  return query
  select st.id, st.org_username, st.full_name, st.status,
         coalesce(sum(t.seconds), 0)::int, count(distinct t.day)::int
  from public.lexa_org_students st
  left join public.lexa_study_sessions t
    on t.user_id = st.user_id and t.org_id = o
   and t.day >= coalesce(p_from, public.lexa_study_day() - 29)
   and t.day <= coalesce(p_to, public.lexa_study_day())
  where st.org_id = o
  group by st.id
  order by coalesce(sum(t.seconds), 0) desc, st.org_username
  limit 2000;
end $$;

-- --- teacher view: per-student totals inside one of their classes ---
create or replace function public.lexa_study_class(k uuid, p_from date default null, p_to date default null)
returns table (student_id uuid, org_username text, full_name text, seconds int, days int)
language plpgsql stable security definer set search_path = public as $$
declare v_org uuid;
begin
  v_org := public.lexa_class_require_staff(k);
  return query
  select st.id, st.org_username, st.full_name,
         coalesce(sum(t.seconds), 0)::int, count(distinct t.day)::int
  from public.lexa_org_enrollments e
  join public.lexa_org_students st on st.id = e.student_id
  left join public.lexa_study_sessions t
    on t.user_id = st.user_id and t.org_id = v_org
   and t.day >= coalesce(p_from, public.lexa_study_day() - 29)
   and t.day <= coalesce(p_to, public.lexa_study_day())
  where e.class_id = k and e.status in ('enrolled', 'completed')
  group by st.id
  order by coalesce(sum(t.seconds), 0) desc, st.org_username
  limit 2000;
end $$;

-- --- Lexa admin: per-centre totals (the terms of use state admins can see this) ---
create or replace function public.lexa_study_admin(p_from date default null, p_to date default null)
returns table (org_id uuid, org_name text, seconds int, learners int)
language sql stable security definer set search_path = public as $$
  select o.id, o.name, coalesce(sum(t.seconds), 0)::int,
         count(distinct t.user_id)::int
  from public.lexa_orgs o
  left join public.lexa_study_sessions t
    on t.org_id = o.id
   and t.day >= coalesce(p_from, public.lexa_study_day() - 29)
   and t.day <= coalesce(p_to, public.lexa_study_day())
  group by o.id
  order by coalesce(sum(t.seconds), 0) desc
  limit 2000
$$;
revoke execute on function public.lexa_study_admin(date, date) from public, anon, authenticated;

-- guard wrapper so the client cannot call the raw admin RPC without a check:
-- the exposed one refuses non-admins
create or replace function public.lexa_study_admin_stats(p_from date default null, p_to date default null)
returns table (org_id uuid, org_name text, seconds int, learners int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.lexa_is_admin() then raise exception 'admin only'; end if;
  return query select * from public.lexa_study_admin(p_from, p_to);
end $$;
