-- Lexa 008: classes, official exams and grades (phase 3 of docs/ORG_LEARNING.md).
-- Run in the Supabase SQL editor after 006 and 007. Safe to re-run.
--
--   * terms, subjects (courses of the catalogue) and classes of a centre; a class has one teacher
--   * enrolments of official students (enrolled / completed / dropped); closing a term marks
--     its enrolments completed
--   * a 5th content visibility "class": only the teacher and the students of the classes the
--     item is attached to (graduates keep the classes they completed, never new ones)
--   * official exams: server clock, one attempt, server-side grading, the answer key and the
--     questions table are never readable by students; results only after the end
--   * grades out of 20 (midterm / final exam / final mark), sources manual, csv, api,
--     connector, lexa_exam; prior GPA for the comparison report of phase 6
--   * grades and official results can only be deleted by the centre owner (or a Lexa admin)
--
-- Teachers see only their own classes. Managers need a two-factor session (aal2) for anything
-- that shows or changes student data. Every change is written to the audit log of 006.
-- Clients get no table writes at all: everything goes through the RPCs below.

do $$ begin
  if to_regprocedure('public.lexa_can_see(text, uuid, uuid)') is null
     or to_regprocedure('public.lexa_org_official(uuid)') is null then
    raise exception 'run 006 and 007 first';
  end if;
end $$;

-- --- small helpers ---
create or replace function public.lexa_is_service()
returns boolean language sql stable as $$
  select coalesce(auth.role(), '') = 'service_role' or coalesce(current_setting('role', true), '') = 'service_role'
$$;

create or replace function public.lexa_org_owner(o uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.lexa_is_admin() or exists (
    select 1 from public.lexa_org_members
    where org_id = o and user_id = auth.uid() and status = 'active' and role = 'owner'
  )
$$;

-- --- terms and subjects ---
create table if not exists public.lexa_org_terms (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.lexa_orgs(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  starts_on date,
  ends_on date,
  status text not null default 'current' check (status in ('planned', 'current', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_on is null or ends_on is null or ends_on >= starts_on)
);
create index if not exists lexa_org_terms_org_idx on public.lexa_org_terms (org_id, created_at desc);

create table if not exists public.lexa_org_courses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.lexa_orgs(id) on delete cascade,
  code text not null default '' check (char_length(code) <= 30),
  title text not null check (char_length(title) between 1 and 120),
  units numeric(4, 1) not null default 0 check (units between 0 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists lexa_org_courses_code_key on public.lexa_org_courses (org_id, lower(code)) where code <> '';
create index if not exists lexa_org_courses_org_idx on public.lexa_org_courses (org_id);

-- --- classes ---
create table if not exists public.lexa_org_classes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.lexa_orgs(id) on delete cascade,
  term_id uuid not null references public.lexa_org_terms(id),
  course_id uuid not null references public.lexa_org_courses(id),
  title text not null default '' check (char_length(title) <= 120),
  teacher_id uuid references public.lexa_profiles(id) on delete set null,
  external_id text not null default '' check (char_length(external_id) <= 80),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references public.lexa_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists lexa_org_classes_ext_key on public.lexa_org_classes (org_id, external_id) where external_id <> '';
create index if not exists lexa_org_classes_org_idx on public.lexa_org_classes (org_id, term_id);
create index if not exists lexa_org_classes_teacher_idx on public.lexa_org_classes (teacher_id);

create table if not exists public.lexa_org_enrollments (
  class_id uuid not null references public.lexa_org_classes(id) on delete cascade,
  student_id uuid not null references public.lexa_org_students(id) on delete cascade,
  org_id uuid not null references public.lexa_orgs(id) on delete cascade,
  status text not null default 'enrolled' check (status in ('enrolled', 'completed', 'dropped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (class_id, student_id)
);
create index if not exists lexa_org_enrollments_student_idx on public.lexa_org_enrollments (student_id);

-- content attached to a class (used by visibility "class")
create table if not exists public.lexa_org_class_content (
  class_id uuid not null references public.lexa_org_classes(id) on delete cascade,
  kind text not null check (kind in ('post', 'tcourse')),
  item_id uuid not null,
  org_id uuid not null references public.lexa_orgs(id) on delete cascade,
  added_by uuid references public.lexa_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (class_id, kind, item_id)
);
create index if not exists lexa_org_class_content_item_idx on public.lexa_org_class_content (kind, item_id);

-- --- official exams ---
create table if not exists public.lexa_org_exams (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.lexa_orgs(id) on delete cascade,
  class_id uuid not null references public.lexa_org_classes(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  instructions text not null default '' check (char_length(instructions) <= 2000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  duration_min int not null default 60 check (duration_min between 1 and 600),
  shuffle boolean not null default true,
  results text not null default 'after_end' check (results in ('after_end', 'manual')),
  released_at timestamptz,
  max_score numeric(5, 2) not null default 20 check (max_score > 0 and max_score <= 100),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid references public.lexa_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists lexa_org_exams_class_idx on public.lexa_org_exams (class_id, starts_at desc);

create table if not exists public.lexa_org_exam_questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.lexa_org_exams(id) on delete cascade,
  position int not null default 0,
  text text not null check (char_length(text) between 1 and 4000),
  options jsonb not null,
  correct int not null,
  points numeric(5, 2) not null default 1 check (points > 0 and points <= 100),
  explanation text not null default '' check (char_length(explanation) <= 2000),
  check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 8),
  check (correct >= 0 and correct < jsonb_array_length(options))
);
create index if not exists lexa_org_exam_questions_exam_idx on public.lexa_org_exam_questions (exam_id, position);

create table if not exists public.lexa_org_exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.lexa_org_exams(id) on delete cascade,
  org_id uuid not null references public.lexa_orgs(id) on delete cascade,
  student_id uuid not null references public.lexa_org_students(id) on delete cascade,
  user_id uuid not null,
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  submitted_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted')),
  raw_score numeric(8, 2),
  raw_max numeric(8, 2),
  score numeric(5, 2),
  qorder jsonb not null default '[]'::jsonb,
  unique (exam_id, student_id)
);
create index if not exists lexa_org_exam_attempts_user_idx on public.lexa_org_exam_attempts (user_id);

create table if not exists public.lexa_org_exam_answers (
  attempt_id uuid not null references public.lexa_org_exam_attempts(id) on delete cascade,
  question_id uuid not null references public.lexa_org_exam_questions(id) on delete cascade,
  choice int not null check (choice >= 0 and choice < 8),
  answered_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

-- --- grades ---
create table if not exists public.lexa_org_grades (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.lexa_orgs(id) on delete cascade,
  class_id uuid not null references public.lexa_org_classes(id) on delete cascade,
  student_id uuid not null references public.lexa_org_students(id) on delete cascade,
  component text not null check (component in ('midterm', 'final_exam', 'final')),
  score numeric(5, 2) not null,
  max_score numeric(5, 2) not null default 20 check (max_score > 0 and max_score <= 100),
  source text not null default 'manual' check (source in ('manual', 'csv', 'api', 'connector', 'lexa_exam')),
  note text not null default '' check (char_length(note) <= 200),
  entered_by uuid references public.lexa_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (score >= 0 and score <= max_score),
  unique (class_id, student_id, component)
);
create index if not exists lexa_org_grades_student_idx on public.lexa_org_grades (student_id);

create table if not exists public.lexa_org_prior_gpa (
  org_id uuid not null references public.lexa_orgs(id) on delete cascade,
  student_id uuid not null references public.lexa_org_students(id) on delete cascade,
  gpa numeric(4, 2) not null check (gpa between 0 and 20),
  as_of text not null default '' check (char_length(as_of) <= 20),
  source text not null default 'manual' check (source in ('manual', 'csv', 'api', 'connector')),
  updated_at timestamptz not null default now(),
  primary key (org_id, student_id)
);

-- touch triggers
drop trigger if exists lexa_org_terms_touch on public.lexa_org_terms;
create trigger lexa_org_terms_touch before update on public.lexa_org_terms
  for each row execute function public.lexa_touch_updated();
drop trigger if exists lexa_org_courses_touch on public.lexa_org_courses;
create trigger lexa_org_courses_touch before update on public.lexa_org_courses
  for each row execute function public.lexa_touch_updated();
drop trigger if exists lexa_org_classes_touch on public.lexa_org_classes;
create trigger lexa_org_classes_touch before update on public.lexa_org_classes
  for each row execute function public.lexa_touch_updated();
drop trigger if exists lexa_org_enrollments_touch on public.lexa_org_enrollments;
create trigger lexa_org_enrollments_touch before update on public.lexa_org_enrollments
  for each row execute function public.lexa_touch_updated();
drop trigger if exists lexa_org_exams_touch on public.lexa_org_exams;
create trigger lexa_org_exams_touch before update on public.lexa_org_exams
  for each row execute function public.lexa_touch_updated();
drop trigger if exists lexa_org_grades_touch on public.lexa_org_grades;
create trigger lexa_org_grades_touch before update on public.lexa_org_grades
  for each row execute function public.lexa_touch_updated();

-- grades and official results: deleted only by trusted RPCs (owner), the service key,
-- the SQL editor or a Lexa admin (deleting a whole centre)
create or replace function public.lexa_results_delete_guard()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not public.lexa_is_admin()
     and coalesce(current_setting('lexa.trusted', true), '') <> '1' then
    raise exception 'owner_only';
  end if;
  return old;
end $$;
drop trigger if exists lexa_org_grades_no_delete on public.lexa_org_grades;
create trigger lexa_org_grades_no_delete before delete on public.lexa_org_grades
  for each row execute function public.lexa_results_delete_guard();
drop trigger if exists lexa_org_exam_attempts_no_delete on public.lexa_org_exam_attempts;
create trigger lexa_org_exam_attempts_no_delete before delete on public.lexa_org_exam_attempts
  for each row execute function public.lexa_results_delete_guard();
drop trigger if exists lexa_org_exam_answers_no_delete on public.lexa_org_exam_answers;
create trigger lexa_org_exam_answers_no_delete before delete on public.lexa_org_exam_answers
  for each row execute function public.lexa_results_delete_guard();

-- --- role helpers ---
-- the caller teaches this class (and is still an active member of its active centre)
create or replace function public.lexa_class_teacher(k uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.lexa_org_classes c
    where c.id = k and c.teacher_id = auth.uid()
      and public.lexa_org_active(c.org_id) and public.lexa_org_active_member(c.org_id)
  )
$$;

-- the caller studies in this class right now: active students see enrolled + completed
-- classes, graduates / withdrawn students with open access only completed ones
create or replace function public.lexa_class_learner(k uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.lexa_org_enrollments e
    join public.lexa_org_students s on s.id = e.student_id
    where e.class_id = k and s.user_id = auth.uid() and public.lexa_org_official(e.org_id)
      and ((s.status = 'active' and e.status in ('enrolled', 'completed'))
           or (s.status in ('graduated', 'withdrawn') and e.status = 'completed'))
  )
$$;

-- teacher of the class, a manager with a two-factor session, or the service key; returns the centre
create or replace function public.lexa_class_require_staff(k uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select c.org_id into v_org from public.lexa_org_classes c where c.id = k;
  if v_org is null then raise exception 'not_found'; end if;
  if public.lexa_is_service() or public.lexa_class_teacher(k) then return v_org; end if;
  if public.lexa_org_can_manage(v_org) then
    if not public.lexa_mfa_ok() then raise exception 'mfa required'; end if;
    return v_org;
  end if;
  raise exception 'not_staff';
end $$;

create or replace function public.lexa_org_require_manager(o uuid, need_mfa boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.lexa_is_service() then return; end if;
  if not public.lexa_org_can_manage(o) then raise exception 'not a manager of this organisation'; end if;
  if need_mfa and not public.lexa_mfa_ok() then raise exception 'mfa required'; end if;
end $$;

-- roster row of a centre by username, student number or id
create or replace function public.lexa_org_find_student(o uuid, ref text)
returns uuid language sql stable security definer set search_path = public as $$
  select s.id from public.lexa_org_students s
  where s.org_id = o and (
    lower(s.org_username) = lower(trim(ref))
    or (s.student_no <> '' and s.student_no = trim(ref))
    or s.id = public.lexa_try_uuid(trim(ref)))
  order by (lower(s.org_username) = lower(trim(ref))) desc
  limit 1
$$;

-- --- visibility "class" (extends 007) ---
alter table public.lexa_posts drop constraint if exists lexa_posts_visibility_chk;
alter table public.lexa_posts add constraint lexa_posts_visibility_chk
  check (visibility in ('public', 'users', 'org', 'class', 'draft'));
alter table public.lexa_tcourses drop constraint if exists lexa_tcourses_visibility_chk;
alter table public.lexa_tcourses add constraint lexa_tcourses_visibility_chk
  check (visibility in ('public', 'users', 'org', 'class', 'draft'));

create or replace function public.lexa_can_see_item(t text, item uuid, vis text, o uuid, author uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case when coalesce(vis, 'public') <> 'class' then public.lexa_can_see(vis, o, author)
  else auth.uid() is not null and (
    author = auth.uid() or public.lexa_is_admin()
    or (o is not null and public.lexa_org_can_manage(o))
    or (o is not null and exists (
      select 1 from public.lexa_org_class_content cc
      where cc.kind = t and cc.item_id = item and cc.org_id = o
        and (public.lexa_class_teacher(cc.class_id) or public.lexa_class_learner(cc.class_id)))))
  end
$$;

create or replace function public.lexa_visibility_guard()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null
     and (tg_op = 'INSERT' or new.visibility is distinct from old.visibility or new.org_id is distinct from old.org_id)
     and new.visibility in ('org', 'class') and new.org_id is null then
    raise exception 'org visibility needs an organisation';
  end if;
  return new;
end $$;

drop policy if exists "posts read" on public.lexa_posts;
create policy "posts read" on public.lexa_posts for select using (
  public.lexa_can_see_item('post', id, visibility, org_id, author_id)
);
drop policy if exists "tcourses read" on public.lexa_tcourses;
create policy "tcourses read" on public.lexa_tcourses for select using (
  teacher_id = auth.uid() or public.lexa_is_admin()
  or (status <> 'draft' and public.lexa_can_see_item('tcourse', id, visibility, org_id, teacher_id))
);

create or replace function public.lexa_ratings_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.target_type = 'post' then
    if not exists (select 1 from public.lexa_posts p
                   where p.id = new.target_id and public.lexa_can_see_item('post', p.id, p.visibility, p.org_id, p.author_id)) then
      raise exception 'rating target not found';
    end if;
  elsif new.target_type = 'tcourse' then
    if not exists (
      select 1 from public.lexa_tcourses c
      where c.id = new.target_id
        and (c.teacher_id = auth.uid() or public.lexa_is_admin()
             or (c.status <> 'draft' and public.lexa_can_see_item('tcourse', c.id, c.visibility, c.org_id, c.teacher_id)))
    ) then
      raise exception 'rating target not found';
    end if;
  else
    raise exception 'bad rating target type';
  end if;
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function public.lexa_rating_aggs(t text, ids uuid[])
returns table (target_id uuid, avg numeric, cnt bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if t not in ('post', 'tcourse') then raise exception 'bad rating target type'; end if;
  if coalesce(cardinality(ids), 0) > 200 then raise exception 'too many ids'; end if;
  return query
    select r.target_id, round(avg(r.stars)::numeric, 1), count(*)
    from public.lexa_ratings r
    where r.target_type = t and r.target_id = any(coalesce(ids, '{}'::uuid[]))
      and ((t = 'post' and exists (
              select 1 from public.lexa_posts p
              where p.id = r.target_id and public.lexa_can_see_item('post', p.id, p.visibility, p.org_id, p.author_id)))
        or (t = 'tcourse' and exists (
              select 1 from public.lexa_tcourses c
              where c.id = r.target_id
                and (c.teacher_id = auth.uid() or public.lexa_is_admin()
                     or (c.status <> 'draft' and public.lexa_can_see_item('tcourse', c.id, c.visibility, c.org_id, c.teacher_id))))))
    group by r.target_id;
end $$;

create or replace function public.lexa_course_students(ids uuid[])
returns table (course_id uuid, students bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(cardinality(ids), 0) > 200 then raise exception 'too many ids'; end if;
  return query
    select l.course_id, count(*)
    from public.lexa_library l
    join public.lexa_tcourses c on c.id = l.course_id
    where l.course_id = any(coalesce(ids, '{}'::uuid[]))
      and (c.teacher_id = auth.uid() or public.lexa_is_admin()
           or (c.status <> 'draft' and public.lexa_can_see_item('tcourse', c.id, c.visibility, c.org_id, c.teacher_id)))
    group by l.course_id;
end $$;

-- a deleted post / course leaves no class links behind
create or replace function public.lexa_drop_class_links()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.lexa_org_class_content
  where item_id = old.id and kind = (case when tg_table_name = 'lexa_posts' then 'post' else 'tcourse' end);
  return old;
end $$;
drop trigger if exists lexa_posts_drop_class_links on public.lexa_posts;
create trigger lexa_posts_drop_class_links after delete on public.lexa_posts
  for each row execute function public.lexa_drop_class_links();
drop trigger if exists lexa_tcourses_drop_class_links on public.lexa_tcourses;
create trigger lexa_tcourses_drop_class_links after delete on public.lexa_tcourses
  for each row execute function public.lexa_drop_class_links();

-- --- RLS: terms, subjects and classes are readable by the people of the centre ---
alter table public.lexa_org_terms enable row level security;
alter table public.lexa_org_courses enable row level security;
alter table public.lexa_org_classes enable row level security;
alter table public.lexa_org_enrollments enable row level security;
alter table public.lexa_org_class_content enable row level security;
alter table public.lexa_org_exams enable row level security;
alter table public.lexa_org_exam_questions enable row level security;
alter table public.lexa_org_exam_attempts enable row level security;
alter table public.lexa_org_exam_answers enable row level security;
alter table public.lexa_org_grades enable row level security;
alter table public.lexa_org_prior_gpa enable row level security;

drop policy if exists "org terms read" on public.lexa_org_terms;
create policy "org terms read" on public.lexa_org_terms for select using (
  public.lexa_org_can_manage(org_id) or public.lexa_org_active_member(org_id) or public.lexa_org_official(org_id)
);
drop policy if exists "org courses read" on public.lexa_org_courses;
create policy "org courses read" on public.lexa_org_courses for select using (
  public.lexa_org_can_manage(org_id) or public.lexa_org_active_member(org_id) or public.lexa_org_official(org_id)
);
drop policy if exists "org classes read" on public.lexa_org_classes;
create policy "org classes read" on public.lexa_org_classes for select using (
  public.lexa_org_can_manage(org_id) or teacher_id = auth.uid() or public.lexa_class_learner(id)
);
-- enrolments, content links, exams, questions, attempts, answers, grades, prior GPA:
-- no client policy at all (RPCs only)

revoke all on public.lexa_org_terms, public.lexa_org_courses, public.lexa_org_classes,
  public.lexa_org_enrollments, public.lexa_org_class_content, public.lexa_org_exams,
  public.lexa_org_exam_questions, public.lexa_org_exam_attempts, public.lexa_org_exam_answers,
  public.lexa_org_grades, public.lexa_org_prior_gpa
  from public, anon, authenticated;
grant select on public.lexa_org_terms, public.lexa_org_courses, public.lexa_org_classes to authenticated;

-- --- terms, subjects, classes (managers) ---
create or replace function public.lexa_org_term_save(o uuid, t_id uuid, t_title text, t_starts date, t_ends date, t_status text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid := t_id;
begin
  perform public.lexa_org_require_manager(o, false);
  if not public.lexa_org_active(o) then raise exception 'org_not_active'; end if;
  if coalesce(t_status, 'current') not in ('planned', 'current', 'closed') then raise exception 'bad_input'; end if;
  if v_id is null then
    insert into public.lexa_org_terms (org_id, title, starts_on, ends_on, status)
    values (o, left(trim(coalesce(t_title, '')), 60), t_starts, t_ends, coalesce(t_status, 'current'))
    returning id into v_id;
  else
    update public.lexa_org_terms set title = left(trim(coalesce(t_title, '')), 60), starts_on = t_starts,
      ends_on = t_ends, status = coalesce(t_status, status)
    where id = v_id and org_id = o;
    if not found then raise exception 'not_found'; end if;
  end if;
  if t_status = 'closed' then
    update public.lexa_org_enrollments e set status = 'completed'
    from public.lexa_org_classes c
    where c.id = e.class_id and c.term_id = v_id and e.status = 'enrolled';
  end if;
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(o, 'term.save', v_id, jsonb_build_object('title', t_title, 'status', t_status));
  return v_id;
end $$;

create or replace function public.lexa_org_course_save(o uuid, c_id uuid, c_code text, c_title text, c_units numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid := c_id;
begin
  perform public.lexa_org_require_manager(o, false);
  if not public.lexa_org_active(o) then raise exception 'org_not_active'; end if;
  if v_id is null then
    insert into public.lexa_org_courses (org_id, code, title, units)
    values (o, left(trim(coalesce(c_code, '')), 30), left(trim(coalesce(c_title, '')), 120), coalesce(c_units, 0))
    returning id into v_id;
  else
    update public.lexa_org_courses set code = left(trim(coalesce(c_code, '')), 30),
      title = left(trim(coalesce(c_title, '')), 120), units = coalesce(c_units, units)
    where id = v_id and org_id = o;
    if not found then raise exception 'not_found'; end if;
  end if;
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(o, 'course.save', v_id, jsonb_build_object('code', c_code, 'title', c_title));
  return v_id;
end $$;

create or replace function public.lexa_org_class_save(o uuid, k_id uuid, k_term uuid, k_course uuid, k_title text,
                                                     k_teacher uuid, k_external text, k_status text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid := k_id;
begin
  perform public.lexa_org_require_manager(o, false);
  if not public.lexa_org_active(o) then raise exception 'org_not_active'; end if;
  if not exists (select 1 from public.lexa_org_terms where id = k_term and org_id = o)
     or not exists (select 1 from public.lexa_org_courses where id = k_course and org_id = o) then
    raise exception 'not_found';
  end if;
  if k_teacher is not null and not exists (
    select 1 from public.lexa_org_members where org_id = o and user_id = k_teacher and status = 'active') then
    raise exception 'teacher_not_member';
  end if;
  if coalesce(k_status, 'active') not in ('active', 'archived') then raise exception 'bad_input'; end if;
  if v_id is null then
    insert into public.lexa_org_classes (org_id, term_id, course_id, title, teacher_id, external_id, status, created_by)
    values (o, k_term, k_course, left(trim(coalesce(k_title, '')), 120), k_teacher,
            left(trim(coalesce(k_external, '')), 80), coalesce(k_status, 'active'), auth.uid())
    returning id into v_id;
  else
    update public.lexa_org_classes set term_id = k_term, course_id = k_course,
      title = left(trim(coalesce(k_title, '')), 120), teacher_id = k_teacher,
      external_id = left(trim(coalesce(k_external, '')), 80), status = coalesce(k_status, status)
    where id = v_id and org_id = o;
    if not found then raise exception 'not_found'; end if;
  end if;
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(o, 'class.save', v_id, jsonb_build_object('teacher', k_teacher, 'status', k_status));
  return v_id;
end $$;

-- deleting a class also deletes its grades and exam results: owner only, two-factor session
create or replace function public.lexa_org_class_delete(k uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_grades int;
  v_attempts int;
begin
  select c.org_id into v_org from public.lexa_org_classes c where c.id = k;
  if v_org is null then raise exception 'not_found'; end if;
  if not public.lexa_org_owner(v_org) then raise exception 'owner_only'; end if;
  if not public.lexa_mfa_ok() then raise exception 'mfa required'; end if;
  select count(*) into v_grades from public.lexa_org_grades where class_id = k;
  select count(*) into v_attempts from public.lexa_org_exam_attempts a
    join public.lexa_org_exams x on x.id = a.exam_id where x.class_id = k;
  perform set_config('lexa.trusted', '1', true);
  delete from public.lexa_org_classes where id = k;
  perform set_config('lexa.trusted', '', true);
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(v_org, 'class.delete', k, jsonb_build_object('grades', v_grades, 'attempts', v_attempts));
  return 'ok';
end $$;

-- classes for the panel: managers see all, teachers only their own
create or replace function public.lexa_org_class_list(o uuid)
returns table (id uuid, term_id uuid, term_title text, term_status text, course_id uuid, course_code text,
               course_title text, units numeric, title text, teacher_id uuid, teacher_name text,
               external_id text, status text, students int, exams int, mine boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare v_all boolean := public.lexa_org_can_manage(o);
begin
  if not v_all and not public.lexa_org_active_member(o) then raise exception 'not_staff'; end if;
  return query
    select c.id, c.term_id, t.title, t.status, c.course_id, s.code, s.title, s.units, c.title, c.teacher_id,
      coalesce(nullif(p.display_name, ''), p.username, ''), c.external_id, c.status,
      (select count(*)::int from public.lexa_org_enrollments e where e.class_id = c.id and e.status <> 'dropped'),
      (select count(*)::int from public.lexa_org_exams x where x.class_id = c.id),
      c.teacher_id = auth.uid()
    from public.lexa_org_classes c
    join public.lexa_org_terms t on t.id = c.term_id
    join public.lexa_org_courses s on s.id = c.course_id
    left join public.lexa_profiles p on p.id = c.teacher_id
    where c.org_id = o and (v_all or c.teacher_id = auth.uid())
    order by t.created_at desc, s.title, c.title;
end $$;

-- enrol / drop students by username, student number or roster id (managers, two-factor)
create or replace function public.lexa_org_enroll(k uuid, refs text[], drop_them boolean default false)
returns table (ref text, result text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_org uuid;
  v_ref text;
  v_sid uuid;
  v_status text;
  v_ok int := 0;
begin
  select c.org_id into v_org from public.lexa_org_classes c where c.id = k;
  if v_org is null then raise exception 'not_found'; end if;
  perform public.lexa_org_require_manager(v_org, true);
  if not public.lexa_org_active(v_org) then raise exception 'org_not_active'; end if;
  if coalesce(cardinality(refs), 0) = 0 or cardinality(refs) > 1000 then raise exception 'bad_batch'; end if;
  foreach v_ref in array refs loop
    v_sid := public.lexa_org_find_student(v_org, v_ref);
    if v_sid is null then
      ref := v_ref; result := 'not_found'; return next; continue;
    end if;
    if drop_them then
      update public.lexa_org_enrollments set status = 'dropped' where class_id = k and student_id = v_sid;
      ref := v_ref; result := case when found then 'dropped' else 'not_enrolled' end; return next;
      continue;
    end if;
    select s.status into v_status from public.lexa_org_students s where s.id = v_sid;
    if v_status <> 'active' then
      ref := v_ref; result := 'not_active'; return next; continue;
    end if;
    insert into public.lexa_org_enrollments (class_id, student_id, org_id, status)
    values (k, v_sid, v_org, 'enrolled')
    on conflict (class_id, student_id) do update set status = 'enrolled'
      where public.lexa_org_enrollments.status = 'dropped';
    v_ok := v_ok + 1;
    ref := v_ref; result := 'enrolled'; return next;
  end loop;
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(v_org, case when drop_them then 'class.drop' else 'class.enroll' end, k,
    jsonb_build_object('count', cardinality(refs), 'ok', v_ok));
end $$;

-- students of a class with their grades (teacher of the class, or a manager with two-factor)
create or replace function public.lexa_class_students(k uuid)
returns table (student_id uuid, org_username text, full_name text, student_no text, student_status text,
               enrollment text, grades jsonb)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.lexa_class_require_staff(k);
  return query
    select s.id, s.org_username, s.full_name, s.student_no, s.status, e.status,
      coalesce((select jsonb_object_agg(g.component, jsonb_build_object('score', g.score, 'max', g.max_score,
                  'source', g.source, 'updated_at', g.updated_at))
                from public.lexa_org_grades g where g.class_id = k and g.student_id = s.id), '{}'::jsonb)
    from public.lexa_org_enrollments e
    join public.lexa_org_students s on s.id = e.student_id
    where e.class_id = k
    order by (e.status = 'dropped'), s.full_name, s.org_username;
end $$;

-- --- grades ---
-- items: [{ "ref": username | student number | roster id, "component": "midterm" | "final_exam" | "final",
--          "score": 17.5, "max": 20, "note": "" }]
create or replace function public.lexa_grades_upsert(k uuid, items jsonb, src text default 'manual')
returns table (row_no int, result text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_org uuid;
  v_row jsonb;
  v_i int := 0;
  v_sid uuid;
  v_comp text;
  v_score numeric;
  v_max numeric;
  v_old record;
  v_changed int := 0;
begin
  v_org := public.lexa_class_require_staff(k);
  if not public.lexa_org_active(v_org) then raise exception 'org_not_active'; end if;
  if src not in ('manual', 'csv', 'api', 'connector') then raise exception 'bad_input'; end if;
  if src in ('api', 'connector') and not public.lexa_is_service() then raise exception 'bad_input'; end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 or jsonb_array_length(items) > 2000 then
    raise exception 'bad_batch';
  end if;
  perform set_config('lexa.audit_ok', '1', true);
  for v_row in select value from jsonb_array_elements(items) loop
    v_i := v_i + 1;
    v_sid := public.lexa_org_find_student(v_org, coalesce(v_row ->> 'ref', ''));
    v_comp := coalesce(v_row ->> 'component', '');
    if v_sid is null then row_no := v_i; result := 'not_found'; return next; continue; end if;
    if not exists (select 1 from public.lexa_org_enrollments e
                   where e.class_id = k and e.student_id = v_sid and e.status <> 'dropped') then
      row_no := v_i; result := 'not_enrolled'; return next; continue;
    end if;
    if v_comp not in ('midterm', 'final_exam', 'final') then
      row_no := v_i; result := 'bad_component'; return next; continue;
    end if;
    begin
      v_score := nullif(trim(coalesce(v_row ->> 'score', '')), '')::numeric;
      v_max := coalesce(nullif(trim(coalesce(v_row ->> 'max', '')), '')::numeric, 20);
    exception when others then
      row_no := v_i; result := 'bad_score'; return next; continue;
    end;
    if v_score is null then row_no := v_i; result := 'skipped'; return next; continue; end if;
    if v_max <= 0 or v_max > 100 or v_score < 0 or v_score > v_max then
      row_no := v_i; result := 'bad_score'; return next; continue;
    end if;
    v_score := round(v_score, 2);
    select g.score, g.max_score, g.source into v_old from public.lexa_org_grades g
      where g.class_id = k and g.student_id = v_sid and g.component = v_comp;
    if found and v_old.score = v_score and v_old.max_score = v_max then
      row_no := v_i; result := 'same'; return next; continue;
    end if;
    insert into public.lexa_org_grades (org_id, class_id, student_id, component, score, max_score, source, note, entered_by)
    values (v_org, k, v_sid, v_comp, v_score, v_max, src, left(coalesce(v_row ->> 'note', ''), 200), auth.uid())
    on conflict (class_id, student_id, component) do update set score = excluded.score,
      max_score = excluded.max_score, source = excluded.source, note = excluded.note, entered_by = excluded.entered_by;
    if v_old is not null and v_old.score is not null then
      perform public.lexa_audit(v_org, 'grade.change', v_sid, jsonb_build_object('class', k, 'component', v_comp,
        'old', v_old.score, 'old_max', v_old.max_score, 'new', v_score, 'max', v_max, 'source', src));
    end if;
    v_changed := v_changed + 1;
    row_no := v_i; result := 'saved'; return next;
  end loop;
  perform public.lexa_audit(v_org, 'grade.upsert', k, jsonb_build_object('rows', v_i, 'saved', v_changed, 'source', src));
end $$;

-- owner only (two-factor): delete grades
create or replace function public.lexa_grades_delete(ids uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare
  g record;
  v_n int := 0;
begin
  if coalesce(cardinality(ids), 0) = 0 or cardinality(ids) > 2000 then raise exception 'bad_batch'; end if;
  perform set_config('lexa.audit_ok', '1', true);
  for g in select * from public.lexa_org_grades where id = any(ids) loop
    if not public.lexa_org_owner(g.org_id) then raise exception 'owner_only'; end if;
    if not public.lexa_mfa_ok() then raise exception 'mfa required'; end if;
    perform set_config('lexa.trusted', '1', true);
    delete from public.lexa_org_grades where id = g.id;
    perform set_config('lexa.trusted', '', true);
    perform public.lexa_audit(g.org_id, 'grade.delete', g.student_id, jsonb_build_object('class', g.class_id,
      'component', g.component, 'score', g.score, 'max', g.max_score));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- grade ids of a class (for the owner's delete action)
create or replace function public.lexa_class_grade_ids(k uuid, comp text default null)
returns table (id uuid, student_id uuid, component text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.lexa_class_require_staff(k);
  return query select g.id, g.student_id, g.component from public.lexa_org_grades g
    where g.class_id = k and (comp is null or g.component = comp);
end $$;

-- prior GPA (managers, two-factor): [{ "ref": "...", "gpa": 16.4, "as_of": "1403-2" }]
create or replace function public.lexa_prior_gpa_upsert(o uuid, items jsonb, src text default 'csv')
returns table (row_no int, result text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_row jsonb;
  v_i int := 0;
  v_sid uuid;
  v_gpa numeric;
  v_ok int := 0;
begin
  perform public.lexa_org_require_manager(o, true);
  if not public.lexa_org_active(o) then raise exception 'org_not_active'; end if;
  if src not in ('manual', 'csv', 'api', 'connector') then raise exception 'bad_input'; end if;
  if src in ('api', 'connector') and not public.lexa_is_service() then raise exception 'bad_input'; end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 or jsonb_array_length(items) > 5000 then
    raise exception 'bad_batch';
  end if;
  for v_row in select value from jsonb_array_elements(items) loop
    v_i := v_i + 1;
    v_sid := public.lexa_org_find_student(o, coalesce(v_row ->> 'ref', ''));
    if v_sid is null then row_no := v_i; result := 'not_found'; return next; continue; end if;
    begin
      v_gpa := nullif(trim(coalesce(v_row ->> 'gpa', '')), '')::numeric;
    exception when others then
      row_no := v_i; result := 'bad_score'; return next; continue;
    end;
    if v_gpa is null or v_gpa < 0 or v_gpa > 20 then row_no := v_i; result := 'bad_score'; return next; continue; end if;
    insert into public.lexa_org_prior_gpa (org_id, student_id, gpa, as_of, source)
    values (o, v_sid, round(v_gpa, 2), left(coalesce(v_row ->> 'as_of', ''), 20), src)
    on conflict (org_id, student_id) do update set gpa = excluded.gpa, as_of = excluded.as_of,
      source = excluded.source, updated_at = now();
    v_ok := v_ok + 1;
    row_no := v_i; result := 'saved'; return next;
  end loop;
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(o, 'gpa.upsert', null, jsonb_build_object('rows', v_i, 'saved', v_ok, 'source', src));
end $$;

-- --- the student side ---
create or replace function public.lexa_my_classes()
returns table (class_id uuid, org_id uuid, org_name text, term_title text, course_title text, course_code text,
               title text, teacher_name text, enrollment text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  return query
    select c.id, c.org_id, g.name, t.title, s.title, s.code, c.title,
      coalesce(nullif(p.display_name, ''), p.username, ''), e.status
    from public.lexa_org_enrollments e
    join public.lexa_org_students st on st.id = e.student_id
    join public.lexa_org_classes c on c.id = e.class_id
    join public.lexa_orgs g on g.id = c.org_id
    join public.lexa_org_terms t on t.id = c.term_id
    join public.lexa_org_courses s on s.id = c.course_id
    left join public.lexa_profiles p on p.id = c.teacher_id
    where st.user_id = auth.uid() and e.status <> 'dropped' and public.lexa_class_learner(c.id)
    order by t.created_at desc, s.title;
end $$;

-- my own grades are always visible to me (also after graduating)
create or replace function public.lexa_my_grades()
returns table (org_name text, term_title text, course_title text, units numeric, class_title text,
               component text, score numeric, max_score numeric, updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  return query
    select g2.name, t.title, s.title, s.units, c.title, g.component, g.score, g.max_score, g.updated_at
    from public.lexa_org_grades g
    join public.lexa_org_students st on st.id = g.student_id
    join public.lexa_org_classes c on c.id = g.class_id
    join public.lexa_orgs g2 on g2.id = g.org_id
    join public.lexa_org_terms t on t.id = c.term_id
    join public.lexa_org_courses s on s.id = c.course_id
    where st.user_id = auth.uid() and st.terms_accepted_at is not null
    order by t.created_at desc, s.title, g.component;
end $$;

-- --- content attached to a class ---
create or replace function public.lexa_class_content_set(k uuid, t text, item uuid, attach boolean, make_class boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_item_org uuid;
  v_author uuid;
  v_mgr boolean;
begin
  select c.org_id into v_org from public.lexa_org_classes c where c.id = k;
  if v_org is null then raise exception 'not_found'; end if;
  v_mgr := public.lexa_org_can_manage(v_org);
  if not (v_mgr or public.lexa_class_teacher(k)) then raise exception 'not_staff'; end if;
  if t = 'post' then
    select p.org_id, p.author_id into v_item_org, v_author from public.lexa_posts p where p.id = item;
  elsif t = 'tcourse' then
    select c.org_id, c.teacher_id into v_item_org, v_author from public.lexa_tcourses c where c.id = item;
  else
    raise exception 'bad_input';
  end if;
  if v_author is null then raise exception 'not_found'; end if;
  if v_item_org is distinct from v_org then raise exception 'item_other_org'; end if;
  if not v_mgr and v_author <> auth.uid() then raise exception 'not_staff'; end if;
  if attach then
    insert into public.lexa_org_class_content (class_id, kind, item_id, org_id, added_by)
    values (k, t, item, v_org, auth.uid()) on conflict do nothing;
    if make_class and v_author = auth.uid() then
      if t = 'post' then update public.lexa_posts set visibility = 'class' where id = item;
      else update public.lexa_tcourses set visibility = 'class' where id = item; end if;
    end if;
  else
    delete from public.lexa_org_class_content where class_id = k and kind = t and item_id = item;
  end if;
  return 'ok';
end $$;

create or replace function public.lexa_class_content(k uuid)
returns table (kind text, item_id uuid, title text, visibility text, author_id uuid)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare v_org uuid;
begin
  select c.org_id into v_org from public.lexa_org_classes c where c.id = k;
  if v_org is null then raise exception 'not_found'; end if;
  if not (public.lexa_org_can_manage(v_org) or public.lexa_class_teacher(k) or public.lexa_class_learner(k)) then
    raise exception 'not_staff';
  end if;
  return query
    select cc.kind, cc.item_id, coalesce(p.title, tc.title, ''), coalesce(p.visibility, tc.visibility, 'public'),
      coalesce(p.author_id, tc.teacher_id)
    from public.lexa_org_class_content cc
    left join public.lexa_posts p on cc.kind = 'post' and p.id = cc.item_id
    left join public.lexa_tcourses tc on cc.kind = 'tcourse' and tc.id = cc.item_id
    where cc.class_id = k
    order by cc.created_at desc;
end $$;

-- --- official exams ---
-- internal: grade one attempt (sum of points of correct answers, scaled to the exam's max score)
create or replace function public.lexa_exam_grade(a uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_raw numeric;
  v_max numeric;
  v_scale numeric;
begin
  select x.max_score into v_scale from public.lexa_org_exam_attempts t
    join public.lexa_org_exams x on x.id = t.exam_id where t.id = a;
  select coalesce(sum(q.points), 0) into v_max from public.lexa_org_exam_questions q
    join public.lexa_org_exam_attempts t on t.exam_id = q.exam_id where t.id = a;
  select coalesce(sum(q.points), 0) into v_raw from public.lexa_org_exam_answers ans
    join public.lexa_org_exam_questions q on q.id = ans.question_id
    where ans.attempt_id = a and ans.choice = q.correct;
  update public.lexa_org_exam_attempts set status = 'submitted',
    submitted_at = coalesce(submitted_at, least(now(), deadline_at)),
    raw_score = v_raw, raw_max = v_max,
    score = case when v_max > 0 then round(v_raw / v_max * v_scale, 2) else 0 end
  where id = a;
end $$;

-- internal: close attempts whose time is over (30 s grace for slow networks)
create or replace function public.lexa_exam_finalize_due(e uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_a uuid;
begin
  for v_a in select t.id from public.lexa_org_exam_attempts t
             where t.status = 'in_progress' and t.deadline_at + interval '30 seconds' < now()
               and (e is null or t.exam_id = e) loop
    perform public.lexa_exam_grade(v_a);
  end loop;
end $$;

-- may the student see results (and the answer key) of this exam now?
create or replace function public.lexa_exam_results_open(e uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lexa_org_exams x where x.id = e and x.ends_at < now()
                 and (x.results = 'after_end' or x.released_at is not null))
$$;

-- create / edit an exam with its questions (teacher of the class or a manager). Locked once a
-- student has started it.
-- meta: { title, instructions, starts_at, ends_at, duration_min, shuffle, results, max_score, status }
-- questions: [{ text, options: [..], correct, points, explanation }]
create or replace function public.lexa_exam_save(k uuid, e_id uuid, meta jsonb, questions jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_id uuid := e_id;
  v_q jsonb;
  v_i int := 0;
  v_opts jsonb;
  v_correct int;
begin
  v_org := public.lexa_class_require_staff(k);
  if not public.lexa_org_active(v_org) then raise exception 'org_not_active'; end if;
  if jsonb_typeof(questions) <> 'array' or jsonb_array_length(questions) = 0 or jsonb_array_length(questions) > 200 then
    raise exception 'bad_questions';
  end if;
  if v_id is not null then
    if not exists (select 1 from public.lexa_org_exams x where x.id = v_id and x.class_id = k) then
      raise exception 'not_found';
    end if;
    if exists (select 1 from public.lexa_org_exam_attempts t where t.exam_id = v_id) then
      raise exception 'exam_locked';
    end if;
  end if;
  begin
    if v_id is null then
      insert into public.lexa_org_exams (org_id, class_id, title, instructions, starts_at, ends_at, duration_min,
                                         shuffle, results, max_score, status, created_by)
      values (v_org, k, left(trim(coalesce(meta ->> 'title', '')), 140), left(coalesce(meta ->> 'instructions', ''), 2000),
              (meta ->> 'starts_at')::timestamptz, (meta ->> 'ends_at')::timestamptz,
              coalesce((meta ->> 'duration_min')::int, 60), coalesce((meta ->> 'shuffle')::boolean, true),
              coalesce(meta ->> 'results', 'after_end'), coalesce((meta ->> 'max_score')::numeric, 20),
              coalesce(meta ->> 'status', 'draft'), auth.uid())
      returning id into v_id;
    else
      update public.lexa_org_exams set title = left(trim(coalesce(meta ->> 'title', '')), 140),
        instructions = left(coalesce(meta ->> 'instructions', ''), 2000),
        starts_at = (meta ->> 'starts_at')::timestamptz, ends_at = (meta ->> 'ends_at')::timestamptz,
        duration_min = coalesce((meta ->> 'duration_min')::int, 60), shuffle = coalesce((meta ->> 'shuffle')::boolean, true),
        results = coalesce(meta ->> 'results', 'after_end'), max_score = coalesce((meta ->> 'max_score')::numeric, 20),
        status = coalesce(meta ->> 'status', 'draft'), released_at = null
      where id = v_id;
      delete from public.lexa_org_exam_questions where exam_id = v_id;
    end if;
  exception when check_violation or not_null_violation or invalid_text_representation
            or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then
    raise exception 'bad_exam';
  end;
  for v_q in select value from jsonb_array_elements(questions) loop
    v_i := v_i + 1;
    v_opts := v_q -> 'options';
    begin
      v_correct := (v_q ->> 'correct')::int;
      if jsonb_typeof(v_opts) <> 'array'
         or exists (select 1 from jsonb_array_elements(v_opts) as o(v)
                    where jsonb_typeof(o.v) <> 'string' or char_length(o.v #>> '{}') not between 1 and 500) then
        raise exception 'bad_question:%', v_i;
      end if;
      insert into public.lexa_org_exam_questions (exam_id, position, text, options, correct, points, explanation)
      values (v_id, v_i, trim(coalesce(v_q ->> 'text', '')), v_opts, v_correct,
              coalesce((v_q ->> 'points')::numeric, 1), left(coalesce(v_q ->> 'explanation', ''), 2000));
    exception when check_violation or not_null_violation or invalid_text_representation
              or numeric_value_out_of_range then
      raise exception 'bad_question:%', v_i;
    end;
  end loop;
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(v_org, 'exam.save', v_id, jsonb_build_object('class', k, 'questions', v_i,
    'status', meta ->> 'status'));
  return v_id;
end $$;

-- the editor copy with the answer key (staff only)
create or replace function public.lexa_exam_editor(e uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_x record;
begin
  select * into v_x from public.lexa_org_exams x where x.id = e;
  if v_x.id is null then raise exception 'not_found'; end if;
  perform public.lexa_class_require_staff(v_x.class_id);
  return jsonb_build_object(
    'exam', to_jsonb(v_x) - 'created_by',
    'locked', exists (select 1 from public.lexa_org_exam_attempts t where t.exam_id = e),
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'text', q.text, 'options', q.options,
      'correct', q.correct, 'points', q.points, 'explanation', q.explanation) order by q.position)
      from public.lexa_org_exam_questions q where q.exam_id = e), '[]'::jsonb));
end $$;

-- delete an exam: staff while nobody started it, afterwards only the owner (two-factor)
create or replace function public.lexa_exam_delete(e uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_x record;
  v_n int;
begin
  select * into v_x from public.lexa_org_exams x where x.id = e;
  if v_x.id is null then raise exception 'not_found'; end if;
  perform public.lexa_class_require_staff(v_x.class_id);
  select count(*) into v_n from public.lexa_org_exam_attempts t where t.exam_id = e;
  if v_n > 0 then
    if not public.lexa_org_owner(v_x.org_id) then raise exception 'owner_only'; end if;
    if not public.lexa_mfa_ok() then raise exception 'mfa required'; end if;
  end if;
  perform set_config('lexa.trusted', '1', true);
  delete from public.lexa_org_exams where id = e;
  perform set_config('lexa.trusted', '', true);
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(v_x.org_id, 'exam.delete', e, jsonb_build_object('class', v_x.class_id, 'attempts', v_n));
  return 'ok';
end $$;

-- exams of a class for the panel
create or replace function public.lexa_class_exams(k uuid)
returns table (id uuid, title text, starts_at timestamptz, ends_at timestamptz, duration_min int,
               status text, results text, released_at timestamptz, max_score numeric, questions int,
               attempts int, submitted int, avg_score numeric)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_e uuid;
begin
  perform public.lexa_class_require_staff(k);
  for v_e in select x.id from public.lexa_org_exams x where x.class_id = k loop
    perform public.lexa_exam_finalize_due(v_e);
  end loop;
  return query
    select x.id, x.title, x.starts_at, x.ends_at, x.duration_min, x.status, x.results, x.released_at, x.max_score,
      (select count(*)::int from public.lexa_org_exam_questions q where q.exam_id = x.id),
      (select count(*)::int from public.lexa_org_exam_attempts t where t.exam_id = x.id),
      (select count(*)::int from public.lexa_org_exam_attempts t where t.exam_id = x.id and t.status = 'submitted'),
      (select round(avg(t.score), 2) from public.lexa_org_exam_attempts t where t.exam_id = x.id and t.status = 'submitted')
    from public.lexa_org_exams x where x.class_id = k
    order by x.starts_at desc;
end $$;

-- results per enrolled student (staff)
create or replace function public.lexa_exam_report(e uuid)
returns table (student_id uuid, org_username text, full_name text, student_no text, state text,
               started_at timestamptz, submitted_at timestamptz, score numeric, raw_score numeric, raw_max numeric)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_x record;
begin
  select * into v_x from public.lexa_org_exams x where x.id = e;
  if v_x.id is null then raise exception 'not_found'; end if;
  perform public.lexa_class_require_staff(v_x.class_id);
  perform public.lexa_exam_finalize_due(e);
  return query
    select s.id, s.org_username, s.full_name, s.student_no,
      coalesce(t.status, 'not_started'), t.started_at, t.submitted_at, t.score, t.raw_score, t.raw_max
    from public.lexa_org_enrollments en
    join public.lexa_org_students s on s.id = en.student_id
    left join public.lexa_org_exam_attempts t on t.exam_id = e and t.student_id = s.id
    where en.class_id = v_x.class_id and (en.status <> 'dropped' or t.id is not null)
    order by s.full_name, s.org_username;
end $$;

-- publish results after the end; optionally copy the scores into a grade column
create or replace function public.lexa_exam_release(e uuid, to_component text default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_x record;
  v_n int := 0;
begin
  select * into v_x from public.lexa_org_exams x where x.id = e;
  if v_x.id is null then raise exception 'not_found'; end if;
  perform public.lexa_class_require_staff(v_x.class_id);
  if v_x.ends_at >= now() then raise exception 'exam_not_over'; end if;
  if to_component is not null and to_component not in ('midterm', 'final_exam', 'final') then
    raise exception 'bad_component';
  end if;
  perform public.lexa_exam_finalize_due(e);
  update public.lexa_org_exams set released_at = coalesce(released_at, now()) where id = e;
  if to_component is not null then
    insert into public.lexa_org_grades (org_id, class_id, student_id, component, score, max_score, source, entered_by)
    select v_x.org_id, v_x.class_id, t.student_id, to_component, least(t.score, v_x.max_score), v_x.max_score,
      'lexa_exam', auth.uid()
    from public.lexa_org_exam_attempts t
    where t.exam_id = e and t.status = 'submitted' and t.score is not null
    on conflict (class_id, student_id, component) do update set score = excluded.score,
      max_score = excluded.max_score, source = excluded.source, entered_by = excluded.entered_by;
    get diagnostics v_n = row_count;
  end if;
  perform set_config('lexa.audit_ok', '1', true);
  perform public.lexa_audit(v_x.org_id, 'exam.release', e, jsonb_build_object('component', to_component, 'grades', v_n));
  return v_n;
end $$;

-- the caller's roster row for an exam, only while enrolled and active (no official exams after leaving)
create or replace function public.lexa_exam_student(e uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select s.id
  from public.lexa_org_exams x
  join public.lexa_org_enrollments en on en.class_id = x.class_id and en.status = 'enrolled'
  join public.lexa_org_students s on s.id = en.student_id
  where x.id = e and s.user_id = auth.uid() and s.status = 'active' and public.lexa_org_official(x.org_id)
  limit 1
$$;

-- my official exams (open, upcoming and finished), with the server clock
create or replace function public.lexa_my_exams()
returns table (exam_id uuid, class_id uuid, class_title text, course_title text, org_name text, title text,
               instructions text, starts_at timestamptz, ends_at timestamptz, duration_min int, questions int,
               state text, deadline_at timestamptz, score numeric, max_score numeric, results_open boolean,
               server_now timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  perform public.lexa_exam_finalize_due(t.exam_id)
    from public.lexa_org_exam_attempts t where t.user_id = auth.uid() and t.status = 'in_progress';
  return query
    select x.id, c.id, c.title, s.title, g.name, x.title, x.instructions, x.starts_at, x.ends_at, x.duration_min,
      (select count(*)::int from public.lexa_org_exam_questions q where q.exam_id = x.id),
      coalesce(t.status, case when now() < x.starts_at then 'upcoming' when now() > x.ends_at then 'missed' else 'open' end),
      t.deadline_at,
      case when public.lexa_exam_results_open(x.id) then t.score end,
      x.max_score, public.lexa_exam_results_open(x.id), now()
    from public.lexa_org_students st
    join public.lexa_org_enrollments en on en.student_id = st.id and en.status <> 'dropped'
    join public.lexa_org_exams x on x.class_id = en.class_id and x.status = 'published'
    join public.lexa_org_classes c on c.id = x.class_id
    join public.lexa_org_courses s on s.id = c.course_id
    join public.lexa_orgs g on g.id = x.org_id
    left join public.lexa_org_exam_attempts t on t.exam_id = x.id and t.student_id = st.id
    where st.user_id = auth.uid() and st.terms_accepted_at is not null
      and (t.id is not null or (en.status = 'enrolled' and st.status = 'active' and public.lexa_org_official(x.org_id)))
    order by x.starts_at desc;
end $$;

-- start or resume my attempt; questions without the answer key, in this attempt's order
create or replace function public.lexa_exam_start(e uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_x record;
  v_sid uuid;
  v_t record;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into v_x from public.lexa_org_exams x where x.id = e and x.status = 'published';
  if v_x.id is null then raise exception 'not_found'; end if;
  v_sid := public.lexa_exam_student(e);
  if v_sid is null then raise exception 'not_enrolled'; end if;
  perform public.lexa_exam_finalize_due(e);
  select * into v_t from public.lexa_org_exam_attempts t where t.exam_id = e and t.student_id = v_sid;
  if v_t.id is null then
    if now() < v_x.starts_at then raise exception 'exam_not_open'; end if;
    if now() >= v_x.ends_at then raise exception 'exam_closed'; end if;
    insert into public.lexa_org_exam_attempts (exam_id, org_id, student_id, user_id, deadline_at, qorder)
    values (e, v_x.org_id, v_sid, auth.uid(), least(v_x.ends_at, now() + make_interval(mins => v_x.duration_min)),
      coalesce((select jsonb_agg(q.id order by case when v_x.shuffle then random() else q.position end)
                from public.lexa_org_exam_questions q where q.exam_id = e), '[]'::jsonb))
    on conflict (exam_id, student_id) do nothing;
    select * into v_t from public.lexa_org_exam_attempts t where t.exam_id = e and t.student_id = v_sid;
    perform set_config('lexa.audit_ok', '1', true);
    perform public.lexa_audit(v_x.org_id, 'exam.start', e, jsonb_build_object('student', v_sid));
  end if;
  if v_t.status = 'submitted' then raise exception 'already_submitted'; end if;
  return jsonb_build_object(
    'attempt_id', v_t.id, 'title', v_x.title, 'instructions', v_x.instructions,
    'deadline_at', v_t.deadline_at, 'server_now', now(), 'max_score', v_x.max_score,
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'text', q.text, 'options', q.options,
                    'points', q.points) order by o.n)
                  from jsonb_array_elements_text(v_t.qorder) with ordinality as o(qid, n)
                  join public.lexa_org_exam_questions q on q.id = o.qid::uuid), '[]'::jsonb),
    'answers', coalesce((select jsonb_object_agg(ans.question_id, ans.choice)
                from public.lexa_org_exam_answers ans where ans.attempt_id = v_t.id), '{}'::jsonb));
end $$;

-- save one answer (pick null clears it); only before the deadline by the server clock
create or replace function public.lexa_exam_answer(a uuid, q uuid, pick int)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_t record;
  v_n int;
begin
  select * into v_t from public.lexa_org_exam_attempts t where t.id = a and t.user_id = auth.uid();
  if v_t.id is null then raise exception 'not_found'; end if;
  if v_t.status <> 'in_progress' or now() > v_t.deadline_at + interval '30 seconds' then return 'closed'; end if;
  if public.lexa_exam_student(v_t.exam_id) is null then return 'closed'; end if;
  select jsonb_array_length(qq.options) into v_n from public.lexa_org_exam_questions qq
    where qq.id = q and qq.exam_id = v_t.exam_id;
  if v_n is null then raise exception 'not_found'; end if;
  if pick is null then
    perform set_config('lexa.trusted', '1', true);
    delete from public.lexa_org_exam_answers where attempt_id = a and question_id = q;
    perform set_config('lexa.trusted', '', true);
    return 'ok';
  end if;
  if pick < 0 or pick >= v_n then raise exception 'bad_input'; end if;
  insert into public.lexa_org_exam_answers (attempt_id, question_id, choice)
  values (a, q, pick)
  on conflict (attempt_id, question_id) do update set choice = excluded.choice, answered_at = now();
  return 'ok';
end $$;

-- hand in; returns the score only when results are already open
create or replace function public.lexa_exam_submit(a uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_t record;
begin
  select * into v_t from public.lexa_org_exam_attempts t where t.id = a and t.user_id = auth.uid();
  if v_t.id is null then raise exception 'not_found'; end if;
  if v_t.status = 'in_progress' then
    perform public.lexa_exam_grade(a);
    perform set_config('lexa.audit_ok', '1', true);
    perform public.lexa_audit(v_t.org_id, 'exam.submit', v_t.exam_id, jsonb_build_object('student', v_t.student_id));
  end if;
  select * into v_t from public.lexa_org_exam_attempts t where t.id = a;
  return jsonb_build_object('status', v_t.status, 'submitted_at', v_t.submitted_at,
    'score', case when public.lexa_exam_results_open(v_t.exam_id) then v_t.score end);
end $$;

-- my result with the answer key, only once results are open
create or replace function public.lexa_exam_result(e uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_t record;
  v_x record;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into v_x from public.lexa_org_exams x where x.id = e;
  if v_x.id is null then raise exception 'not_found'; end if;
  perform public.lexa_exam_finalize_due(e);
  select * into v_t from public.lexa_org_exam_attempts t where t.exam_id = e and t.user_id = auth.uid();
  if v_t.id is null then raise exception 'not_found'; end if;
  if not public.lexa_exam_results_open(e) then
    return jsonb_build_object('open', false, 'status', v_t.status, 'ends_at', v_x.ends_at);
  end if;
  return jsonb_build_object('open', true, 'status', v_t.status, 'title', v_x.title, 'score', v_t.score,
    'max_score', v_x.max_score, 'raw_score', v_t.raw_score, 'raw_max', v_t.raw_max,
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'text', q.text, 'options', q.options,
        'correct', q.correct, 'points', q.points, 'explanation', q.explanation, 'choice', ans.choice)
        order by q.position)
      from public.lexa_org_exam_questions q
      left join public.lexa_org_exam_answers ans on ans.attempt_id = v_t.id and ans.question_id = q.id
      where q.exam_id = e), '[]'::jsonb));
end $$;

-- --- function grants (002 granted every function to anon; be explicit) ---
revoke execute on function public.lexa_results_delete_guard() from public, anon, authenticated;
revoke execute on function public.lexa_drop_class_links() from public, anon, authenticated;
revoke execute on function public.lexa_visibility_guard() from public, anon, authenticated;
revoke execute on function public.lexa_ratings_guard() from public, anon, authenticated;
revoke execute on function public.lexa_class_require_staff(uuid) from public, anon, authenticated;
revoke execute on function public.lexa_org_require_manager(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.lexa_org_find_student(uuid, text) from public, anon, authenticated;
revoke execute on function public.lexa_exam_grade(uuid) from public, anon, authenticated;
revoke execute on function public.lexa_exam_finalize_due(uuid) from public, anon, authenticated;
revoke execute on function public.lexa_exam_student(uuid) from public, anon, authenticated;

revoke execute on function public.lexa_org_term_save(uuid, uuid, text, date, date, text) from public, anon;
revoke execute on function public.lexa_org_course_save(uuid, uuid, text, text, numeric) from public, anon;
revoke execute on function public.lexa_org_class_save(uuid, uuid, uuid, uuid, text, uuid, text, text) from public, anon;
revoke execute on function public.lexa_org_class_delete(uuid) from public, anon;
revoke execute on function public.lexa_org_class_list(uuid) from public, anon;
revoke execute on function public.lexa_org_enroll(uuid, text[], boolean) from public, anon;
revoke execute on function public.lexa_class_students(uuid) from public, anon;
revoke execute on function public.lexa_grades_upsert(uuid, jsonb, text) from public, anon;
revoke execute on function public.lexa_grades_delete(uuid[]) from public, anon;
revoke execute on function public.lexa_class_grade_ids(uuid, text) from public, anon;
revoke execute on function public.lexa_prior_gpa_upsert(uuid, jsonb, text) from public, anon;
revoke execute on function public.lexa_my_classes() from public, anon;
revoke execute on function public.lexa_my_grades() from public, anon;
revoke execute on function public.lexa_class_content_set(uuid, text, uuid, boolean, boolean) from public, anon;
revoke execute on function public.lexa_class_content(uuid) from public, anon;
revoke execute on function public.lexa_exam_save(uuid, uuid, jsonb, jsonb) from public, anon;
revoke execute on function public.lexa_exam_editor(uuid) from public, anon;
revoke execute on function public.lexa_exam_delete(uuid) from public, anon;
revoke execute on function public.lexa_class_exams(uuid) from public, anon;
revoke execute on function public.lexa_exam_report(uuid) from public, anon;
revoke execute on function public.lexa_exam_release(uuid, text) from public, anon;
revoke execute on function public.lexa_my_exams() from public, anon;
revoke execute on function public.lexa_exam_start(uuid) from public, anon;
revoke execute on function public.lexa_exam_answer(uuid, uuid, integer) from public, anon;
revoke execute on function public.lexa_exam_submit(uuid) from public, anon;
revoke execute on function public.lexa_exam_result(uuid) from public, anon;

grant execute on function public.lexa_is_service() to anon, authenticated;
grant execute on function public.lexa_org_owner(uuid) to anon, authenticated;
grant execute on function public.lexa_class_teacher(uuid) to anon, authenticated;
grant execute on function public.lexa_class_learner(uuid) to anon, authenticated;
grant execute on function public.lexa_can_see_item(text, uuid, text, uuid, uuid) to anon, authenticated;
grant execute on function public.lexa_exam_results_open(uuid) to anon, authenticated;
grant execute on function public.lexa_rating_aggs(text, uuid[]) to anon, authenticated;
grant execute on function public.lexa_course_students(uuid[]) to anon, authenticated;

grant execute on function public.lexa_org_term_save(uuid, uuid, text, date, date, text) to authenticated;
grant execute on function public.lexa_org_course_save(uuid, uuid, text, text, numeric) to authenticated;
grant execute on function public.lexa_org_class_save(uuid, uuid, uuid, uuid, text, uuid, text, text) to authenticated;
grant execute on function public.lexa_org_class_delete(uuid) to authenticated;
grant execute on function public.lexa_org_class_list(uuid) to authenticated;
grant execute on function public.lexa_org_enroll(uuid, text[], boolean) to authenticated;
grant execute on function public.lexa_class_students(uuid) to authenticated;
grant execute on function public.lexa_grades_upsert(uuid, jsonb, text) to authenticated, service_role;
grant execute on function public.lexa_grades_delete(uuid[]) to authenticated;
grant execute on function public.lexa_class_grade_ids(uuid, text) to authenticated;
grant execute on function public.lexa_prior_gpa_upsert(uuid, jsonb, text) to authenticated, service_role;
grant execute on function public.lexa_my_classes() to authenticated;
grant execute on function public.lexa_my_grades() to authenticated;
grant execute on function public.lexa_class_content_set(uuid, text, uuid, boolean, boolean) to authenticated;
grant execute on function public.lexa_class_content(uuid) to authenticated;
grant execute on function public.lexa_exam_save(uuid, uuid, jsonb, jsonb) to authenticated;
grant execute on function public.lexa_exam_editor(uuid) to authenticated;
grant execute on function public.lexa_exam_delete(uuid) to authenticated;
grant execute on function public.lexa_class_exams(uuid) to authenticated;
grant execute on function public.lexa_exam_report(uuid) to authenticated;
grant execute on function public.lexa_exam_release(uuid, text) to authenticated;
grant execute on function public.lexa_my_exams() to authenticated;
grant execute on function public.lexa_exam_start(uuid) to authenticated;
grant execute on function public.lexa_exam_answer(uuid, uuid, integer) to authenticated;
grant execute on function public.lexa_exam_submit(uuid) to authenticated;
grant execute on function public.lexa_exam_result(uuid) to authenticated;

notify pgrst, 'reload schema';
