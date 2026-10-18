-- Lexa 011: the comparison report (phase 6 of docs/ORG_LEARNING.md). Run after 010.
-- Safe to re-run.
--
-- For one class of one term of one centre: final grades of its enrolled students versus
-- their study time inside the term window, WITHOUT free users and WITHOUT identities:
--   * three groups by study hours (thresholds adjustable): inactive < p_inactive,
--     low p_inactive..p_low inclusive, high > p_low
--   * per group: count, mean, median — a group under 10 students is NEVER shown
--   * difference of means high vs the rest with a 95 % confidence interval
--     (normal approximation, valid at n >= 10 per side)
--   * the controlled version: partial correlation of study hours and final grade
--     controlling the prior GPA (lexa_org_prior_gpa of phase 3), shown only with
--     10+ students that have both numbers
--   * scatter points (study hours, final grade, group key) — only from shown groups
-- The client must always print: «این مقایسه همبستگی است و به‌تنهایی اثر لکسا را ثابت
-- نمی‌کند.» — no inference about Lexa's effect may be drawn from this report alone.
create or replace function public.lexa_compare_report(o uuid, p_class uuid, p_term uuid,
  p_inactive numeric default 1, p_low numeric default 10)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_window record;
  v_rows record;
  v_gr record;
  v_out jsonb;
  v_groups jsonb := '[]'::jsonb;
  g record;
  v_high_n int; v_rest_n int;
  v_high_mean numeric; v_rest_mean numeric;
  v_high_sd numeric; v_rest_sd numeric;
  v_se numeric; v_diff numeric;
  v_rhf numeric; v_rhg numeric; v_rfg numeric; v_partial numeric; v_ctrl_n int;
  v_scatter jsonb := '[]'::jsonb;
begin
  perform public.lexa_org_require_manager(o, true);
  if p_inactive is null or p_inactive < 0.1 or p_inactive > 24
     or p_low is null or p_low < 0.5 or p_low > 40 or p_low <= p_inactive then
    raise exception 'bad_input';
  end if;
  if not exists (select 1 from public.lexa_org_classes c
                 where c.id = p_class and c.org_id = o and c.term_id = p_term) then
    raise exception 'not_found';
  end if;
  select t.starts_on, t.ends_on, t.created_at into v_window
    from public.lexa_org_terms t where t.id = p_term and t.org_id = o;
  if not found then raise exception 'not_found'; end if;

  -- every enrolled student of the class with their term study hours, final grade, prior gpa
  create temp table cmp_rows on commit drop as
  select st.id as student_id, st.user_id,
         coalesce((select sum(t.seconds) from public.lexa_study_sessions t
                    where t.user_id = st.user_id and t.org_id = o
                      and t.day >= coalesce(v_window.starts_on, (v_window.created_at at time zone 'Asia/Tehran')::date)
                      and t.day <= coalesce(v_window.ends_on, public.lexa_study_day())), 0) / 3600.0 as hours,
         (select g.score from public.lexa_org_grades g
           where g.class_id = p_class and g.student_id = st.id and g.component = 'final'
           order by g.updated_at desc limit 1) as final,
         (select p.gpa from public.lexa_org_prior_gpa p
           where p.org_id = o and p.student_id = st.id limit 1) as prior
  from public.lexa_org_enrollments e
  join public.lexa_org_students st on st.id = e.student_id
  where e.class_id = p_class and e.org_id = o and e.status in ('enrolled', 'completed');

  select count(*)::int as n, count(final)::int as with_final into v_gr from cmp_rows;

  v_groups := '[]'::jsonb;
  for g in
    select key, count(*)::int as n, avg(final) as mean, percentile_cont(0.5) within group (order by final) as median
    from (select case when hours < p_inactive then 'inactive'
                      when hours <= p_low then 'low'
                      else 'high' end as key, hours, final
          from cmp_rows) x
    group by key
  loop
    v_groups := v_groups || jsonb_build_object(
      'key', g.key, 'n', g.n, 'shown', g.n >= 10,
      'mean', case when g.n >= 10 and g.mean is not null then round(g.mean::numeric, 2) end,
      'median', case when g.n >= 10 and g.median is not null then round(g.median::numeric, 2) end);
  end loop;

  -- difference of means: high vs the rest, 95 % CI by normal approximation
  select count(*) filter (where k = 'high'), avg(final) filter (where k = 'high'),
         stddev_samp(final) filter (where k = 'high'),
         count(*) filter (where k <> 'high'), avg(final) filter (where k <> 'high'),
         stddev_samp(final) filter (where k <> 'high')
    into v_high_n, v_high_mean, v_high_sd, v_rest_n, v_rest_mean, v_rest_sd
  from (select case when hours < p_inactive then 'inactive' when hours <= p_low then 'low' else 'high' end as k, final
        from cmp_rows where final is not null) y;

  v_out := jsonb_build_object(
    'n', v_gr.n, 'with_final', v_gr.with_final,
    'window', jsonb_build_object(
      'from', coalesce(v_window.starts_on, (v_window.created_at at time zone 'Asia/Tehran')::date),
      'to', coalesce(v_window.ends_on, public.lexa_study_day())),
    'groups', v_groups,
    'thresholds', jsonb_build_object('inactive', p_inactive, 'low', p_low));

  v_diff := null;
  if v_high_n >= 10 and v_rest_n >= 10 and v_high_sd is not null and v_rest_sd is not null then
    v_diff := v_high_mean - v_rest_mean;
    v_se := sqrt(nullif(v_high_sd * v_high_sd / v_high_n + v_rest_sd * v_rest_sd / v_rest_n, 0));
  end if;
  v_out := v_out || jsonb_build_object('diff', jsonb_build_object(
    'shown', v_diff is not null,
    'high_n', v_high_n, 'rest_n', v_rest_n,
    'high_mean', case when v_high_n >= 10 and v_high_mean is not null then round(v_high_mean, 2) end,
    'rest_mean', case when v_rest_n >= 10 and v_rest_mean is not null then round(v_rest_mean, 2) end,
    'diff', case when v_diff is not null then round(v_diff, 2) end,
    'lo', case when v_diff is not null and v_se is not null then round(v_diff - 1.96 * v_se, 2) end,
    'hi', case when v_diff is not null and v_se is not null then round(v_diff + 1.96 * v_se, 2) end));

  -- controlled by prior GPA: partial correlation of hours and final
  select count(*)::int, corr(hours, final), corr(hours, prior), corr(prior, final)
    into v_ctrl_n, v_rhf, v_rhg, v_rfg
  from cmp_rows where final is not null and prior is not null;
  v_partial := null;
  if v_ctrl_n >= 10 and v_rhf is not null and v_rhg is not null and v_rfg is not null
     and (1 - v_rhg * v_rhg) > 0 and (1 - v_rfg * v_rfg) > 0 then
    v_partial := (v_rhf - v_rhg * v_rfg) / sqrt((1 - v_rhg * v_rhg) * (1 - v_rfg * v_rfg));
  end if;
  v_out := v_out || jsonb_build_object('control', jsonb_build_object(
    'shown', v_partial is not null, 'n', v_ctrl_n,
    'r_raw', case when v_rhf is not null then round(v_rhf::numeric, 2) end,
    'r_partial', case when v_partial is not null then round(v_partial::numeric, 2) end));

  -- scatter points only from groups with at least 10 students (no identities)
  select coalesce(jsonb_agg(jsonb_build_object('h', round(hours::numeric, 2), 'g', final, 'k', k)), '[]'::jsonb)
    into v_scatter
  from (select hours, final,
               case when hours < p_inactive then 'inactive' when hours <= p_low then 'low' else 'high' end as k,
               count(*) over (partition by case when hours < p_inactive then 'inactive' when hours <= p_low then 'low' else 'high' end) as gn
        from cmp_rows where final is not null) z
  where gn >= 10;
  v_out := v_out || jsonb_build_object('scatter', v_scatter, 'disclaimer', true);

  return v_out;
end $$;
