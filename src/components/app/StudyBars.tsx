"use client";
/* Small dependency-free bar chart of study time per day (phase 4). */
import { dayRange, faDay, fmtDuration } from "@/lib/cloud-api/study";

export function StudyBars({ from, to, data, height = 96 }: {
  from: string;
  to: string;
  data: { day: string; seconds: number; users?: number }[];
  height?: number;
}) {
  const days = dayRange(from, to);
  const by = new Map(data.map((d) => [d.day, d]));
  const max = Math.max(60, ...data.map((d) => d.seconds));
  return (
    <div className="space-y-1" dir="ltr">
      <div className="flex items-end gap-[2px]" style={{ height }}>
        {days.map((d) => {
          const v = by.get(d);
          const s = v?.seconds ?? 0;
          const title = `${faDay(d)}: ${fmtDuration(s)}${v?.users !== undefined ? ` · ${v.users.toLocaleString("fa-IR")} نفر` : ""}`;
          return (
            <div key={d} title={title} className="flex-1 rounded-t bg-bronze/80"
              style={{ height: `${Math.max(s ? 3 : 1, (s / max) * 100)}%`, opacity: s ? 1 : 0.15 }} />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground" dir="rtl">
        <span>{faDay(from)}</span>
        <span>{faDay(to)}</span>
      </div>
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <span className="block text-[11px] text-muted-foreground">{label}</span>
      <span className="block text-lg font-bold">{value}</span>
      {hint && <span className="block text-[10px] text-muted-foreground">{hint}</span>}
    </div>
  );
}
