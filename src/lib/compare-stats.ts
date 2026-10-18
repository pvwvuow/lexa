/* Statistics for the comparison report (phase 6, supabase/011_comparison_report.sql).
 * Pure functions, no dependencies: group summaries, Welch differences with 95% CI, an ordinary
 * least squares model controlled for prior GPA, and Spearman's rank correlation. */

export type GroupKey = "none" | "low" | "high";
export const GROUP_KEYS: GroupKey[] = ["none", "low", "high"];

export interface Point { h: number; g: number; p: number | null; k: GroupKey }

export interface GroupStats { k: GroupKey; n: number; mean: number; median: number; sd: number; min: number; max: number }
export interface Diff { k: GroupKey; base: GroupKey; diff: number; low: number; high: number; df: number }
export interface Controlled {
  n: number;
  groups: GroupKey[];
  base: GroupKey;
  diffs: Diff[];
  gpaSlope: number;
  gpaLow: number;
  gpaHigh: number;
  adjustedMeans: { k: GroupKey; mean: number }[];
  dropped: GroupKey[];
}
export interface Correlation { n: number; rho: number; low: number; high: number }

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
export function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export function variance(xs: number[]): number {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return xs.reduce((a, x) => a + (x - m) * (x - m), 0) / (xs.length - 1);
}

/** two-sided 97.5% quantile of Student's t (Cornish-Fisher expansion; error < 0.002 for df >= 3) */
export function t975(df: number): number {
  const z = 1.959963984540054;
  if (!isFinite(df) || df > 1e6) return z;
  const d = Math.max(df, 1);
  const z2 = z * z;
  const g1 = (z2 + 1) * z / 4;
  const g2 = ((5 * z2 + 16) * z2 + 3) * z / 96;
  const g3 = (((3 * z2 + 19) * z2 + 17) * z2 - 15) * z / 384;
  const g4 = ((((79 * z2 + 776) * z2 + 1482) * z2 - 1920) * z2 - 945) * z / 92160;
  return z + g1 / d + g2 / (d * d) + g3 / (d * d * d) + g4 / (d * d * d * d);
}

export function groupStats(points: Point[]): GroupStats[] {
  const out: GroupStats[] = [];
  for (const k of GROUP_KEYS) {
    const g = points.filter((p) => p.k === k).map((p) => p.g);
    if (!g.length) continue;
    out.push({ k, n: g.length, mean: mean(g), median: median(g), sd: Math.sqrt(variance(g)) || 0, min: Math.min(...g), max: Math.max(...g) });
  }
  return out;
}

/** Welch's difference of means (k minus base) with a 95% confidence interval */
export function welch(a: number[], b: number[]): { diff: number; low: number; high: number; df: number } | null {
  if (a.length < 2 || b.length < 2) return null;
  const va = variance(a) / a.length;
  const vb = variance(b) / b.length;
  const diff = mean(a) - mean(b);
  const se = Math.sqrt(va + vb);
  if (!(se > 0)) return { diff, low: diff, high: diff, df: a.length + b.length - 2 };
  const df = (va + vb) ** 2 / (va * va / (a.length - 1) + vb * vb / (b.length - 1));
  const t = t975(df);
  return { diff, low: diff - t * se, high: diff + t * se, df };
}

/** every shown group against the lowest shown group ("none" when it is shown) */
export function differences(points: Point[]): Diff[] {
  const keys = GROUP_KEYS.filter((k) => points.some((p) => p.k === k));
  if (keys.length < 2) return [];
  const base = keys[0];
  const bg = points.filter((p) => p.k === base).map((p) => p.g);
  const out: Diff[] = [];
  for (const k of keys.slice(1)) {
    const w = welch(points.filter((p) => p.k === k).map((p) => p.g), bg);
    if (w) out.push({ k, base, ...w });
  }
  return out;
}

/** solves (X'X) b = X'y; returns b and (X'X)^-1, or null when singular */
function ols(X: number[][], y: number[]): { b: number[]; inv: number[][]; sse: number } | null {
  const p = X[0]?.length ?? 0;
  if (!p || X.length <= p) return null;
  const a: number[][] = Array.from({ length: p }, (_, i) => {
    const row = new Array<number>(2 * p).fill(0);
    for (const x of X) for (let j = 0; j < p; j++) row[j] += x[i] * x[j];
    row[p + i] = 1;
    return row;
  });
  for (let c = 0; c < p; c++) {
    let piv = c;
    for (let r = c + 1; r < p; r++) if (Math.abs(a[r][c]) > Math.abs(a[piv][c])) piv = r;
    if (Math.abs(a[piv][c]) < 1e-10) return null;
    [a[c], a[piv]] = [a[piv], a[c]];
    const d = a[c][c];
    for (let j = 0; j < 2 * p; j++) a[c][j] /= d;
    for (let r = 0; r < p; r++) {
      if (r === c) continue;
      const f = a[r][c];
      if (f) for (let j = 0; j < 2 * p; j++) a[r][j] -= f * a[c][j];
    }
  }
  const inv = a.map((row) => row.slice(p));
  const xty = new Array<number>(p).fill(0);
  X.forEach((x, n) => { for (let j = 0; j < p; j++) xty[j] += x[j] * y[n]; });
  const b = inv.map((row) => row.reduce((s, v, j) => s + v * xty[j], 0));
  const sse = X.reduce((s, x, n) => { const e = y[n] - x.reduce((t, v, j) => t + v * b[j], 0); return s + e * e; }, 0);
  return { b, inv, sse };
}

/** grade = b0 + group dummies + b * prior GPA, on students with a prior GPA. Groups with fewer than
 * minGroup such students are left out (listed in dropped). Null when fewer than two groups remain. */
export function controlled(points: Point[], minGroup = 10): Controlled | null {
  const withP = points.filter((p): p is Point & { p: number } => p.p !== null && isFinite(p.p));
  const shown = GROUP_KEYS.filter((k) => points.some((p) => p.k === k));
  const groups = shown.filter((k) => withP.filter((p) => p.k === k).length >= minGroup);
  const dropped = shown.filter((k) => !groups.includes(k));
  if (groups.length < 2) return null;
  const rows = withP.filter((p) => groups.includes(p.k));
  const base = groups[0];
  const others = groups.slice(1);
  const X = rows.map((r) => [1, ...others.map((k) => (r.k === k ? 1 : 0)), r.p]);
  const fit = ols(X, rows.map((r) => r.g));
  if (!fit) return null;
  const df = rows.length - X[0].length;
  const s2 = fit.sse / df;
  const t = t975(df);
  const se = (j: number) => Math.sqrt(Math.max(0, s2 * fit.inv[j][j]));
  const slopeJ = X[0].length - 1;
  const gpaMean = mean(rows.map((r) => r.p));
  const diffs: Diff[] = others.map((k, i) => {
    const b = fit.b[i + 1];
    return { k, base, diff: b, low: b - t * se(i + 1), high: b + t * se(i + 1), df };
  });
  const adjustedMeans = groups.map((k, i) => ({ k, mean: fit.b[0] + (i ? fit.b[i] : 0) + fit.b[slopeJ] * gpaMean }));
  return {
    n: rows.length, groups, base, diffs, adjustedMeans, dropped,
    gpaSlope: fit.b[slopeJ], gpaLow: fit.b[slopeJ] - t * se(slopeJ), gpaHigh: fit.b[slopeJ] + t * se(slopeJ),
  };
}

function ranks(xs: number[]): number[] {
  const idx = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(xs.length);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    for (let m = i; m <= j; m++) r[idx[m][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}

/** Spearman's rho between study hours and grade, 95% CI by Fisher's z (Fieller's 1.06 factor) */
export function spearman(points: Point[]): Correlation | null {
  const n = points.length;
  if (n < 10) return null;
  const rh = ranks(points.map((p) => p.h));
  const rg = ranks(points.map((p) => p.g));
  const mh = mean(rh);
  const mg = mean(rg);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (rh[i] - mh) * (rg[i] - mg);
    sxx += (rh[i] - mh) ** 2;
    syy += (rg[i] - mg) ** 2;
  }
  if (!(sxx > 0 && syy > 0)) return null;
  const rho = sxy / Math.sqrt(sxx * syy);
  const z = Math.atanh(Math.max(-0.999999, Math.min(0.999999, rho)));
  const se = 1.06 / Math.sqrt(n - 3);
  return { n, rho, low: Math.tanh(z - 1.959963984540054 * se), high: Math.tanh(z + 1.959963984540054 * se) };
}
