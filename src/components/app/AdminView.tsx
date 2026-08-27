"use client";

import * as React from "react";
import {
  Users, Activity, ClipboardCheck, Award, BookOpenCheck, Search, ShieldCheck,
  Loader2, CloudCheck, ChevronDown, StickyNote, KeyRound, UserRound, Lock,
} from "lucide-react";
import { useAuth } from "@/lib/auth-client";
import { fa, pct } from "@/lib/fa";
import { ProgressBar, StatChip } from "./common";
import { AdminFeedbackSection } from "./AdminFeedbackSection";

// ─── انواع داده ───────────────────────────────────────────────────────────────
interface AdminUser {
  id: string;
  username: string;
  role: "user" | "admin";
  createdAt: string;
  lastSeenAt: string | null;
  onlineNow: boolean;
  activeToday: boolean;
  stats: {
    started: number;
    completed: number;
    quizzes: number;
    avgBest: number | null;
    activityDays: number;
    notesCount: number;
  };
}

interface DetailData {
  user: { id: string; username: string; role: string; createdAt: string; lastSeenAt: string | null };
  lessonStates: {
    lessonId: string; status: string; sectionsSeen: number;
    quizBest: number | null; markedReview: boolean; updatedAt: string;
  }[];
  quizAttempts: { id: string; lessonId: string; date: string; score: number; createdAt: string }[];
  activityDays: string[];
  notes: { id: string; lessonId: string; text: string; createdAt: number }[];
  customCoursesCount: number;
  customCoursesTitles: string[];
}

const faDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" })
    : "—";
const faDateTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("fa-IR", {
        year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "هیچ‌گاه";

/** عنوان جلسه از شناسه (برای نمایش خوانا) */
function prettyLesson(id: string): string {
  const m = id.match(/^(m|t|md7)-l(\d+)-(\d+)$/);
  if (!m) return id;
  const book = m[1] === "t" ? "تجارت ۳" : m[1] === "md7" ? "مدنی ۷" : `مدنی ${m[1] === "m" ? "" : ""}${m[2]}`;
  return `${book} — جلسهٔ ${fa(m[3])} فصل ${fa(m[2])}`;
}

function scoreColor(s: number) {
  return s >= 80 ? "text-success" : s >= 60 ? "text-bronze" : "text-destructive";
}

// ─── کارت آماری کوچک ──────────────────────────────────────────────────────────
function MiniStat({
  icon: Icon, label, value, sub,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-card">
      <span aria-hidden className="grid h-10 w-10 place-items-center rounded-xl border border-bronze/30 bg-bronze/10">
        <Icon className="h-5 w-5 text-bronze" />
      </span>
      <p className="mt-3 font-display text-2xl font-bold leading-none">{value}</p>
      <p className="mt-1.5 text-xs font-bold text-muted-foreground">{label}</p>
      {sub && <p className="mt-0.5 text-[10.5px] text-muted-foreground/70">{sub}</p>}
    </div>
  );
}

// ─── هیت‌استریپ فعالیت (۱۲ هفتهٔ اخیر) ────────────────────────────────────────
function HeatStrip({ days }: { days: string[] }) {
  const set = new Set(days);
  const cells = Array.from({ length: 84 }, (_, i) => {
    const d = new Date(Date.now() - (83 - i) * 86_400_000);
    const iso = d.toISOString().slice(0, 10);
    return set.has(iso);
  });
  return (
    <div className="flex flex-wrap gap-[3px]" dir="ltr" aria-label={`فعال در ${fa(set.size)} روز`}>
      {cells.map((hot, i) => (
        <span
          key={i}
          aria-hidden
          className={`h-2.5 w-2.5 rounded-[3px] ${hot ? "bg-bronze" : "bg-border/70"}`}
          style={hot ? { opacity: 0.65 + Math.min(0.35, set.size / 120) } : undefined}
        />
      ))}
    </div>
  );
}

// ─── ردیف کاربر در جدول ───────────────────────────────────────────────────────
function UserRow({ u, onOpen }: { u: AdminUser; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="group grid w-full grid-cols-12 items-center gap-2 rounded-xl border border-border/70 bg-card px-4 py-3 text-start shadow-card transition-all duration-150 hover:border-bronze/50 hover:shadow-md"
    >
      {/* کاربر */}
      <div className="col-span-6 flex min-w-0 items-center gap-3 sm:col-span-4">
        <span
          aria-hidden
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl font-display text-sm font-bold text-primary-foreground ${
            u.role === "admin" ? "bg-bronze" : "bg-gradient-to-bl from-primary to-bronze"
          }`}
        >
          {u.role === "admin" ? <ShieldCheck className="h-4.5 w-4.5" /> : u.username.slice(0, 1)}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <strong className="truncate font-display text-sm">{u.username}</strong>
            {u.onlineNow && (
              <span title="آنلاین (۱۰ دقیقهٔ اخیر)" className="h-2 w-2 shrink-0 rounded-full bg-success shadow-[0_0_6px_var(--success)]" />
            )}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            عضویت: {faDate(u.createdAt)} · آخرین فعالیت: {u.lastSeenAt ? faDateTime(u.lastSeenAt) : "هرگز"}
          </span>
        </span>
      </div>

      {/* تکمیل‌شده */}
      <div className="col-span-3 hidden sm:block">
        <p className="mb-1 flex items-baseline justify-between text-[11px] text-muted-foreground">
          <span>جلسات تکمیل‌شده</span>
          <strong className="font-display text-sm text-foreground">{fa(u.stats.completed)}</strong>
        </p>
        <ProgressBar value={pct(u.stats.completed, Math.max(56, u.stats.started))} />
      </div>

      {/* تست‌ها */}
      <div className="col-span-3 hidden items-center justify-end gap-5 text-center md:flex">
        <div>
          <p className="font-display text-lg font-bold leading-none">{fa(u.stats.quizzes)}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">تست</p>
        </div>
        <div>
          <p className={`font-display text-lg font-bold leading-none ${u.stats.avgBest != null ? scoreColor(u.stats.avgBest) : ""}`}>
            {u.stats.avgBest != null ? fa(u.stats.avgBest) + "٪" : "—"}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">میانگین بهترین</p>
        </div>
        <div>
          <p className="font-display text-lg font-bold leading-none">{fa(u.stats.activityDays)}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">روز فعال</p>
        </div>
      </div>

      {/* دکمهٔ بازشدن موبایل */}
      <ChevronDown className="col-span-6 h-4 w-4 rotate-90 text-muted-foreground transition-colors group-hover:text-bronze sm:col-span-1 sm:-rotate-90" />
    </button>
  );
}

// ─── برگهٔ جزئیات یک کاربر ─────────────────────────────────────────────────────
function UserDetail({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [data, setData] = React.useState<DetailData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/admin/users/${userId}`)
      .then((r) => r.json())
      .then((d: DetailData) => { if (alive) setData(d); })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [userId]);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-start bg-foreground/40 backdrop-blur-sm" onClick={onClose}>
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className="ms-auto h-full w-full max-w-2xl overflow-y-auto border-s border-border bg-background p-5 shadow-2xl sm:p-7"
        role="dialog"
        aria-label="جزئیات کاربر"
      >
        {loading || !data ? (
          <div className="flex h-full items-center justify-center gap-3 text-bronze">
            <Loader2 className="h-5 w-5 animate-spin" /> در حال خواندن پرونده…
          </div>
        ) : (
          <>
            {/* سرصفحه */}
            <div className="mb-6 flex items-start justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 font-display text-xl font-bold">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-bl from-primary to-bronze text-primary-foreground">
                    {data.user.username.slice(0, 1)}
                  </span>
                  {data.user.username}
                  {data.user.role === "admin" && (
                    <span className="rounded-full bg-bronze/15 px-2 py-0.5 text-[11px] font-bold text-bronze">مدیر</span>
                  )}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  عضویت {faDate(data.user.createdAt)} · آخرین فعالیت {faDateTime(data.user.lastSeenAt)}
                </p>
              </div>
              <button onClick={onClose} className="rounded-xl border border-border px-3 py-1.5 text-xs font-bold hover:border-bronze">
                بستن ×
              </button>
            </div>

            {/* شاخص‌ها */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["جلسه شروع‌شده", fa(data.lessonStates.length)],
                ["تکمیل‌شده", fa(data.lessonStates.filter((l) => l.status === "completed").length)],
                ["تست انجام‌شده", fa(data.quizAttempts.length)],
                ["روز مطالعه", fa(new Set(data.activityDays).size)],
              ].map(([label, v]) => (
                <div key={label} className="rounded-xl border border-border bg-card p-3 text-center shadow-card">
                  <p className="font-display text-xl font-bold">{v}</p>
                  <p className="mt-1 text-[10.5px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>

            {/* فعالیت */}
            <section className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-card">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-bold">
                <Activity className="h-4 w-4 text-bronze" /> تقویم فعالیت (۱۲ هفتهٔ اخیر)
              </h4>
              <HeatStrip days={data.activityDays} />
            </section>

            {/* وضعیت جلسات */}
            <section className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-card">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-bold">
                <BookOpenCheck className="h-4 w-4 text-bronze" /> ریز پیشرفت جلسات ({fa(data.lessonStates.length)})
              </h4>
              {data.lessonStates.length === 0 ? (
                <p className="py-3 text-xs text-muted-foreground">هنوز جلسه‌ای باز نکرده است.</p>
              ) : (
                <ul className="max-h-72 space-y-2 overflow-y-auto pe-1">
                  {data.lessonStates.map((l) => (
                    <li key={l.lessonId} className="flex items-center gap-3 rounded-xl border border-border/70 px-3 py-2.5">
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                          l.status === "completed" ? "bg-success/15 text-success" : "bg-bronze/10 text-bronze"
                        }`}
                        title={l.status === "completed" ? "تکمیل‌شده" : "در حال انجام"}
                      >
                        {l.status === "completed" ? "✓" : "…"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold">{prettyLesson(l.lessonId)}</span>
                        <span className="text-[10px] text-muted-foreground">
                          بخش {fa(Math.min(8, l.sectionsSeen))} از ۸ · آخرین تغییر {faDateTime(l.updatedAt)}
                          {typeof l.quizBest === "number" && <> · بهترین تست {fa(l.quizBest)}٪</>}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* تاریخچهٔ تست‌ها */}
            <section className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-card">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-bold">
                <ClipboardCheck className="h-4 w-4 text-bronze" /> تاریخچهٔ کامل آزمون‌ها ({fa(data.quizAttempts.length)})
              </h4>
              {data.quizAttempts.length === 0 ? (
                <p className="py-3 text-xs text-muted-foreground">هنوز آزمونی نداده است.</p>
              ) : (
                <ul className="max-h-64 space-y-1.5 overflow-y-auto pe-1">
                  {data.quizAttempts.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs">
                      <span className="truncate text-muted-foreground">{prettyLesson(a.lessonId)}</span>
                      <span className="shrink-0 tabular-nums">
                        <strong className={scoreColor(a.score)}>{fa(a.score)}٪</strong>
                        <span className="ms-2 opacity-70">{faDateTime(a.createdAt)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* یادداشت‌ها و کتاب‌های اختصاصی */}
            <div className="grid gap-4 sm:grid-cols-2">
              <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <h4 className="mb-3 flex items-center gap-2 text-sm font-bold">
                  <StickyNote className="h-4 w-4 text-bronze" /> یادداشت‌ها ({fa(data.notes.length)})
                </h4>
                {data.notes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">یادداشتی ثبت نشده.</p>
                ) : (
                  <ul className="max-h-52 space-y-2 overflow-y-auto pe-1">
                    {data.notes.slice(0, 30).map((n) => (
                      <li key={n.id} className="border-s-2 border-bronze/50 bg-muted/40 px-3 py-2 text-[11.5px] leading-relaxed">
                        {n.text}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <h4 className="mb-3 flex items-center gap-2 text-sm font-bold">
                  <CloudCheck className="h-4 w-4 text-bronze" /> کتاب‌های اختصاصی ({fa(data.customCoursesCount)})
                </h4>
                {data.customCoursesTitles.length === 0 ? (
                  <p className="text-xs text-muted-foreground">کتابی وارد نکرده است.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.customCoursesTitles.map((t, i) => (
                      <li key={i} className="truncate text-xs">📘 {t}</li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── تنظیم حساب مدیر ──────────────────────────────────────────────────────────
function AdminAccountCard() {
  const auth = useAuth();
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newUsername, setNewUsername] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newUsername: newUsername.trim() || undefined,
          newPassword: newPassword || undefined,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; newUsername?: string };
      if (data.ok) {
        setMsg({ ok: true, text: "اطلاعات حساب مدیر به‌روزرسانی شد." });
        setCurrentPassword("");
        setNewPassword("");
        if (data.newUsername) {
          setNewUsername("");
          // تازه‌سازی نام کاربری در همین نشست
          window.location.reload();
        }
      } else {
        setMsg({ ok: false, text: data.error ?? "خطای نامشخص." });
      }
    } catch {
      setMsg({ ok: false, text: "ارتباط برقرار نشد." });
    }
    setBusy(false);
  }

  const empty = !currentPassword || (!newUsername.trim() && !newPassword);

  return (
    <form onSubmit={save} className="space-y-3.5 rounded-2xl border border-bronze/30 bg-card p-5 shadow-card">
      <div>
        <h3 className="flex items-center gap-2 font-display text-sm font-bold">
          <KeyRound className="h-4 w-4 text-bronze" /> اطلاعات ورود مدیر (یوزر و پسورد اختصاصی خودتان)
        </h3>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          رمز فعلی را برای تأیید وارد کنید؛ سپس نام کاربری یا رمز تازه را تعیین کنید.
          تا زمانی که خودتان این‌جا عوضش کنید، همان اطلاعات اولیه معتبر است.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            <Lock className="h-3 w-3" /> رمز فعلی
          </span>
          <input
            type="password"
            dir="ltr"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-bronze"
          />
        </label>
        <label className="space-y-1">
          <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            <UserRound className="h-3 w-3" /> نام کاربری جدید (اختیاری)
          </span>
          <input
            dir="ltr"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="بدون تغییر"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-bronze"
          />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            <KeyRound className="h-3 w-3" /> رمز عبور جدید (اختیاری)
          </span>
          <input
            type="password"
            dir="ltr"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="حداقل ۶ نویسه؛ بدون تغییر رها کنید"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-bronze"
          />
        </label>
      </div>

      {msg && (
        <p
          role="status"
          className={`rounded-xl px-3.5 py-2.5 text-xs font-medium leading-relaxed ${
            msg.ok
              ? "border border-success/40 bg-success/10 text-success"
              : "border border-destructive/40 bg-destructive/10 text-destructive"
          }`}
        >
          {msg.text}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || empty}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-card transition-all hover:brightness-110 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        ذخیرهٔ اطلاعات مدیر
      </button>
    </form>
  );
}

// ─── ویو اصلی پنل مدیریت ──────────────────────────────────────────────────────
export function AdminView() {
  const auth = useAuth();
  const isAdmin = auth.user?.role === "admin";
  const [users, setUsers] = React.useState<AdminUser[] | null>(null);
  const [totals, setTotals] = React.useState<{
    users: number; admins: number; completions: number; totalQuizzes: number; onlineNow: number;
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [openUserId, setOpenUserId] = React.useState<string | null>(null);
  const [showAccount, setShowAccount] = React.useState(false);

  React.useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d: { users?: AdminUser[]; totals?: never[] | object; error?: string }) => {
        if (!alive) return;
        if (d.error) setError(d.error);
        else {
          setUsers(d.users ?? []);
          setTotals(d.totals as unknown as NonNullable<typeof totals>);
        }
      })
      .catch(() => alive && setError("ارتباط با سرور برقرار نشد."));
    return () => { alive = false; };
  }, [isAdmin]);

  // گارد دسترسی
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md pt-20">
        <div className="rounded-2xl border border-dashed border-destructive/50 bg-card p-8 text-center shadow-card">
          <Lock className="mx-auto mb-4 h-10 w-10 text-destructive/70" />
          <h2 className="font-display text-lg font-bold">ناحیهٔ محافظت‌شدهٔ مدیر</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            این صفحه فقط با حساب مدیر قابل مشاهده است. لطفاً از دکمهٔ «ورود / ثبت‌نام»
            بالای صفحه با اطلاعات مدیر وارد شوید.
          </p>
        </div>
      </div>
    );
  }

  const filtered = (users ?? []).filter(
    (u) => !q.trim() || u.username.toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* سرصفحه */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 font-display text-2xl font-extrabold tracking-tight">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-bronze text-primary-foreground shadow-card">
              <ShieldCheck className="h-6 w-6" />
            </span>
            پنل مدیریت همیار حقوق
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            فهرست کاربران، عملکرد مطالعاتی، بازخوردهای دانشجویان و داده‌های ذخیره‌شدهٔ هر نفر — هیچ داده‌ای هرگز حذف نمی‌شود.
          </p>
        </div>
        <StatChip icon={CloudCheck}>پایگاه دادهٔ ماندگار · سیاست نگهداری ابدی</StatChip>
      </header>

      {/* آمار کلی */}
      {totals && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MiniStat icon={Users} label="کاربران ثبت‌نام‌شده" value={fa(totals.users)} sub={`${fa(totals.admins)} حساب مدیریت`} />
          <MiniStat icon={Activity} label="آنلاین در حال حاضر" value={fa(totals.onlineNow)} sub="کمتر از ۱۰ دقیقه پیش" />
          <MiniStat icon={Award} label="جلسات تکمیل‌شده" value={fa(totals.completions)} sub="مجموع همهٔ کاربران" />
          <MiniStat icon={ClipboardCheck} label="آزمون‌های داده‌شده" value={fa(totals.totalQuizzes)} sub="با تاریخچهٔ کامل" />
        </div>
      )}

      {/* پیشنهادهای اصلاح تدریس — انتقاد کاربران + تحلیل AI + تایید/رد مدیر */}
      <AdminFeedbackSection />

      {/* جستجو */}
      <div className="relative">
        <Search className="pointer-events-none absolute end-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="جستجوی نام کاربری…"
          aria-label="جستجوی کاربر"
          className="w-full rounded-xl border border-border bg-card px-4 py-3 pe-10 text-sm shadow-card outline-none transition-colors focus:border-bronze"
        />
      </div>

      {/* فهرست کاربران */}
      {users == null && !error && (
        <p className="flex items-center justify-center gap-2 py-14 text-sm text-bronze">
          <Loader2 className="h-5 w-5 animate-spin" /> در حال دریافت کاربران…
        </p>
      )}
      {error && (
        <p className="rounded-2xl border border-destructive/40 bg-destructive/10 px-5 py-4 text-sm text-destructive">{error}</p>
      )}
      {users != null && filtered.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground shadow-card">
          هنوز کاربری ثبت‌نام نکرده است — به‌محض ثبت‌نام، پرونده‌اش این‌جا ساخته می‌شود.
        </p>
      )}

      <div className="hidden grid-cols-12 gap-2 px-4 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground/70 sm:grid">
        <span className="col-span-4">کاربر</span>
        <span className="col-span-3">پیشرفت مطالعه</span>
        <span className="col-span-5 grid grid-cols-3 text-center">
          <span>تست</span><span>میانگین بهترین</span><span>روز فعال</span>
        </span>
      </div>

      <div className="space-y-2.5">
        {filtered.map((u) => (
          <UserRow key={u.id} u={u} onOpen={() => setOpenUserId(u.id)} />
        ))}
      </div>

      {/* مدیریت حساب */}
      <section className="pt-2">
        <button
          onClick={() => setShowAccount((v) => !v)}
          aria-expanded={showAccount}
          className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 text-start shadow-card transition-colors hover:border-bronze/50"
        >
          <span className="flex items-center gap-2 font-display text-sm font-bold">
            <KeyRound className="h-4 w-4 text-bronze" /> تنظیم یوزر و پسورد اختصاصی مدیر
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform ${showAccount ? "rotate-180" : ""}`} />
        </button>
        {showAccount && <div className="mt-3"><AdminAccountCard /></div>}
      </section>

      {/* بیانیهٔ حریم داده */}
      <p className="rounded-2xl border border-dashed border-success/40 bg-success/[0.05] px-5 py-3.5 text-center text-[11.5px] leading-relaxed text-muted-foreground">
        به موجب طراحی سامانه، هیچ مسیری برای حذف دادهٔ کاربر وجود ندارد؛ همهٔ نوشتن‌ها «ادغامی»
        هستند و حتی پسورد ادمین هم فقط رشته‌ای هش‌شده است. بازرسی و خروجی گزارش تنها مزیت شماست.
      </p>

      {/* پردهٔ جزئیات */}
      {openUserId && <UserDetail userId={openUserId} onClose={() => setOpenUserId(null)} />}
    </div>
  );
}
