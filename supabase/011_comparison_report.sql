-- Lexa 011: comparison report (phase 6 of docs/ORG_LEARNING.md).
-- Run in the Supabase SQL editor after 006 to 010. Safe to re-run.
--
-- Final grades of official students against their study time in the same term:
--   * one point = one official student in one term; grade = mean of the student's final grades in the
--     chosen classes of that term, scaled to 20; dropped enrolments and free users never count
--   * study time = active time (lexa_study_daily) inside the term dates and inside the days the centre
--     may see (official day .. left_at); basis 'all' = all of Lexa, 'org' = only the centre's content
--   * students the centre could see for less than 80% of the term are left out (their study time
--     before becoming official is hidden, so they would land in the wrong group)
--   * groups: under cut_low hours, cut_low..cut_high, over cut_high (default 1 and 10)
--   * a group with fewer than 10 students is hidden: no points, no numbers
-- The app computes mean, median, differences with 95% CI and the prior-GPA-controlled model from the
-- returned points (src/lib/compare-stats.ts); points carry no names or ids.

do $$ begin
  if to_regclass('public.lexa_org_api_keys') is null or to_regclass('public.lexa_study_daily') is null then
    raise exception 'run 006, 007, 008, 009 and 010 first';
  end if;
end $$;

-- internal: builds the report; callers check access (granted to nobody)
create or replace function public.lexa_compare_build(o uuid, term uuid, class_ids uuid[], d_from date, d_to date,
                                                     cut_low numeric, cut_high numeric, basis text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Tehran')::date;
  v_min int := 10;
  v_out jsonb;
begin
  if cut_low is null or cut_high is null or cut_low <= 0 or cut_high <= cut_low or cut_high > 1000
     or coalesce(basis, '') not in ('all', 'org') then
    raise exception 'bad_input';
  end if;
  with cls as (
    select c.id, c.org_id, c.term_id, t.starts_on, least(t.ends_on, v_today) as ends_on
    from public.lexa_org_classes c
    join public.lexa_org_terms t on t.id = c.term_id
    where case when term is not null then c.term_id = term
               else t.starts_on between d_from and d_to and (o is null or c.org_id = o) end
      and (o is null or c.org_id = o)
      and (class_ids is null or c.id = any(class_ids))
  ), enr as (
    select cls.org_id, cls.term_id, cls.starts_on, cls.ends_on, e.student_id,
      avg(g.score / g.max_score * 20) as grade
    from cls
    join public.lexa_org_enrollments e on e.class_id = cls.id and e.status <> 'dropped'
    left join public.lexa_org_grades g on g.class_id = cls.id and g.student_id = e.student_id and g.component = 'final'
    group by cls.org_id, cls.term_id, cls.starts_on, cls.ends_on, e.student_id
  ), st as (
    select enr.*, s.user_id, (s.user_id is not null and s.terms_accepted_at is not null) as official,
      greatest(enr.starts_on, public.lexa_official_day(s)) as w0,
      least(enr.ends_on, coalesce(s.left_at, enr.ends_on)) as w1
    from enr join public.lexa_org_students s on s.id = enr.student_id
  ), ok as (
    select st.*,
      case when st.starts_on is null or st.ends_on is null or st.ends_on < st.starts_on then null
           else greatest(0, st.w1 - st.w0 + 1)::numeric / (st.ends_on - st.starts_on + 1) end as coverage
    from st
  ), pts as (
    select ok.org_id, ok.student_id, round(ok.grade, 2) as g,
      round(coalesce((select sum(case when basis = 'org' then coalesce((d.by_org ->> ok.org_id::text)::int, 0)
                                       else d.seconds end)
                      from public.lexa_study_daily d
                      where d.user_id = ok.user_id and d.day between ok.w0 and ok.w1), 0) / 3600.0, 2) as h,
      (select p.gpa from public.lexa_org_prior_gpa p where p.org_id = ok.org_id and p.student_id = ok.student_id) as p
    from ok
    where ok.official and ok.grade is not null and ok.coverage >= 0.8
  ), grp as (
    select pts.*, case when pts.h < cut_low then 'none' when pts.h <= cut_high then 'low' else 'high' end as k
    from pts
  ), sizes as (
    select k, count(*)::int as n from grp group by k
  )
  select jsonb_build_object(
    'cuts', jsonb_build_array(cut_low, cut_high),
    'basis', basis,
    'min_group', v_min,
    'counts', jsonb_build_object(
      'enrolled', (select count(*) from enr),
      'no_account', (select count(*) from ok where not ok.official),
      'no_final', (select count(*) from ok where ok.official and ok.grade is null),
      'no_dates', (select count(*) from ok where ok.official and ok.grade is not null and ok.coverage is null),
      'partial', (select count(*) from ok where ok.official and ok.grade is not null and ok.coverage < 0.8),
      'with_prior', (select count(*) from grp join sizes using (k) where sizes.n >= v_min and grp.p is not null),
      'orgs', (select count(distinct grp.org_id) from grp join sizes using (k) where sizes.n >= v_min),
      'terms', (select count(distinct cls.term_id) from cls)),
    'groups', (select jsonb_agg(jsonb_build_object('k', x.k,
                  'n', case when coalesce(sizes.n, 0) >= v_min then sizes.n end,
                  'hidden', coalesce(sizes.n, 0) < v_min) order by x.ord)
               from (values ('none', 1), ('low', 2), ('high', 3)) as x(k, ord)
               left join sizes on sizes.k = x.k),
    'points', coalesce((select jsonb_agg(jsonb_build_object('h', grp.h, 'g', grp.g, 'p', grp.p, 'k', grp.k)
                                         order by grp.h, grp.g)
                        from grp join sizes using (k) where sizes.n >= v_min), '[]'::jsonb)
  ) into v_out;
  return v_out;
end $$;

-- a centre's report for one term (all classes or some of them): owner, manager or Lexa admin, two-factor
create or replace function public.lexa_compare_report(o uuid, term uuid, class_ids uuid[] default null,
                                                      cut_low numeric default 1, cut_high numeric default 10,
                                                      basis text default 'all')
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if public.lexa_is_admin() then
    if not public.lexa_mfa_ok() then raise exception 'mfa required'; end if;
  else
    perform public.lexa_org_require_manager(o, true);
  end if;
  if term is null or not exists (select 1 from public.lexa_org_terms t where t.id = term and t.org_id = o) then
    raise exception 'not_found';
  end if;
  if class_ids is not null and (cardinality(class_ids) = 0 or cardinality(class_ids) > 500) then
    raise exception 'bad_input';
  end if;
  return public.lexa_compare_build(o, term, class_ids, null, null, cut_low, cut_high, basis);
end $$;

-- Lexa admin: every centre's terms that started between d_from and d_to, pooled (o = null) or one centre
create or replace function public.lexa_admin_compare_report(d_from date, d_to date, o uuid default null,
                                                            cut_low numeric default 1, cut_high numeric default 10,
                                                            basis text default 'all')
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.lexa_is_admin() then raise exception 'admin only'; end if;
  if not public.lexa_mfa_ok() then raise exception 'mfa required'; end if;
  if d_from is null or d_to is null or d_to < d_from or d_to - d_from > 800 then raise exception 'bad_input'; end if;
  return public.lexa_compare_build(o, null, null, d_from, d_to, cut_low, cut_high, basis);
end $$;

-- terms a centre can build the report for, with a quick count (what the picker shows)
create or replace function public.lexa_compare_terms(o uuid)
returns table (term_id uuid, title text, starts_on date, ends_on date, status text, classes int, finals int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if public.lexa_is_admin() then
    if not public.lexa_mfa_ok() then raise exception 'mfa required'; end if;
  else
    perform public.lexa_org_require_manager(o, true);
  end if;
  return query
    select t.id, t.title, t.starts_on, t.ends_on, t.status,
      (select count(*)::int from public.lexa_org_classes c where c.term_id = t.id),
      (select count(*)::int from public.lexa_org_grades g join public.lexa_org_classes c on c.id = g.class_id
        where c.term_id = t.id and g.component = 'final')
    from public.lexa_org_terms t
    where t.org_id = o
    order by t.starts_on desc nulls last, t.created_at desc;
end $$;

revoke execute on function public.lexa_compare_build(uuid, uuid, uuid[], date, date, numeric, numeric, text)
  from public, anon, authenticated;
revoke execute on function public.lexa_compare_report(uuid, uuid, uuid[], numeric, numeric, text) from public, anon;
revoke execute on function public.lexa_admin_compare_report(date, date, uuid, numeric, numeric, text) from public, anon;
revoke execute on function public.lexa_compare_terms(uuid) from public, anon;

grant execute on function public.lexa_compare_report(uuid, uuid, uuid[], numeric, numeric, text) to authenticated, service_role;
grant execute on function public.lexa_admin_compare_report(date, date, uuid, numeric, numeric, text) to authenticated;
grant execute on function public.lexa_compare_terms(uuid) to authenticated, service_role;
