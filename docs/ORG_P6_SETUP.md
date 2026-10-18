# Lexa org system, phase 6: comparison report

Spec: `docs/ORG_LEARNING.md`, section «گزارش مقایسه (فاز ۶)».

## What it does
Final grades of a centre's official students against their study time in the same term.

- One point = one official student in one term. Grade = mean of the student's final grades (`component = 'final'`) in the chosen classes of that term, scaled to 20. Dropped enrolments and free users never count.
- Study time = active time from `lexa_study_daily` inside the term dates **and** inside the days the centre may see (official day to `left_at`). Basis `all` = all of Lexa, `org` = only the centre's own content.
- Students the centre could see for less than 80% of the term are left out (their earlier study time is hidden, so they would land in the wrong group). Terms without start/end dates give no report.
- Groups (configurable): «فعال‌نشده» under 1 h, «کم» 1 to 10 h, «زیاد» over 10 h.
- A group with fewer than 10 students is hidden: the server sends no points and no numbers for it.
- Shown: count, mean, median, SD, difference against the lowest shown group with a Welch 95% CI, a version controlled for prior GPA (`lexa_org_prior_gpa`, linear regression, groups with fewer than 10 students with a GPA are left out), Spearman's rho, a scatter plot, CSV of the numbers (never the points).
- Always on screen and in the CSV: «این مقایسه همبستگی است و به‌تنهایی اثر لکسا را ثابت نمی‌کند.»

## Files
- `supabase/011_comparison_report.sql`: `lexa_compare_build` (internal, granted to nobody), `lexa_compare_report(o, term, class_ids, cut_low, cut_high, basis)` (owner / manager / Lexa admin, two-factor; also the service key), `lexa_admin_compare_report(d_from, d_to, o, cut_low, cut_high, basis)` (Lexa admin, two-factor; terms that started in the range, all centres pooled or one), `lexa_compare_terms(o)` (term picker).
- `src/lib/compare-stats.ts`: pure statistics (mean, median, Welch CI, OLS with prior GPA, Spearman). No dependencies.
- `src/lib/cloud-api/compare.ts`: RPC calls, labels, CSV, error messages.
- `src/components/app/ComparisonReportPanel.tsx`: the panel (centre mode and admin mode).

## User steps
1. Run `supabase/011_comparison_report.sql` in the SQL editor after 007, 008, 009 and 010 (it checks 009 and 010 ran).
2. Nothing to deploy: no new Edge Function, no secret.

## Z wiring
1. **OrgView** (owner / manager / admin, needs a two-factor session like the dashboard): add a tab «گزارش مقایسه»:
   ```tsx
   import { ComparisonReportPanel } from "@/components/app/ComparisonReportPanel";
   <ComparisonReportPanel orgId={org.id} orgName={org.name} />
   ```
   Teachers do not get this tab.
2. **AdminView**: add a section «گزارش مقایسه» with
   ```tsx
   <ComparisonReportPanel admin orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} />
   ```
   (`orgs` = the list AdminView already loads; pass `[]` if there is none, then only the pooled report is offered.)
3. `npx tsc --noEmit`, QA with a test centre: one term with dates, at least 10 students per group with final grades, a few prior GPAs. Check that a group with 9 students shows «کمتر از ۱۰ نفر؛ نمایش داده نمی‌شود» and no dots.
4. Bump + release.

## Notes
- Correlation only: students who study more may differ in other ways. The prior-GPA version removes one of those differences, not all.
- A student in several classes of the term counts once (mean of the finals), so points are independent within a term.
