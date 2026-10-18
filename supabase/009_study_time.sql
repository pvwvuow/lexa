-- Lexa 009: study time, learning events, "my stats" and dashboards (phase 4 of docs/ORG_LEARNING.md).
-- Run in the Supabase SQL editor after 006, 007 and 008. Safe to re-run.
--
--   * active study time only: the app sends one heartbeat per minute while the page is in front
--     of the user and they did something in the last 2 minutes (src/lib/study-tracker.ts)
--   * one row per user and minute (at most 60 s), so two devices or a resent offline queue never
--     count twice; at most 12 hours a day; minutes in the future or older than 14 days are refused
--   * recorded for every signed-in user (the terms say a Lexa admin can see it)
--   * a centre sees the total study time of its official students only from the day they became
--     official until they leave (left_at), plus the time spent on the centre's own content
--   * daily totals live in lexa_study_daily; per-minute rows are pruned after 35 days
-- Clients get no table access: everything goes through the RPCs below.

do $$ begin
  if to_regprocedure('public.lexa_class_require_staff(uuid)') is null then
    raise exception 'run 006, 007 and 008 first';
  end if;
end $$;

-- --- when an official student stopped being active (end of the centre's view) ---
alter table public.lexa_org_students add column if not exists left_at date;

create or replace function public.lexa_org_students_left_at()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'active' then
      new.left_at := null;
    elsif old.status = 'active' then
      new.left_at := (now() at time zone 'Asia/Tehran')::date;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists lexa_org_students_left_at on public.lexa_org_students;
create trigger lexa_org_students_left_at before update on public.lexa_org_students
  for each row execute function public.lexa_org_students_left_at();

-- first day the centre may see (Tehran calendar)
create or replace function public.lexa_official_day(s public.lexa_org_students)
returns date language sql stable as $$
  select (coalesce(s.official_since, s.terms_accepted_at, s.created_at) at time zone 'Asia/Tehran')::date
$$;

-- --- tables ---
create table if not exists public.lexa_study_beats (
  user_id uuid not null references public.lexa_profiles(id) on delete cascade,
  minute timestamptz not null,
  seconds int not null check (seconds between 1 and 60),
  kind text not null default 'other',
  item text not null default '' check (char_length(item) <= 80),
  org_id uuid references public.lexa_orgs(id) on delete set null,
  received_at timestamptz not null default now(),
  primary key (user_id, minute)
);
create index if not exists lexa_study_beats_minute_idx on public.lexa_study_beats (minute);

create table if not exists public.lexa_study_daily (
  user_id uuid not null references public.lexa_profiles(id) on delete cascade,
  day date not null,
  seconds int not null default 0 check (seconds between 0 and 43200),
  by_kind jsonb not null default '{}'::jsonb,
  by_org jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
create index if not exists lexa_study_daily_day_idx on public.lexa_study_daily (day);

create table if not exists public.lexa_learning_events (
  id uuid primary key,
  user_id uuid not null references public.lexa_profiles(id) on delete cascade,
  at timestamptz not null,
  kind text not null check (kind in ('lesson_done', 'quiz_done', 'cards_reviewed', 'exam_done')),
  item_kind text not null default 'other',
  item text not null default '' check (char_length(item) <= 80),
  org_id uuid references public.lexa_orgs(id) on delete set null,
  value numeric(10, 2),
  received_at timestamptz not null default now()
);
create index if not exists lexa_learning_events_user_idx on public.lexa_learning_events (user_id, at desc);
create index if not exists lexa_learning_events_org_idx on public.lexa_learning_events (org_id, at desc);

alter table public.lexa_study_beats enable row level security;
alter table public.lexa_study_daily enable row level security;
alter table public.lexa_learning_events enable row level security;
revoke all on public.lexa_study_beats, public.lexa_study_daily, public.lexa_learning_events
  from public, anon, authenticated;

-- centre of a piece of content (posts, teacher courses, official exams), or null
create or replace function public.lexa_content_org(k text, ref text)
returns uuid language sql stable security definer set search_path = public as $$
  select case k
    when 'tcourse' then (select c.org_id from public.lexa_tcourses c where c.id = public.lexa_try_uuid(ref))
    when 'post' then (select p.org_id from public.lexa_posts p where p.id = public.lexa_try_uuid(ref))
    when 'exam' then (select x.org_id from public.lexa_org_exams x where x.id = public.lexa_try_uuid(ref))
    else null
  end
$$;

-- --- writing (the app's tracker) ---
-- beats:  [{ "t": "2026-10-18T10:41:00Z", "s": 45, "k": "tcourse", "i": "<id>" }]  (s = seconds in that minute)
-- events: [{ "id": "<uuid>", "t": "...", "k": "lesson_done", "ik": "tcourse", "i": "<id>", "v": 1 }]
create or replace function public.lexa_study_track(beats jsonb, events jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  b jsonb;
  v_min timestamptz;
  v_sec int;
  v_kind text;
  v_item text;
  v_org uuid;
  v_day date;
  v_old int;
  v_have int;
  v_add int;
  v_ok int := 0;
  v_skip int := 0;
  v_ev int := 0;
  v_id uuid;
  v_at timestamptz;
  v_val numeric;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  beats := coalesce(beats, '[]'::jsonb);
  events := coalesce(events, '[]'::jsonb);
  if jsonb_typeof(beats) <> 'array' or jsonb_array_length(beats) > 500
     or jsonb_typeof(events) <> 'array' or jsonb_array_length(events) > 200 then
    raise exception 'bad_batch';
  end if;

  for b in select value from jsonb_array_elements(beats) loop
    begin
      v_min := date_trunc('minute', (b ->> 't')::timestamptz);
      v_sec := round((b ->> 's')::numeric)::int;
    exception when others then
      v_skip := v_skip + 1; continue;
    end;
    if v_min is null or v_sec is null or v_sec < 1 or v_sec > 60
       or v_min > now() + interval '2 minutes' or v_min < now() - interval '14 days' then
      v_skip := v_skip + 1; continue;
    end if;
    v_kind := coalesce(nullif(b ->> 'k', ''), 'other');
    if v_kind not in ('course', 'tcourse', 'post', 'book', 'exam', 'flashcards', 'quiz', 'law', 'other') then
      v_kind := 'other';
    end if;
    v_item := left(coalesce(b ->> 'i', ''), 80);
    v_org := public.lexa_content_org(v_kind, v_item);
    v_day := (v_min at time zone 'Asia/Tehran')::date;

    select t.seconds into v_old from public.lexa_study_beats t where t.user_id = v_uid and t.minute = v_min;
    v_add := v_sec - coalesce(v_old, 0);
    if v_add <= 0 then v_skip := v_skip + 1; continue; end if;
    select d.seconds into v_have from public.lexa_study_daily d where d.user_id = v_uid and d.day = v_day;
    v_add := least(v_add, 43200 - coalesce(v_have, 0));
    if v_add <= 0 then v_skip := v_skip + 1; continue; end if;

    insert into public.lexa_study_beats (user_id, minute, seconds, kind, item, org_id)
    values (v_uid, v_min, coalesce(v_old, 0) + v_add, v_kind, v_item, v_org)
    on conflict (user_id, minute) do update set seconds = excluded.seconds, kind = excluded.kind,
      item = excluded.item, org_id = excluded.org_id, received_at = now();

    insert into public.lexa_study_daily (user_id, day, seconds, by_kind, by_org)
    values (v_uid, v_day, v_add, jsonb_build_object(v_kind, v_add),
            case when v_org is null then '{}'::jsonb else jsonb_build_object(v_org::text, v_add) end)
    on conflict (user_id, day) do update set
      seconds = public.lexa_study_daily.seconds + v_add,
      by_kind = public.lexa_study_daily.by_kind
        || jsonb_build_object(v_kind, coalesce((public.lexa_study_daily.by_kind ->> v_kind)::int, 0) + v_add),
      by_org = case when v_org is null then public.lexa_study_daily.by_org
        else public.lexa_study_daily.by_org
          || jsonb_build_object(v_org::text, coalesce((public.lexa_study_daily.by_org ->> v_org::text)::int, 0) + v_add) end,
      updated_at = now();
    v_ok := v_ok + 1;
  end loop;

  for b in select value from jsonb_array_elements(events) loop
    v_id := public.lexa_try_uuid(b ->> 'id');
    begin
      v_at := (b ->> 't')::timestamptz;
      v_val := nullif(b ->> 'v', '')::numeric;
    exception when others then
      continue;
    end;
    if v_id is null or v_at is null or v_at > now() + interval '2 minutes' or v_at < now() - interval '14 days'
       or coalesce(b ->> 'k', '') not in ('lesson_done', 'quiz_done', 'cards_reviewed', 'exam_done')
       or (v_val is not null and abs(v_val) >= 100000000) then
      continue;
    end if;
    v_kind := coalesce(nullif(b ->> 'ik', ''), 'other');
    if v_kind not in ('course', 'tcourse', 'post', 'book', 'exam', 'flashcards', 'quiz', 'law', 'other') then
      v_kind := 'other';
    end if;
    v_item := left(coalesce(b ->> 'i', ''), 80);
    insert into public.lexa_learning_events (id, user_id, at, kind, item_kind, item, org_id, value)
    values (v_id, v_uid, v_at, b ->> 'k', v_kind, v_item, public.lexa_content_org(v_kind, v_item), v_val)
    on conflict (id) do nothing;
    if found then v_ev := v_ev + 1; end if;
  end loop;

  return jsonb_build_object('beats', v_ok, 'skipped', v_skip, 'events', v_ev);
end $$;

-- --- my own data ---
create or replace function public.lexa_my_study(days int default 90)
returns table (day date, seconds int, by_kind jsonb, by_org jsonb)
language sql stable security definer set search_path = public as $$
  select d.day, d.seconds, d.by_kind, d.by_org
  from public.lexa_study_daily d
  where auth.uid() is not null and d.user_id = auth.uid()
    and d.day > (now() at time zone 'Asia/Tehran')::date - least(greatest(coalesce(days, 90), 1), 730)
  order by d.day
$$;

create or replace function public.lexa_my_learning(days int default 90)
returns table (kind text, n bigint, total numeric)
language sql stable security definer set search_path = public as $$
  select e.kind, count(*), coalesce(sum(e.value), 0)
  from public.lexa_learning_events e
  where auth.uid() is not null and e.user_id = auth.uid()
    and e.at > now() - make_interval(days => least(greatest(coalesce(days, 90), 1), 730))
  group by e.kind
$$;

-- delete my study time and learning events (my right; grades and official results are not touched)
create or replace function public.lexa_study_forget()
returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.lexa_study_beats where user_id = auth.uid();
  delete from public.lexa_study_daily where user_id = auth.uid();
  get diagnostics v_n = row_count;
  delete from public.lexa_learning_events where user_id = auth.uid();
  return v_n;
end $$;

-- --- centre reports (managers need a two-factor session) ---
-- per official student, only days inside [official day, left_at]
create or replace function public.lexa_org_study_report(o uuid, d_from date, d_to date)
returns table (student_id uuid, org_username text, full_name text, student_no text, status text,
               seconds bigint, org_seconds bigint, active_days int, last_day date, events bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.lexa_org_require_manager(o, true);
  if d_from is null or d_to is null or d_to < d_from or d_to - d_from > 400 then raise exception 'bad_input'; end if;
  return query
    select s.id, s.org_username, s.full_name, s.student_no, s.status,
      coalesce(sum(d.seconds), 0)::bigint,
      coalesce(sum(coalesce((d.by_org ->> o::text)::int, 0)), 0)::bigint,
      (count(d.day) filter (where d.seconds > 0))::int,
      max(d.day),
      (select count(*) from public.lexa_learning_events ev
        where ev.user_id = s.user_id and ev.org_id = o
          and (ev.at at time zone 'Asia/Tehran')::date between greatest(d_from, public.lexa_official_day(s))
              and least(d_to, coalesce(s.left_at, d_to)))
    from public.lexa_org_students s
    left join public.lexa_study_daily d on d.user_id = s.user_id
      and d.day between greatest(d_from, public.lexa_official_day(s)) and least(d_to, coalesce(s.left_at, d_to))
    where s.org_id = o and s.user_id is not null and s.terms_accepted_at is not null
    group by s.id
    order by 6 desc, s.full_name;
end $$;

-- the centre's front page: aggregates of the last 30 days
create or replace function public.lexa_org_dashboard(o uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_today date := (now() at time zone 'Asia/Tehran')::date;
begin
  perform public.lexa_org_require_manager(o, true);
  return (
    with st as (
      select s.user_id, s.status, public.lexa_official_day(s) as d0, coalesce(s.left_at, v_today) as d1
      from public.lexa_org_students s
      where s.org_id = o and s.user_id is not null and s.terms_accepted_at is not null
    ), dd as (
      select d.user_id, d.day, d.seconds, coalesce((d.by_org ->> o::text)::int, 0) as org_s
      from public.lexa_study_daily d join st on st.user_id = d.user_id and d.day between st.d0 and st.d1
      where d.day > v_today - 30
    )
    select jsonb_build_object(
      'students', (select count(*) from st where st.status = 'active'),
      'seats', (select g.student_seats from public.lexa_orgs g where g.id = o),
      'active_7d', (select count(distinct dd.user_id) from dd where dd.day > v_today - 7 and dd.seconds > 0),
      'active_30d', (select count(distinct dd.user_id) from dd where dd.seconds > 0),
      'seconds_7d', (select coalesce(sum(dd.seconds), 0) from dd where dd.day > v_today - 7),
      'seconds_30d', (select coalesce(sum(dd.seconds), 0) from dd),
      'org_seconds_30d', (select coalesce(sum(dd.org_s), 0) from dd),
      'classes', (select count(*) from public.lexa_org_classes c where c.org_id = o and c.status = 'active'),
      'exams_upcoming', (select count(*) from public.lexa_org_exams x
                         where x.org_id = o and x.status = 'published' and x.ends_at > now()),
      'avg_final', (select round(avg(g.score / g.max_score * 20), 2) from public.lexa_org_grades g
                    join public.lexa_org_classes c on c.id = g.class_id
                    join public.lexa_org_terms t on t.id = c.term_id
                    where g.org_id = o and g.component = 'final' and t.status <> 'closed'),
      'daily', coalesce((select jsonb_agg(jsonb_build_object('day', x.day, 'seconds', x.s, 'users', x.u) order by x.day)
                         from (select dd.day, sum(dd.seconds) as s, count(*) filter (where dd.seconds > 0) as u
                               from dd group by dd.day) x), '[]'::jsonb)
    )
  );
end $$;

-- teacher (own classes) or manager (all classes, two-factor): one row per class, last 14 days
create or replace function public.lexa_teacher_overview(o uuid)
returns table (class_id uuid, course_title text, title text, term_title text, students int, active_7d int,
               seconds_7d bigint, seconds_prev_7d bigint, avg_midterm numeric, avg_final numeric, exams_upcoming int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_all boolean := public.lexa_org_can_manage(o);
  v_today date := (now() at time zone 'Asia/Tehran')::date;
begin
  if v_all then
    if not public.lexa_mfa_ok() then raise exception 'mfa required'; end if;
  elsif not public.lexa_org_active_member(o) then
    raise exception 'not_staff';
  end if;
  return query
    select c.id, s.title, c.title, t.title,
      (select count(*)::int from public.lexa_org_enrollments e where e.class_id = c.id and e.status <> 'dropped'),
      coalesce(x.active_7d, 0), coalesce(x.s7, 0), coalesce(x.sp7, 0),
      (select round(avg(g.score / g.max_score * 20), 2) from public.lexa_org_grades g
        where g.class_id = c.id and g.component = 'midterm'),
      (select round(avg(g.score / g.max_score * 20), 2) from public.lexa_org_grades g
        where g.class_id = c.id and g.component = 'final'),
      (select count(*)::int from public.lexa_org_exams ex
        where ex.class_id = c.id and ex.status = 'published' and ex.ends_at > now())
    from public.lexa_org_classes c
    join public.lexa_org_terms t on t.id = c.term_id
    join public.lexa_org_courses s on s.id = c.course_id
    left join lateral (
      select (count(distinct d.user_id) filter (where d.day > v_today - 7 and d.seconds > 0))::int as active_7d,
        coalesce(sum(d.seconds) filter (where d.day > v_today - 7), 0)::bigint as s7,
        coalesce(sum(d.seconds) filter (where d.day <= v_today - 7), 0)::bigint as sp7
      from public.lexa_org_enrollments e
      join public.lexa_org_students st on st.id = e.student_id
      join public.lexa_study_daily d on d.user_id = st.user_id and d.day > v_today - 14
        and d.day >= public.lexa_official_day(st) and d.day <= coalesce(st.left_at, v_today)
      where e.class_id = c.id and e.status <> 'dropped' and st.terms_accepted_at is not null
    ) x on true
    where c.org_id = o and c.status = 'active' and (v_all or c.teacher_id = auth.uid())
    order by t.created_at desc, s.title, c.title;
end $$;

-- students of one class: study time in [d_from, d_to], the last 14 days against the 14 before
-- (for "falling behind"), and grades scaled to 20
create or replace function public.lexa_class_study_report(k uuid, d_from date, d_to date)
returns table (student_id uuid, org_username text, full_name text, student_no text, enrollment text,
               seconds bigint, org_seconds bigint, active_days int, last_day date,
               recent_seconds bigint, prev_seconds bigint, grades jsonb)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_org uuid;
  v_today date := (now() at time zone 'Asia/Tehran')::date;
begin
  v_org := public.lexa_class_require_staff(k);
  if d_from is null or d_to is null or d_to < d_from or d_to - d_from > 400 then raise exception 'bad_input'; end if;
  return query
    select s.id, s.org_username, s.full_name, s.student_no, e.status,
      coalesce(sum(d.seconds) filter (where d.day between d_from and d_to), 0)::bigint,
      coalesce(sum(coalesce((d.by_org ->> v_org::text)::int, 0)) filter (where d.day between d_from and d_to), 0)::bigint,
      (count(d.day) filter (where d.day between d_from and d_to and d.seconds > 0))::int,
      max(d.day),
      coalesce(sum(d.seconds) filter (where d.day > v_today - 14), 0)::bigint,
      coalesce(sum(d.seconds) filter (where d.day > v_today - 28 and d.day <= v_today - 14), 0)::bigint,
      coalesce((select jsonb_object_agg(g.component, round(g.score / g.max_score * 20, 2))
                from public.lexa_org_grades g where g.class_id = k and g.student_id = s.id), '{}'::jsonb)
    from public.lexa_org_enrollments e
    join public.lexa_org_students s on s.id = e.student_id
    left join public.lexa_study_daily d on d.user_id = s.user_id and s.terms_accepted_at is not null
      and d.day >= least(d_from, v_today - 27) and d.day <= greatest(d_to, v_today)
      and d.day >= public.lexa_official_day(s) and d.day <= coalesce(s.left_at, greatest(d_to, v_today))
    where e.class_id = k and e.status <> 'dropped'
    group by s.id, e.status
    order by s.full_name, s.org_username;
end $$;

-- --- Lexa admin (two-factor) ---
create or replace function public.lexa_admin_study_overview(d_from date, d_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.lexa_is_admin() then raise exception 'admin only'; end if;
  if not public.lexa_mfa_ok() then raise exception 'mfa required'; end if;
  if d_from is null or d_to is null or d_to < d_from or d_to - d_from > 400 then raise exception 'bad_input'; end if;
  return (
    with dd as (
      select d.user_id, d.day, d.seconds, d.by_org,
        exists (select 1 from public.lexa_org_students s
                where s.user_id = d.user_id and s.terms_accepted_at is not null) as official
      from public.lexa_study_daily d where d.day between d_from and d_to
    )
    select jsonb_build_object(
      'users_active', (select count(distinct dd.user_id) from dd where dd.seconds > 0),
      'official_active', (select count(distinct dd.user_id) from dd where dd.seconds > 0 and dd.official),
      'seconds', (select coalesce(sum(dd.seconds), 0) from dd),
      'official_seconds', (select coalesce(sum(dd.seconds), 0) from dd where dd.official),
      'daily', coalesce((select jsonb_agg(jsonb_build_object('day', x.day, 'seconds', x.s, 'users', x.u) order by x.day)
                         from (select dd.day, sum(dd.seconds) as s, count(*) filter (where dd.seconds > 0) as u
                               from dd group by dd.day) x), '[]'::jsonb),
      'orgs', coalesce((select jsonb_agg(jsonb_build_object(
                  'org_id', g.id, 'name', g.name, 'status', g.status,
                  'students', (select count(*) from public.lexa_org_students s
                               where s.org_id = g.id and s.status = 'active' and s.terms_accepted_at is not null),
                  'active_students', (select count(distinct s.id) from public.lexa_org_students s
                                      join dd on dd.user_id = s.user_id and dd.seconds > 0
                                      where s.org_id = g.id and s.terms_accepted_at is not null),
                  'org_seconds', (select coalesce(sum((dd.by_org ->> g.id::text)::bigint), 0) from dd
                                  where dd.by_org ? g.id::text)) order by g.name)
                from public.lexa_orgs g), '[]'::jsonb)
    )
  );
end $$;

-- housekeeping: per-minute rows are only needed for de-duplication (admin or service key;
-- schedule monthly with pg_cron if available)
create or replace function public.lexa_study_prune(keep_days int default 35)
returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not (public.lexa_is_admin() or public.lexa_is_service() or auth.uid() is null) then raise exception 'admin only'; end if;
  delete from public.lexa_study_beats where minute < now() - make_interval(days => greatest(coalesce(keep_days, 35), 15));
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- --- grants (002 granted every function to anon; be explicit) ---
revoke execute on function public.lexa_org_students_left_at() from public, anon, authenticated;
revoke execute on function public.lexa_official_day(public.lexa_org_students) from public, anon, authenticated;
revoke execute on function public.lexa_content_org(text, text) from public, anon, authenticated;
revoke execute on function public.lexa_study_track(jsonb, jsonb) from public, anon;
revoke execute on function public.lexa_my_study(integer) from public, anon;
revoke execute on function public.lexa_my_learning(integer) from public, anon;
revoke execute on function public.lexa_study_forget() from public, anon;
revoke execute on function public.lexa_org_study_report(uuid, date, date) from public, anon;
revoke execute on function public.lexa_org_dashboard(uuid) from public, anon;
revoke execute on function public.lexa_teacher_overview(uuid) from public, anon;
revoke execute on function public.lexa_class_study_report(uuid, date, date) from public, anon;
revoke execute on function public.lexa_admin_study_overview(date, date) from public, anon;
revoke execute on function public.lexa_study_prune(integer) from public, anon;

grant execute on function public.lexa_study_track(jsonb, jsonb) to authenticated;
grant execute on function public.lexa_my_study(integer) to authenticated;
grant execute on function public.lexa_my_learning(integer) to authenticated;
grant execute on function public.lexa_study_forget() to authenticated;
grant execute on function public.lexa_org_study_report(uuid, date, date) to authenticated;
grant execute on function public.lexa_org_dashboard(uuid) to authenticated;
grant execute on function public.lexa_teacher_overview(uuid) to authenticated;
grant execute on function public.lexa_class_study_report(uuid, date, date) to authenticated;
grant execute on function public.lexa_admin_study_overview(date, date) to authenticated;
grant execute on function public.lexa_study_prune(integer) to authenticated, service_role;

notify pgrst, 'reload schema';
