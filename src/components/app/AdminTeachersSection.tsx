"use client";

// ─── پنل مدیریت: ایجاد حساب استاد + فهرست اساتید با آمار ──────────────────────
import * as React from "react";
import {
  GraduationCap, UserPlus, Loader2, Newspaper, BookOpen, Users, ShieldCheck,
} from "lucide-react";
import { fa } from "@/lib/fa";

interface TeacherRow {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  posts: number;
  courses: number;
  followers: number;
}

const inputCls =
  "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-bronze placeholder:text-muted-foreground/50";
const labelCls = "mb-1 block text-[11.5px] font-bold text-muted-foreground";

export function AdminTeachersSection() {
  const [rows, setRows] = React.useState<TeacherRow[] | null>(null);
  const [form, setForm] = React.useState({ username: "", password: "", displayName: "" });
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/teachers");
      const j = await res.json();
      if (res.ok) setRows(j.teachers ?? []);
    } catch {}
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function createTeacher(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "ایجاد ناموفق بود.");
      setMsg({
        ok: true,
        text: `حساب استاد ساخته شد → نام کاربری «${j.teacher.username}» با رمزی که وارد کردی؛ نتیجه را به استاد اعلام کن.`,
      });
      setForm({ username: "", password: "", displayName: "" });
      void load();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "خطایی رخ داد." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <GraduationCap className="h-5 w-5 text-bronze" /> اساتید سامانه
        </h2>
        <span className="text-[11px] text-muted-foreground">استاد می‌تواند مطلب منتشر کند، دوره بسازد و دانشجوها او را دنبال کنند</span>
      </div>

      {/* فرم ساخت حساب استاد */}
      <form onSubmit={createTeacher} className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <p className="mb-3 flex items-center gap-2 text-sm font-bold"><UserPlus className="h-4 w-4 text-bronze" /> ایجاد حساب استاد جدید</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={labelCls}>نام کاربری *</label>
            <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="مثلاً ostad_mohammadi" dir="ltr" className={`${inputCls} text-start`} />
          </div>
          <div>
            <label className={labelCls}>رمز عبور * (دست‌کم ۶ نویسه)</label>
            <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="— به استاد بدهید" dir="ltr" className={`${inputCls} text-start`} />
          </div>
          <div>
            <label className={labelCls}>نام نمایشی (اختیاری)</label>
            <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="دکتر محمدی" className={inputCls} />
          </div>
        </div>
        {msg && (
          <p className={`mt-3 rounded-lg px-3 py-2 text-xs ${msg.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
            {msg.text}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !form.username.trim() || !form.password.trim()}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-card transition-all hover:brightness-110 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          ساخت حساب استاد
        </button>
      </form>

      {/* فهرست اساتید */}
      {rows == null ? (
        <p className="flex items-center gap-2 py-4 text-sm text-bronze"><Loader2 className="h-4 w-4 animate-spin" /> در حال دریافت…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-6 text-center text-sm text-muted-foreground shadow-card">
          هنوز حساب استادی نساخته‌اید.
        </p>
      ) : (
        <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((t) => (
            <li key={t.id} className="rounded-2xl border border-border bg-card p-4 shadow-card transition-colors hover:border-bronze/50">
              <div className="mb-2.5 flex items-center gap-3">
                <span aria-hidden className="grid h-10 w-10 shrink-0 rotate-45 place-items-center rounded-[10px] bg-gradient-to-bl from-primary to-bronze shadow-card">
                  <ShieldCheck className="-rotate-45 h-4.5 w-4.5 text-primary-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-bold">{t.displayName || t.username}</p>
                  <p className="truncate text-[10.5px] text-muted-foreground" dir="ltr">@{t.username}</p>
                </div>
              </div>
              <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Users className="h-3 w-3 text-bronze" />{fa(t.followers)}</span>
                <span className="inline-flex items-center gap-1"><Newspaper className="h-3 w-3 text-bronze" />{fa(t.posts)}</span>
                <span className="inline-flex items-center gap-1"><BookOpen className="h-3 w-3 text-bronze" />{fa(t.courses)}</span>
                {t.lastSeenAt && (
                  <span>· آخرین حضور {new Date(t.lastSeenAt).toLocaleDateString("fa-IR", { month: "long", day: "numeric" })}</span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
