"use client";

// ─── کتابخانهٔ عمومی — همهٔ دوره‌ها و مطالب اساتید به تفکیک شاخه ────────────────
import * as React from "react";
import {
  LibraryBig, BookPlus, BookCheck, Loader2, GraduationCap, Star,
  MessageCircle, Clock3, LogIn, Users, Layers3,
} from "lucide-react";
import { navigate } from "@/lib/router";
import { fa } from "@/lib/fa";
import { CATEGORIES } from "@/lib/social-shared";
import { useAuth, refreshLibrary } from "@/lib/auth-client";
import { usePublicLibrary, type TCourseCard, type FeedPost } from "@/lib/social-client";
import { CourseIcon, StarRating, UserAvatar } from "./common";

/** افزودن/حذف یک دوره از کتابخانهٔ من؛ true یعنی اضافه شد */
async function toggleInLibrary(courseId: string): Promise<boolean> {
  const res = await fetch("/api/library", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ courseId }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error ?? "خطا در تغییر کتابخانه.");
  await refreshLibrary();
  return !!d.inLibrary;
}

function PrepBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/95 px-2 py-0.5 text-[9.5px] font-extrabold text-amber-950 shadow-card">
      <Clock3 className="h-3 w-3" /> در حال آماده‌سازی
    </span>
  );
}

function CourseCardLib({
  c, user, busyId, setBusyId, onErr,
}: {
  c: TCourseCard;
  user: ReturnType<typeof useAuth>["user"];
  busyId: string;
  setBusyId: (v: string) => void;
  onErr: (m: string) => void;
}) {
  async function act() {
    if (!user) {
      onErr("برای افزودن به کتابخانه ابتدا وارد شوید.");
      return;
    }
    setBusyId(c.id);
    try {
      const added = await toggleInLibrary(c.id);
      // افزودن موفق مستقیماً به دوره می‌رود تا در بخش مطالعه بازش کند
      if (added) setTimeout(() => navigate({ view: "course", id: c.id }), 250);
    } catch (e) {
      onErr(e instanceof Error ? e.message : "خطایی رخ داد.");
    } finally {
      setBusyId("");
    }
  }

  const isPrep = c._status === "prep";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-card transition-colors hover:border-bronze/50 sm:p-5">
      {/* نوار لوزی بالای کارت */}
      <span aria-hidden className="absolute -top-[7px] start-1/2 h-px w-16 -translate-x-1/2 rtl:translate-x-1/2 bg-gradient-to-l from-transparent via-bronze/60 to-transparent" />

      <div className="mb-3 flex items-start gap-3">
        <button
          onClick={() => navigate({ view: "course", id: c.id })}
          className="grid h-11 w-11 shrink-0 rotate-45 place-items-center rounded-[11px] bg-bronze/10 shadow-card transition-transform hover:scale-105"
          aria-hidden
        >
          <CourseIcon icon={c.icon} className="h-4.5 w-4.5 -rotate-45 text-bronze" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{c.title}</p>
          <p className="truncate text-xs text-muted-foreground">{c.tagline}</p>
          {isPrep && <p className="mt-1"><PrepBadge /></p>}
        </div>
      </div>

      {c.description && (
        <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{c.description}</p>
      )}

      {/* استاد */}
      <button
        onClick={() => navigate({ view: "teacher", id: c.teacher.id })}
        className="mb-3 flex w-fit items-center gap-2 rounded-xl px-1 py-0.5 transition-colors hover:bg-muted/60"
      >
        <UserAvatar src={c.teacher.avatarUrl} name={c.teacher.displayName} size="xs" />
        <span className="text-[11px] font-bold">{c.teacher.displayName}</span>
        <span className="text-[10px] font-semibold text-muted-foreground">پروفایل ←</span>
      </button>

      <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Layers3 className="h-3.5 w-3.5" />{fa(c.lessonsCount)} جلسه</span>
        <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{fa(c.studentsCount)} دانشجو</span>
      </p>

      {/* امتیاز میانگین — مطلبِ امتیاز بالا در فیدها جلوتر دیده می‌شود */}
      {!!c.rating?.count && (
        <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold text-bronze">
          <StarRating value={c.rating.avg} count={c.rating.count} size={13} />
        </p>
      )}

      <button
        onClick={act}
        disabled={!user || busyId === c.id}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors disabled:opacity-45 ${
          c.inLibrary
            ? "border border-success/50 bg-success/10 text-success"
            : "bg-primary text-primary-foreground hover:brightness-110"
        }`}
      >
        {busyId === c.id ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : c.inLibrary ? (
          <>
            <BookCheck className="h-4 w-4" /> در کتابخانهٔ مطالعهٔ توست
          </>
        ) : (
          <>
            <BookPlus className="h-4 w-4" /> افزودن به عنوان کتاب
          </>
        )}
      </button>
      {!user && (
        <p className="mt-1.5 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
          <LogIn className="h-3 w-3" /> برای افزودن وارد شو یا حساب بساز
        </p>
      )}
    </div>
  );
}

function PostTeaser({ p }: { p: FeedPost }) {
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => navigate({ view: "post", id: p.id })}
      onKeyDown={(e) => e.key === "Enter" && navigate({ view: "post", id: p.id })}
      className="group cursor-pointer rounded-2xl border border-border bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-bronze/50"
    >
      <div className="mb-2 flex items-center gap-2.5">
        <button
          onClick={(e) => { e.stopPropagation(); navigate({ view: "teacher", id: p.author.id }); }}
          className="flex min-w-0 items-center gap-2 rounded-lg -m-0.5 p-0.5 hover:bg-muted/60"
          title={`پروفایل ${p.author.displayName}`}
        >
          <UserAvatar src={p.author.avatarUrl} name={p.author.displayName} size="xs" />
          <span className="text-xs font-bold">{p.author.displayName}</span>
        </button>
        <span className="ms-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
          <MessageCircle className="h-3 w-3" /> {fa(p.commentsCount)}
        </span>
        {!!p.rating?.count && (
          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-bronze/10 px-2 py-0.5 text-[10px] font-bold text-bronze">
            <Star className="h-3 w-3 fill-current" /> {fa(Math.round(p.rating.avg * 10) / 10)}
          </span>
        )}
      </div>
      <p className="line-clamp-1 font-display text-[15px] font-bold group-hover:text-bronze">{p.title}</p>
      {p.summary && <p className="line-clamp-2 mt-1 text-xs leading-relaxed text-muted-foreground">{p.summary}</p>}
    </div>
  );
}

export function PublicLibraryView() {
  const auth = useAuth();
  const [cat, setCat] = React.useState("");
  const { courses, posts, loading } = usePublicLibrary(cat);
  const [busyId, setBusyId] = React.useState("");
  const [err, setErr] = React.useState("");

  React.useEffect(() => setErr(""), [cat]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-28 pt-6 sm:px-6">
      <header>
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><LibraryBig className="h-6 w-6" /></span>
          کتابخانهٔ عمومی
        </h1>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
          دوره‌ها و مطالبی که اساتید همیار منتشر کرده‌اند — دسته‌بندی‌شده بر اساس شاخه.
          هر چیزی را خواستی به بخش مطالعهٔ خودت اضافه کن؛ حتی دوره‌هایی که هنوز در حال آماده‌سازی‌اند.
        </p>
      </header>

      {/* تب‌های شاخه */}
      <nav aria-label="شاخه‌های کتابخانه" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        {[{ slug: "", label: "همه" }, ...CATEGORIES].map((c) => (
          <button
            key={c.slug || "all"}
            onClick={() => setCat(c.slug)}
            aria-pressed={cat === c.slug}
            className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition-all ${
              cat === c.slug
                ? "border-bronze bg-gradient-to-l from-bronze/[0.14] to-transparent text-bronze shadow-card"
                : "border-border bg-card text-muted-foreground hover:border-bronze/40 hover:text-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
      </nav>

      {err && <p className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{err}</p>}

      {!auth.user && (
        <p className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <LogIn className="h-4 w-4 shrink-0 text-bronze" />
          دیدنِ آزاد است؛ اما برای افزودن به کتابخانه و امتیاز دادن باید از «ورود / ثبت‌نام» وارد شوی.
        </p>
      )}

      {loading && (
        <p className="flex items-center gap-2 py-8 text-sm text-bronze"><Loader2 className="h-4 w-4 animate-spin" /> در حال دریافت کتابخانه…</p>
      )}

      {!loading && (
        <>
          {/* دوره‌ها */}
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-bold"><GraduationCap className="h-5 w-5 text-bronze" /> دوره‌ها ({fa(courses.length)})</h2>
            {courses.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground shadow-card">
                هنوز دوره‌ای در این شاخه ثبت نشده است.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {courses.map((c) => (
                  <CourseCardLib key={c.id} c={c} user={auth.user} busyId={busyId} setBusyId={setBusyId} onErr={setErr} />
                ))}
              </div>
            )}
          </section>

          {/* مطالب */}
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-bold">مطالب آموزشی ({fa(posts.length)})</h2>
            {posts.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground shadow-card">
                در این شاخه فعلاً مطلبی نیست.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {posts.map((p) => <PostTeaser key={p.id} p={p} />)}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
