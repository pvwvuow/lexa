"use client";
/* Comparison report (phase 6, supabase/011_comparison_report.sql): final grades of official students
 * against their study time in the same term. The server returns anonymous points of groups with at
 * least 10 students; the numbers are computed in src/lib/compare-stats.ts. */
import { HttpError, sbRpc } from "./rest";
import { toCsv } from "./org-accounts";
import {
  controlled, differences, groupStats, spearman,
  type Controlled, type Correlation, type Diff, type GroupKey, type GroupStats, type Point,
} from "@/lib/compare-stats";

export const COMPARE_DISCLAIMER = "این مقایسه همبستگی است و به‌تنهایی اثر لکسا را ثابت نمی‌کند.";

export type CompareBasis = "all" | "org";
export interface CompareOptions { cutLow: number; cutHigh: number; basis: CompareBasis }
export const DEFAULT_COMPARE: CompareOptions = { cutLow: 1, cutHigh: 10, basis: "all" };

export interface CompareCounts {
  enrolled: number;
  noAccount: number;
  noFinal: number;
  noDates: number;
  partial: number;
  withPrior: number;
  orgs: number;
  terms: number;
}
export interface CompareResult {
  cuts: [number, number];
  basis: CompareBasis;
  minGroup: number;
  counts: CompareCounts;
  groups: { k: GroupKey; n: number | null; hidden: boolean }[];
  points: Point[];
  stats: GroupStats[];
  diffs: Diff[];
  controlled: Controlled | null;
  correlation: Correlation | null;
}

export interface CompareTerm { id: string; title: string; startsOn: string | null; endsOn: string | null; status: string; classes: number; finals: number }

/* eslint-disable @typescript-eslint/no-explicit-any */
const n0 = (v: unknown) => Number(v) || 0;

function parse(r: any): CompareResult {
  const points: Point[] = ((r?.points ?? []) as any[]).map((p) => ({
    h: n0(p.h), g: n0(p.g), p: p.p === null || p.p === undefined ? null : Number(p.p), k: p.k as GroupKey,
  }));
  const c = r?.counts ?? {};
  const minGroup = n0(r?.min_group) || 10;
  return {
    cuts: [n0(r?.cuts?.[0]), n0(r?.cuts?.[1])],
    basis: r?.basis === "org" ? "org" : "all",
    minGroup,
    counts: {
      enrolled: n0(c.enrolled), noAccount: n0(c.no_account), noFinal: n0(c.no_final), noDates: n0(c.no_dates),
      partial: n0(c.partial), withPrior: n0(c.with_prior), orgs: n0(c.orgs), terms: n0(c.terms),
    },
    groups: ((r?.groups ?? []) as any[]).map((g) => ({ k: g.k as GroupKey, n: g.n === null || g.n === undefined ? null : n0(g.n), hidden: !!g.hidden })),
    points,
    stats: groupStats(points),
    diffs: differences(points),
    controlled: controlled(points, minGroup),
    correlation: spearman(points),
  };
}

export async function compareTerms(orgId: string): Promise<CompareTerm[]> {
  const rows = await sbRpc<any[]>("lexa_compare_terms", { o: orgId });
  return (rows ?? []).map((r) => ({
    id: r.term_id, title: r.title ?? "", startsOn: r.starts_on ?? null, endsOn: r.ends_on ?? null, status: r.status ?? "",
    classes: n0(r.classes), finals: n0(r.finals),
  }));
}

export async function compareReport(orgId: string, termId: string, classIds: string[] | null, opt: CompareOptions): Promise<CompareResult> {
  const r = await sbRpc<any>("lexa_compare_report", {
    o: orgId, term: termId, class_ids: classIds && classIds.length ? classIds : null,
    cut_low: opt.cutLow, cut_high: opt.cutHigh, basis: opt.basis,
  });
  return parse(r);
}

export async function adminCompareReport(from: string, to: string, orgId: string | null, opt: CompareOptions): Promise<CompareResult> {
  const r = await sbRpc<any>("lexa_admin_compare_report", {
    d_from: from, d_to: to, o: orgId, cut_low: opt.cutLow, cut_high: opt.cutHigh, basis: opt.basis,
  });
  return parse(r);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function groupLabel(k: GroupKey, cuts: [number, number]): string {
  const f = (n: number) => n.toLocaleString("fa-IR", { maximumFractionDigits: 1 });
  if (k === "none") return `فعال‌نشده (کمتر از ${f(cuts[0])} ساعت)`;
  if (k === "low") return `کم (${f(cuts[0])} تا ${f(cuts[1])} ساعت)`;
  return `زیاد (بیش از ${f(cuts[1])} ساعت)`;
}
export const GROUP_SHORT: Record<GroupKey, string> = { none: "فعال‌نشده", low: "کم", high: "زیاد" };
export const GROUP_COLORS: Record<GroupKey, string> = { none: "#94a3b8", low: "#f59e0b", high: "#10b981" };

/** checks the settings form; returns an error message or "" */
export function checkOptions(o: CompareOptions): string {
  if (!(o.cutLow > 0)) return "مرز گروه کم باید بیشتر از صفر باشد.";
  if (!(o.cutHigh > o.cutLow)) return "مرز گروه زیاد باید بیشتر از مرز گروه کم باشد.";
  if (o.cutHigh > 1000) return "مرز گروه زیاد حداکثر ۱۰۰۰ ساعت است.";
  return "";
}

const r2 = (n: number) => (isFinite(n) ? Math.round(n * 100) / 100 : "");

/** the numbers (never the points) as CSV, with the settings and the disclaimer */
export function compareCsv(title: string, res: CompareResult): { name: string; text: string } {
  const rows: unknown[][] = [
    ["گزارش مقایسه", title],
    [COMPARE_DISCLAIMER],
    ["مبنای زمان مطالعه", res.basis === "org" ? "فقط محتوای مرکز" : "همهٔ Lexa"],
    [],
    ["گروه", "تعداد", "میانگین", "میانه", "انحراف معیار", "اختلاف با گروه پایه", "حد پایین ۹۵٪", "حد بالای ۹۵٪"],
  ];
  for (const g of res.groups) {
    const s = res.stats.find((x) => x.k === g.k);
    const d = res.diffs.find((x) => x.k === g.k);
    if (g.hidden || !s) rows.push([groupLabel(g.k, res.cuts), `کمتر از ${res.minGroup} نفر؛ نمایش داده نمی‌شود`]);
    else rows.push([groupLabel(g.k, res.cuts), s.n, r2(s.mean), r2(s.median), r2(s.sd), d ? r2(d.diff) : "", d ? r2(d.low) : "", d ? r2(d.high) : ""]);
  }
  if (res.controlled) {
    rows.push([], ["کنترل‌شده با معدل قبلی", `${res.controlled.n} نفر`]);
    for (const d of res.controlled.diffs) rows.push([groupLabel(d.k, res.cuts), "", "", "", "", r2(d.diff), r2(d.low), r2(d.high)]);
    rows.push(["ضریب معدل قبلی", "", "", "", "", r2(res.controlled.gpaSlope), r2(res.controlled.gpaLow), r2(res.controlled.gpaHigh)]);
  }
  if (res.correlation) rows.push([], ["همبستگی رتبه‌ای (اسپیرمن)", res.correlation.n, r2(res.correlation.rho), "", "", "", r2(res.correlation.low), r2(res.correlation.high)]);
  const safe = title.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 60);
  return { name: `lexa-compare-${safe}.csv`, text: toCsv(rows) };
}

const ERRORS: [RegExp, string][] = [
  [/mfa required/, "برای دیدن گزارش مقایسه باید ورود دومرحله‌ای را تأیید کنید."],
  [/not a manager/, "گزارش مقایسه فقط برای مالک و مدیران پنل مرکز است."],
  [/admin only/, "این گزارش فقط برای مدیر Lexa است."],
  [/not_found/, "ترم پیدا نشد."],
  [/bad_input/, "تنظیمات گزارش نامعتبر است."],
  [/not signed in/, "ابتدا وارد حساب کاربری خود شوید."],
];
export function compareError(e: unknown): string {
  const raw = e instanceof HttpError ? `${e.message} ${e.code}` : e instanceof Error ? e.message : String(e ?? "");
  for (const [re, msg] of ERRORS) if (re.test(raw)) return msg;
  if (e instanceof TypeError) return "اتصال به Lexa برقرار نشد؛ اتصال اینترنت را بررسی کنید.";
  return "گزارش ساخته نشد. لطفاً دوباره تلاش کنید.";
}
