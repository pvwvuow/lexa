"use client";

// ─── صفحهٔ اساتید: پیشنهاد، فالو، دوره‌هایشان به‌عنوان کتاب، مطالب ────────────
import * as React from "react";
import {
  GraduationCap, UserPlus, UserCheck, BookPlus, BookCheck, BookOpen,
  MessageCircle, Rss, Loader2, LogIn, PenSquare,
} from "lucide-react";
import { useAuth } from "@/lib/auth-client";
import { navigate } from "@/lib/router";
import { fa } from "@/lib/fa";
import { useSocial, useTCourses } from "@/lib/social-client";
import { CourseIcon, UserAvatar } from "./common";
import { TeacherFeedTeasers } from "./DashboardView";

export function TeachersView() {
  const { user } = useAuth();
  const { teachers, loading, toggleFollow } = useSocial();
  const { courses: tcourses, toggleLibrary } = useTCourses();
  const [err, setErr] = React.useState("");
  const [busyId, setBusyId] = React.useState("");

  async function onFollow(id: string) {
    setErr("");
    try {
      await toggleFollow(id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطایی رخ داد.");
    }
  }

  async function onAddLibrary(courseId: string) {
    setErr("");
    try {
      setBusyId(courseId);
      const added = await toggleLibrary(courseId);
      if (added) {
        // فرصت کوتاه برای هیدرات فروشگاه؛ سپس پرش مستقیم به دورهٔ تازه در بخش مطالعه
        setTimeout(() => navigate({ view: "course", id: courseId }), 250);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطایی رخ داد.");
    } finally {
      setBusyId("");
    }
  }

  const isTeacherUser = user?.role === "teacher";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-7 px-4 pb-28 pt-6 sm:px-6">
      {/* سرصفحه */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><GraduationCap className="h-6 w-6" /></span>
            اساتید همیار حقوق
          </h1>
          <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-muted-foreground">
            استادت را دنبال کن؛ مطالب آموزشی‌اش را در فید خانه ببین و اگر دورهٔ آنلاینی ساخت،
            همان را مثل یک کتاب به بخش مطالعهٔ خودت اضافه کن.
          </p>
        </div>
        {isTeacherUser && (
          <button
            onClick={() => navigate({ view: "studio" })}
            className="inline-flex items-center gap-2 rounded-xl bg-bronze px-4 py-2.5 text-sm font-bold text-bronze-foreground shadow-card transition-transform active:scale-[.98]"
          >
            <PenSquare className="h-4 w-4" /> اتاق استاد من
          </button>
        )}
      </header>

      {!user && (
        <p className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <LogIn className="h-4 w-4 shrink-0 text-bronze" />
          برای فالو، کامنت یا افزودن دوره به کتابخانه، از دکمهٔ «ورود / ثبت‌نام» بالای صفحه حساب بساز.
        </p>
      )}
      {err && <p className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{err}</p>}

      {/* فهرست اساتید */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">پیشنهاد ما</h2>
        <p className="-mt-1.5 text-xs text-muted-foreground">
          روی آواتار یا نام هر استاد بزن تا پروفایل و فعالیت‌هایش را ببینی.
        </p>
        {loading && (
          <p className="flex items-center gap-2 py-6 text-sm text-bronze"><Loader2 className="h-4 w-4 animate-spin" /> در حال دریافت…</p>
        )}
        {!loading && !teachers.length && (
          <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground shadow-card">
            هنوز استادی ثبت نشده است — مدیر می‌تواند از پنل مدیریت، حساب استاد بسازد.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {teachers.map((t) => (
            <div key={t.id} className="rounded-2xl border border-border bg-card p-4 shadow-card transition-colors hover:border-bronze/50 sm:p-5">
              <div className="flex items-start gap-3.5">
                <button
                  onClick={() => navigate({ view: "teacher", id: t.id })}
                  title={`پروفایل ${t.displayName}`}
                  className="mt-1 shrink-0 rounded-full p-0.5 transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
                >
                  <UserAvatar src={t.avatarUrl} name={t.displayName} />
                </button>
                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => navigate({ view: "teacher", id: t.id })}
                    className="rounded-lg font-display font-bold transition-colors hover:text-bronze"
                    title="پروفایل و فعالیت‌ها"
                  >
                    {t.displayName}
                  </button>
                  <p className="truncate text-[11px] text-muted-foreground">@{t.username}</p>
                  {t.bio && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{t.bio}</p>}
                </div>
                <button
                  onClick={() => onFollow(t.id)}
                  disabled={!user}
                  title={!user ? "ابتدا وارد شو" : undefined}
                  className={`inline-flex shrink-0 items-center gap-1.5 self-center rounded-full px-4 py-2 text-xs font-bold transition-all ${
                    t.isFollowing
                      ? "border border-success/50 bg-success/10 text-success"
                      : "bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-45"
                  }`}
                >
                  {t.isFollowing ? <UserCheck className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                  {t.isFollowing ? "دنبال می‌کنی" : "دنبال کردن"}
                </button>
              </div>

              <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span>{fa(t.followers)} دنبال‌کننده</span>
                <span>· {fa(t.posts)} مطلب</span>
                {t.courses > 0 && <span>· {fa(t.courses)} دورهٔ آنلاین</span>}
              </p>

              {/* دوره‌های همین استاد */}
              {tcourses.filter((c) => c.teacher.id === t.id).length > 0 && (
                <ul className="mt-3 space-y-2 border-t border-dashed border-border pt-3">
                  {tcourses.filter((c) => c.teacher.id === t.id).map((c) => (
                    <li key={c.id} className="flex items-center gap-2.5 rounded-xl bg-muted/40 px-3 py-2">
                      <CourseIcon icon={c.icon} className="h-4 w-4 shrink-0 text-bronze" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-bold">{c.title}</span>
                        <span className="block text-[10px] text-muted-foreground">{fa(c.lessonsCount)} جلسه · {fa(c.studentsCount)} دانشجو</span>
                      </span>
                      <button
                        onClick={() => onAddLibrary(c.id)}
                        disabled={!user || busyId === c.id}
                        title={!user ? "ابتدا وارد شو" : c.inLibrary ? "حذف از کتابخانهٔ من — پیشرفتت می‌ماند" : "افزودن به کتابخانهٔ من"}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors ${
                          c.inLibrary
                            ? "border border-success/50 bg-success/10 text-success"
                            : "bg-bronze/15 text-bronze hover:bg-bronze/25 disabled:opacity-45"
                        }`}
                      >
                        {busyId === c.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : c.inLibrary ? (
                          <BookCheck className="h-3.5 w-3.5" />
                        ) : (
                          <BookPlus className="h-3.5 w-3.5" />
                        )}
                        {c.inLibrary ? "در کتابخانه" : "افزودن"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* همهٔ دوره‌های آنلاین */}
      {tcourses.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold"><BookOpen className="h-5 w-5 text-bronze" /> دوره‌های آنلاین اساتید</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {tcourses.map((c) => (
              <div key={c.id} className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-card transition-colors hover:border-bronze/50 sm:p-5">
                <div className="mb-3 flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-bronze/10 text-bronze"><CourseIcon icon={c.icon} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{c.title}</p>
                    <p className="truncate text-xs text-muted-foreground">استاد {c.teacher.displayName} · {fa(c.lessonsCount)} جلسه · {fa(c.studentsCount)} دانشجو</p>
                  </div>
                </div>
                {c.description && <p className="line-clamp-2 mb-3 text-xs leading-relaxed text-muted-foreground">{c.description}</p>}
                <button
                  onClick={() => onAddLibrary(c.id)}
                  disabled={!user || busyId === c.id}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
                    c.inLibrary
                      ? "border border-success/50 bg-success/10 text-success"
                      : "bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-45"
                  }`}
                >
                  {busyId === c.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : c.inLibrary ? (
                    <BookCheck className="h-4 w-4" />
                  ) : (
                    <BookPlus className="h-4 w-4" />
                  )}
                  {c.inLibrary ? "در کتابخانهٔ مطالعهٔ توست" : "افزودن به عنوان کتاب در بخش مطالعه"}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* آخرین مطالب */}
      <TeacherFeedTeasers />

      <p className="flex items-center justify-center gap-2 pt-1 text-center text-[11px] text-muted-foreground">
        <MessageCircle className="h-3.5 w-3.5" /> زیر هر مطلب می‌توانی کامنت بگذاری
        <Rss className="ms-2 h-3.5 w-3.5" /> فید خانه با اساتیدی که دنبال می‌کنی شخصی می‌شود
      </p>
    </div>
  );
}
