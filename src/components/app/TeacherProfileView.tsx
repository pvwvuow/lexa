"use client";

// ─── پروفایل عمومی استاد — فعالیت، دوره‌ها و مطالب او در یک صفحه ──────────────
import * as React from "react";
import {
  Loader2, UserPlus, UserCheck, BookPlus, BookCheck, MessageCircle,
  GraduationCap, ArrowLeft, Star, Clock3, Users, CalendarDays,
} from "lucide-react";
import { navigate } from "@/lib/router";
import { fa } from "@/lib/fa";
import { useAuth, refreshLibrary } from "@/lib/auth-client";
import {
  useTeacherProfile,
  type TeacherProfileData,
  type TCourseCard,
  type RatingInfo,
} from "@/lib/social-client";
import { CourseIcon, StarRating, UserAvatar } from "./common";
import { OfflineDownloadButton, OfflineUpdatedPill } from "./offline-ui";

function StatChipP({ Icon, label, value }: { Icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold shadow-card">
      <Icon className="h-4 w-4 text-bronze" />
      {fa(value)} {label}
    </span>
  );
}

export function TeacherProfileView({ id }: { id?: string }) {
  const auth = useAuth();
  const { data, loading, notFound, reload } = useTeacherProfile(id);
  const [busyId, setBusyId] = React.useState("");
  const [err, setErr] = React.useState("");

  if (!id || notFound) {
    return (
      <div className="mx-auto max-w-md pt-20 text-center">
        <p className="rounded-2xl border border-dashed border-border bg-card p-8 text-sm text-muted-foreground shadow-card">
          این پروفایل یافت نشد.
        </p>
        <button onClick={() => navigate({ view: "teachers" })} className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-bronze hover:underline">
          بازگشت به اساتید <ArrowLeft className="h-4 w-4" />
        </button>
      </div>
    );
  }
  if (loading && !data) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-bronze">
        <Loader2 className="h-5 w-5 animate-spin" /> در حال بارگذاری پروفایل…
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-7 px-4 pb-28 pt-6 sm:px-6">
      <button onClick={() => navigate({ view: "teachers" })} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-bronze">
        <ArrowLeft className="h-3.5 w-3.5 rotate-180" /> همهٔ اساتید
      </button>

      {/* سربرگ پروفایل */}
      <header className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -end-10 -top-10 h-40 w-40 rotate-45 rounded-[40px] bg-gradient-to-bl from-bronze/10 to-transparent" />
        <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <UserAvatar src={data.profile.avatarUrl} name={data.profile.displayName} size="xl" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <h1 className="text-2xl font-extrabold tracking-tight">{data.profile.displayName}</h1>
            <p dir="ltr" className="text-start text-xs font-medium text-muted-foreground">@{data.profile.username}</p>
            {data.profile.bio ? (
              <p className="max-w-xl pt-1 text-sm leading-relaxed text-muted-foreground">{data.profile.bio}</p>
            ) : null}
            <p className="flex items-center gap-1.5 pt-0.5 text-[11px] text-muted-foreground/80">
              <CalendarDays className="h-3.5 w-3.5" />
              عضو از {new Date(data.profile.joinedAt).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <FollowButton
            teacherId={data.profile.id}
            initial={data.profile.isFollowing}
            onChanged={() => void reload()}
            disabled={!auth.user}
          />
        </div>

        <div className="relative mt-5 flex flex-wrap gap-2">
          <StatChipP Icon={Users} label="دنبال‌کننده" value={data.profile.followersCount} />
          <StatChipP Icon={MessageCircle} label="مطلب" value={data.profile.postsCount} />
          <StatChipP Icon={GraduationCap} label="دوره" value={data.profile.coursesCount} />
          {data.profile.avgRating > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-bronze/40 bg-bronze/[0.06] px-3 py-1.5 text-xs font-bold text-bronze shadow-card">
              <Star className="h-4 w-4 fill-current" /> میانگین امتیاز {fa(data.profile.avgRating)}
            </span>
          )}
        </div>
      </header>

      {err && <p className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{err}</p>}

      {/* دوره‌های استاد */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold"><GraduationCap className="h-5 w-5 text-bronze" /> دوره‌های استاد</h2>
        {data.courses.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground shadow-card">
            هنوز دوره‌ای منتشر نکرده است.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.courses.map((c) => (
              <ProfileCourseCard key={c.id} c={c} user={auth.user} busyId={busyId} setBusyId={setBusyId} onErr={setErr} onChanged={() => void reload()} />
            ))}
          </div>
        )}
      </section>

      {/* مطالب استاد */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">مطالب آموزشی</h2>
        {data.posts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground shadow-card">
            هنوز مطلبی نوشته نشده است.
          </p>
        ) : (
          <ul className="space-y-3">
            {data.posts.map((p) => (
              <li key={p.id}>
                <div
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate({ view: "post", id: p.id })}
                  onKeyDown={(e) => e.key === "Enter" && navigate({ view: "post", id: p.id })}
                  className="group flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card transition-colors hover:border-bronze/50"
                >
                  <span aria-hidden className="grid h-9 w-9 shrink-0 rotate-45 place-items-center rounded-[9px] bg-primary/10">
                    <MessageCircle className="h-4 w-4 -rotate-45 text-bronze" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="line-clamp-1 block font-display text-[14.5px] font-bold group-hover:text-bronze">{p.title}</span>
                      <OfflineUpdatedPill kind="post" id={p.id} serverUpdatedAt={p.updatedAt} />
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{fa(p.commentsCount)} نظر</span>
                  </span>
                  {!!p.rating?.count && (
                    <span className="hidden shrink-0 sm:block"><StarRating value={p.rating.avg} count={p.rating.count} size={12} /></span>
                  )}
                  <OfflineDownloadButton
                    kind="post"
                    id={p.id}
                    serverUpdatedAt={p.updatedAt}
                    card={{ ...p, author: { id: data.profile.id, username: data.profile.username, displayName: data.profile.displayName, avatarUrl: data.profile.avatarUrl } }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ─── دکمهٔ فالو درون پروفایل ── */
function FollowButton({
  teacherId, initial, onChanged, disabled,
}: { teacherId: string; initial: boolean; onChanged: () => void; disabled?: boolean }) {
  const [following, setFollowing] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => setFollowing(initial), [initial]);

  async function toggle() {
    if (disabled) return;
    setBusy(true);
    try {
      await fetch("/api/social/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId }),
      });
      setFollowing((v) => !v);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={disabled || busy}
      title={disabled ? "ابتدا وارد شو" : undefined}
      className={`inline-flex shrink-0 items-center gap-2 self-start rounded-full px-5 py-2.5 text-sm font-bold transition-all ${
        following
          ? "border border-success/50 bg-success/10 text-success"
          : "bg-primary text-primary-foreground hover:brightness-110"
      }`}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : following ? (
        <UserCheck className="h-4 w-4" />
      ) : (
        <UserPlus className="h-4 w-4" />
      )}
      {following ? "دنبال می‌کنی" : "دنبال کردن"}
    </button>
  );
}

/* ─── کارت دورهٔ پروفایل — کلیک روی کارت = باز شدن دوره ── */
function ProfileCourseCard({
  c, user, busyId, setBusyId, onErr, onChanged,
}: {
  c: TCourseCard;
  user: ReturnType<typeof useAuth>["user"];
  busyId: string;
  setBusyId: (v: string) => void;
  onErr: (m: string) => void;
  onChanged: () => void;
}) {
  async function act() {
    if (!user) {
      onErr("برای افزودن به کتابخانه ابتدا وارد شوید.");
      return;
    }
    setBusyId(c.id);
    try {
      await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: c.id }),
      });
      await refreshLibrary();
      onChanged();
    } catch (e) {
      onErr(e instanceof Error ? e.message : "خطایی رخ داد.");
    } finally {
      setBusyId("");
    }
  }

  const isDraft = c._status === "draft";

  return (
    <div
      role={isDraft ? undefined : "link"}
      tabIndex={isDraft ? -1 : 0}
      onClick={() => !isDraft && navigate({ view: "course", id: c.id })}
      onKeyDown={(e) => {
        if (!isDraft && e.key === "Enter") {
          e.preventDefault();
          navigate({ view: "course", id: c.id });
        }
      }}
      title={!isDraft ? `باز کردن «${c.title}»` : undefined}
      className={`group rounded-2xl border border-border bg-card p-4 shadow-card transition-colors hover:border-bronze/50 sm:p-5 ${isDraft ? "border-dashed opacity-90" : "cursor-pointer"}`}
    >
      <div className="mb-2.5 flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-bronze/10 text-bronze"><CourseIcon icon={c.icon} /></span>
        <div className="min-w-0 flex-1">
          <p className={`truncate font-bold transition-colors ${!isDraft && "group-hover:text-bronze"}`}>{c.title}</p>
          <p className="truncate text-xs text-muted-foreground">{fa(c.lessonsCount)} جلسه · {fa(c.studentsCount)} دانشجو</p>
        </div>
        {isDraft ? (
          <span className="shrink-0 rounded-full border border-dashed border-border px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground">پیش‌نویس — فقط من</span>
        ) : c._status === "prep" ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-400/95 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-950">
            <Clock3 className="h-3 w-3" /> در حال آماده‌سازی
          </span>
        ) : (
          <OfflineUpdatedPill kind="tcourse" id={c.id} serverUpdatedAt={c._updatedAt} />
        )}
      </div>
      {c.description && <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{c.description}</p>}
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        {!!(c.rating as RatingInfo | undefined)?.count && (
          <StarRating value={c.rating!.avg} count={c.rating!.count} size={13} />
        )}
        {!isDraft && (
          <>
            <OfflineDownloadButton kind="tcourse" id={c.id} serverUpdatedAt={c._updatedAt} card={c} />
            <button
              onClick={(e) => { e.stopPropagation(); void act(); }}
              disabled={!user || busyId === c.id}
              className={`ml-auto inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-colors disabled:opacity-45 ${
                c.inLibrary ? "border border-success/50 bg-success/10 text-success" : "bg-bronze/15 text-bronze hover:bg-bronze/25"
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
          </>
        )}
      </div>
    </div>
  );
}
