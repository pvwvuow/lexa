"use client";

import * as React from "react";
import {
  Home, BookOpen, ClipboardList, TrendingUp, Settings, Upload, Scale,
  ChevronsLeft, ChevronsRight, ChevronDown, PlayCircle, ShieldCheck, GraduationCap, PenSquare,
  LibraryBig, Landmark, Menu, ScrollText,
} from "lucide-react";
import { useRoute, navigate, type Route } from "@/lib/router";
import { useApp } from "@/lib/store";
import { mergeVisible } from "@/lib/books";
import { useAuth } from "@/lib/auth-client";
import { builtinCourses } from "@/lib/law/courses";
import type { Course } from "@/lib/law/types";
import { fa, pct } from "@/lib/fa";
import { ThemeToggle } from "./theme-provider";
import { DashboardView } from "./DashboardView";
import { CourseView } from "./CourseView";
import { LearnView } from "./LearnView";
import { QuizView } from "./QuizView";
import { FlashcardsView } from "./FlashcardsView";
import { CaseStudyView } from "./CaseStudyView";
import { ProgressView } from "./ProgressView";
import { SettingsView } from "./SettingsView";
import { ImportView } from "./ImportView";
import { CourseIcon } from "./common";
import { GlobalSearch } from "./GlobalSearch";
import { AccountArea, SyncHint } from "./AccountArea";
import { AdminView } from "./AdminView";
import { TeachersView } from "./TeachersView";
import { StudioView } from "./StudioView";
import { PostView } from "./PostView";
import { PublicLibraryView } from "./PublicLibraryView";
import { TeacherProfileView } from "./TeacherProfileView";
import { LawLibraryView } from "./LawLibraryView";
import { BackButton } from "./common";
import { FeedBell } from "./FeedBell";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type NavMode = "expanded" | "rail";

/** آیتم منوی ستونی — در حالت نوار باریک فقط آیکون با تولتیپ */
function SideItem({
  icon: Icon, label, active, rail, onClick, chevron, open,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; active?: boolean; rail: boolean; onClick: () => void;
  chevron?: boolean; open?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-expanded={chevron && !rail ? !!open : undefined}
      aria-current={active ? "page" : undefined}
      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
        rail ? "justify-center px-0" : ""
      } ${
        active
          ? "bg-primary text-primary-foreground shadow-card"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!rail && <span className="flex-1 truncate text-start">{label}</span>}
      {!rail && chevron && (
        <ChevronDown className={`h-4 w-4 shrink-0 opacity-60 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      )}
      {rail && (
        <span className="pointer-events-none absolute start-full z-50 ms-2.5 whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-medium text-background opacity-0 shadow-card transition-opacity duration-150 group-hover:opacity-100">
          {label}
        </span>
      )}
    </button>
  );
}

function DockBtn({ icon: Icon, label, active, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`relative flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[10px] font-medium transition-colors duration-200 ${
        active
          ? "bg-foreground/[0.07] text-primary shadow-[inset_0_1px_0.5px_-0.5px_rgba(255,255,255,0.55)] dark:bg-white/[0.14] dark:text-bronze"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-5 w-5" />
      {label}
      {active && <span aria-hidden className="absolute -top-px h-0.5 w-6 rounded-full bg-gradient-to-l from-bronze to-primary" />}
    </button>
  );
}

/** تشخیص جهت اسکرول — اسکرول به پایین، نوار بالا/پایین را در موبایل پنهان می‌کند و اسکرول به بالا برمی‌گرداند */
function useHideOnScroll(resetKey: unknown) {
  const [hidden, setHidden] = React.useState(false);
  React.useEffect(() => {
    setHidden(false); // با هر جابه‌جایی مسیر، نوارها دیده می‌شوند
  }, [resetKey]);
  React.useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY;
        lastY = y;
        if (delta > 6 && y > 90) setHidden(true);
        else if (delta < -6 || y <= 8) setHidden(false);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return hidden;
}

function lessonPctOf(course: Course, progress: Record<string, { status?: string }>) {
  const flat = course.chapters.flatMap((c) => c.lessons);
  let done = 0;
  flat.forEach((l) => {
    if (progress[l.id]?.status === "completed") done += 1;
    else if (progress[l.id]) done += 0.5;
  });
  return pct(done, Math.max(1, flat.length));
}

export function AppShell() {
  const route = useRoute();
  const auth = useAuth();
  const last = useApp((s) => s.lastLocation);
  const progress = useApp((s) => s.progress);
  const customCourses = useApp((s) => s.customCourses);
  const tBooks = useApp((s) => s.tBooks);
  const hiddenBuiltins = useApp((s) => s.hiddenBuiltins);
  // دوره‌هایی که کاربر از «کتابخانهٔ من» برداشته، از همهٔ سطح‌های نمایشی کنار می‌روند
  const courses = React.useMemo(
    () => mergeVisible({ customCourses, tBooks, hiddenBuiltins }),
    [customCourses, tBooks, hiddenBuiltins],
  );
  const [mounted, setMounted] = React.useState(false);

  // در موبایل با اسکرول به پایین نوار بالا و داک پایین جمع می‌شوند
  const chromeHidden = useHideOnScroll(route);

  // منوی ستونی دسکتاپ: باز یا نوار باریک؛ انتخاب کاربر ماندگار است
  const [mode, setMode] = React.useState<NavMode>("expanded");
  // درخواست کاربر: کلیک روی «مطالعه» فهرست کشویی درس‌ها را باز می‌کند
  const [studyOpen, setStudyOpen] = React.useState(false);
  // منوی کشویی موبایل — تنها راه دسترسی کامل به همهٔ بخش‌ها در صفحهٔ کوچک
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [drawerStudy, setDrawerStudy] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    try {
      if (window.localStorage.getItem("hh-nav") === "rail") setMode("rail");
    } catch {}
  }, []);

  const isSubPage = ["learn", "quiz", "case", "admin", "studio"].includes(route.view) || route.view === "cards";

  // در زیرصفحه‌ها منو خودکار جمع می‌شود تا تمرکز روی محتوا بماند
  React.useEffect(() => {
    if (!mounted) return;
    setMode((m) => (isSubPage ? "rail" : m === "rail" && window.localStorage.getItem("hh-nav") !== "rail" ? "expanded" : m));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSubPage, mounted]);

  function expandNav() {
    setMode("expanded");
    try { window.localStorage.setItem("hh-nav", "expanded"); } catch {}
  }
  function collapseNav() {
    setMode("rail");
    try { window.localStorage.setItem("hh-nav", "rail"); } catch {}
  }

  // ── مقصد پیش‌فرض فهرست مطالعه: آخرین درسی که کاربر در آن بوده ──
  let recentCourse: Course | null = null;
  let recentLessonTitle: string | null = null;
  if (last.lessonId) {
    outer: for (const c of courses)
      for (const ch of c.chapters)
        for (const l of ch.lessons)
          if (l.id === last.lessonId) {
            recentCourse = c;
            recentLessonTitle = l.title;
            break outer;
          }
  }

  function clickStudy() {
    if (mode === "rail") {
      expandNav();
      setStudyOpen(true);
      return;
    }
    setStudyOpen((v) => !v);
  }

  if (!mounted) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="flex items-center gap-3 text-bronze"><Scale className="h-6 w-6 animate-pulse" /><span className="font-bold">همیار حقوق</span></div>
      </div>
    );
  }

  const current = route.view;
  const rail = mode === "rail";

  function go(r: Route) {
    setDrawerOpen(false);
    setDrawerStudy(false);
    navigate(r);
  }

  /** دکمهٔ «تدریس» داک موبایل: اگر جلسه‌ای جاری بود برو همان؛ والا فهرست درس‌های فعال باز شود */
  function dockTadriss() {
    if (last.lessonId) {
      go({ view: "learn", id: last.lessonId });
    } else {
      setDrawerStudy(true);
      setDrawerOpen(true);
    }
  }

  // ─── سایدبار ستونی سمت راست (دسکتاپ) ───
  const Sidebar = (
    <aside
      className={`sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-e border-border/70 bg-card/50 backdrop-blur-sm transition-[width] duration-200 ease-out lg:flex ${
        rail ? "w-[76px]" : "w-[228px]"
      }`}
    >
      <nav aria-label="ناوبری اصلی" className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        <SideItem icon={Home} label="خانه" rail={rail} active={current === "home"} onClick={() => go({ view: "home" })} />

        {/* مطالعه — با فهرست کشویی درس‌ها */}
        <SideItem
          icon={BookOpen}
          label="مطالعه"
          rail={rail}
          active={["course", "learn", "case", "cards"].includes(current)}
          onClick={clickStudy}
          chevron
          open={studyOpen}
        />
        {!rail && studyOpen && (
          <div className="mb-1 space-y-1 border-s border-dashed border-border ps-2.5 pe-1 py-1">
            <p className="px-2 pb-0.5 text-[10px] font-medium text-muted-foreground/70">درس‌های فعال</p>
            {courses.map((c) => {
              const isRecent = recentCourse?.id === c.id;
              return (
                <div key={c.id}>
                  <button
                    onClick={() => go({ view: "course", id: c.id })}
                    title={`${c.title} — ${fa(lessonPctOf(c, progress))}٪`}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors ${
                      isRecent ? "bg-accent font-semibold text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <CourseIcon icon={c.icon} className="h-3.5 w-3.5 shrink-0 text-bronze" />
                    <span className="min-w-0 flex-1 truncate text-start">{c.title}</span>
                    <span dir="ltr" className="shrink-0 text-[10px] tabular-nums opacity-70">{fa(lessonPctOf(c, progress))}%</span>
                  </button>

                  {/* ادامه از آخرین جلسهٔ همین درس */}
                  {isRecent && last.lessonId && (
                    <button
                      onClick={() => go({ view: "learn", id: last.lessonId! })}
                      className="mt-0.5 flex w-full items-center gap-1.5 rounded-lg bg-primary/10 px-2 py-1.5 text-start text-[11px] font-medium text-primary transition-colors hover:bg-primary/15"
                      title={`ادامه «${recentLessonTitle}»`}
                    >
                      <PlayCircle className="h-3.5 w-3.5 shrink-0 text-bronze" />
                      <span className="min-w-0 truncate">ادامه: {recentLessonTitle}</span>
                    </button>
                  )}
                  {isRecent && !last.lessonId && (
                    <p className="mt-0.5 px-2 text-[10px] leading-relaxed text-muted-foreground/60">آخرین محل مطالعه شما</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <SideItem icon={ClipboardList} label="تست" rail={rail} active={current === "quiz"} onClick={() => go({ view: "quiz", id: last.lessonId })} />
        <SideItem icon={TrendingUp} label="پیشرفت" rail={rail} active={current === "progress"} onClick={() => go({ view: "progress" })} />
        {/* کتابخانهٔ عمومی — دوره‌ها و مطالب اساتید با دسته‌بندی */}
        <SideItem icon={LibraryBig} label="کتابخانهٔ عمومی" rail={rail} active={["library", "teacher"].includes(current)} onClick={() => go({ view: "library" })} />
        {/* کتابخانهٔ قوانین — متن قانون‌های کشور */}
        <SideItem icon={Landmark} label="کتابخانهٔ قوانین" rail={rail} active={current === "law"} onClick={() => go({ view: "law" })} />
        {/* شبکهٔ اساتید: پیشنهاد، فالو، مطالب و دوره‌های آنان */}
        <SideItem icon={GraduationCap} label="اساتید و مقالات" rail={rail} active={["teachers", "post"].includes(current)} onClick={() => go({ view: "teachers" })} />
        {/* افزودن کتاب فقط برای مدیر */}
        {auth.user?.role === "admin" && (
          <SideItem icon={Upload} label="افزودن کتاب" rail={rail} active={current === "import"} onClick={() => go({ view: "import" })} />
        )}
        {auth.user?.role === "teacher" && (
          <SideItem icon={PenSquare} label="اتاق استاد" rail={rail} active={current === "studio"} onClick={() => go({ view: "studio" })} />
        )}
        {auth.user?.role === "admin" && (
          <SideItem
            icon={ShieldCheck}
            label="پنل مدیریت"
            rail={rail}
            active={current === "admin"}
            onClick={() => go({ view: "admin" })}
          />
        )}
      </nav>

      {/* یک دکمه واحد: جمع کردن / باز کردن */}
      <div className="border-t border-border/70 p-3">
        <SyncHint collapsed={rail} />
        {rail ? (
          <button
            onClick={expandNav}
            title="باز کردن منو"
            aria-label="باز کردن منو"
            className="grid h-10 w-full place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-bronze"
          >
            <ChevronsLeft className="h-[18px] w-[18px]" />
          </button>
        ) : (
          <button
            onClick={collapseNav}
            title="جمع کردن منو"
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronsRight className="h-[18px] w-[18px] shrink-0" />
            جمع کردن منو
          </button>
        )}
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen">
      {Sidebar}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ═══ نوار بالای زمردی — برند + جستجوی میانی + حساب؛ الهام از طرح مرجع ═══ */}
        <header
          className={`sticky top-0 z-40 bg-background/0 px-2.5 pt-3 transition-all duration-300 ease-out sm:px-5 ${
            chromeHidden ? "max-lg:pointer-events-none max-lg:-translate-y-[135%] max-lg:opacity-0" : ""
          }`}
        >
          <div className="mx-auto max-w-7xl">
            <div className="relative flex h-14 items-center gap-2 overflow-hidden rounded-2xl border border-bronze/30 bg-gradient-to-l from-[#0d211a] via-[#143026] to-[#0d211a] px-2 shadow-card sm:gap-3 sm:px-3.5">
              <div aria-hidden className="pattern-quilt pointer-events-none absolute inset-0 opacity-40" />
              <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-l from-transparent via-bronze/70 to-transparent" />
              <div aria-hidden className="pointer-events-none absolute -top-16 start-1/3 h-32 w-64 rounded-full bg-bronze/15 blur-3xl" />

              {/* برند — ترازوی طلایی + نام + زیرعنوان */}
              <button onClick={() => go({ view: "home" })} className="group relative flex shrink-0 items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#d9b877] via-bronze to-[#8a6a30] text-[#132018] shadow-card transition-transform duration-200 group-hover:scale-105">
                  <Scale className="h-4.5 w-4.5" />
                </span>
                <span className="hidden leading-tight sm:block">
                  <span className="block text-[15px] font-extrabold tracking-tight text-white">همیار حقوق</span>
                  <span className="block text-[9.5px] font-semibold text-bronze">استاد حقوقی هوشمند</span>
                </span>
              </button>

              {/* جستجوی میانی — قرص جستجو با میانبر Ctrl / */}
              <div className="relative hidden min-w-0 flex-1 justify-center md:flex">
                <GlobalSearch courses={courses} variant="bar" />
              </div>

              {/* ابزارها — حساب، تم، تنظیمات، منوی موبایل */}
              <div className="relative ms-auto flex items-center gap-1.5">
                <div className="md:hidden">
                  <GlobalSearch courses={courses} variant="icon" />
                </div>
                <FeedBell />
                <span className="[&_button]:!border-white/15 [&_button]:!bg-white/[0.07] [&_button]:!text-white/85 hover:[&_button]:!border-bronze/70 hover:[&_button]:!text-white">
                  <AccountArea />
                </span>
                <span className="hidden [&_button]:!border-white/15 [&_button]:!bg-white/[0.07] [&_button]:!text-white/85 hover:[&_button]:!border-bronze/70 hover:[&_button]:!text-white sm:inline">
                  <ThemeToggle />
                </span>
                <button
                  onClick={() => go({ view: "settings" })}
                  aria-label="تنظیمات و پروفایل"
                  title="تنظیمات و پروفایل"
                  className="hidden h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/[0.07] text-white/85 shadow-card transition-colors hover:border-bronze/70 hover:text-bronze sm:inline-flex"
                >
                  <Settings className="h-[18px] w-[18px]" />
                </button>
                <button
                  onClick={() => setDrawerOpen(true)}
                  aria-label="باز کردن منو"
                  title="منو"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/[0.07] text-white/90 shadow-card transition-colors hover:border-bronze/70 hover:text-bronze lg:hidden"
                >
                  <Menu className="h-[18px] w-[18px]" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* محتوا */}
        <main className="flex-1">
          {/* نوار بازگشت — در همهٔ زیرصفحه‌ها یکدست */}
        {current !== "home" && (
          <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
            <BackButton />
          </div>
        )}
        {route.view === "home" && <DashboardView />}
          {route.view === "course" && <CourseView id={route.id} />}
          {route.view === "learn" && <LearnView key={route.id} id={route.id} />}
          {route.view === "quiz" && <QuizView key={route.id ?? "mixed"} id={route.id} />}
          {route.view === "case" && <CaseStudyView id={route.id} />}
          {route.view === "cards" && <FlashcardsView />}
          {route.view === "progress" && <ProgressView />}
          {route.view === "settings" && <SettingsView />}
          {route.view === "import" && <ImportView />}
          {route.view === "teachers" && <TeachersView />}
          {route.view === "studio" && <StudioView />}
          {route.view === "post" && <PostView id={route.id} />}
          {route.view === "library" && <PublicLibraryView />}
          {route.view === "law" && <LawLibraryView id={route.id} />}
          {route.view === "teacher" && <TeacherProfileView id={route.id} />}
          {route.view === "admin" && <AdminView />}
        </main>

        {/* فوتر دسکتاپ */}
        <footer className="mt-auto hidden border-t border-border/70 py-4 text-center text-xs leading-relaxed text-muted-foreground lg:block">
          همیار حقوق — ابزار صرفاً آموزشی است و جایگزین مشاورهٔ حقوقی نیست · قانون مدنی © به پرسش‌ها پاسخ می‌دهد، پاسخ نهایی با قاضی است
        </footer>

        {/* داک شناور موبایل — شیشهٔ مایع (Liquid Glass) با شکست نور و حلقهٔ نور */}
        <svg aria-hidden className="hidden" width="0" height="0" focusable="false">
          <filter id="lg-displacement" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.011 0.02" numOctaves={2} seed={7} result="noise" />
            <feGaussianBlur in="noise" stdDeviation={1} result="soft" />
            <feDisplacementMap in="SourceGraphic" in2="soft" scale={62} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
        <nav
          aria-label="ناوبری پایین"
          className={`lg-dock fixed inset-x-3 bottom-2 z-40 rounded-[26px] transition-all duration-300 ease-out lg:hidden pb-[env(safe-area-inset-bottom)] ${
            chromeHidden ? "max-lg:pointer-events-none max-lg:translate-y-[160%] max-lg:opacity-0" : ""
          }`}
        >
          <div aria-hidden className="lg-refract" />
          <div aria-hidden className="lg-spec" />
          <div className="relative mx-auto grid max-w-md grid-cols-5 p-1">
            <DockBtn icon={Home} label="خانه" active={["home", "course"].includes(current)} onClick={() => go({ view: "home" })} />
            <DockBtn icon={BookOpen} label="تدریس" active={isSubPage} onClick={dockTadriss} />
            <DockBtn icon={ClipboardList} label="تست" active={current === "quiz"} onClick={() => go({ view: "quiz", id: last.lessonId })} />
            <DockBtn icon={LibraryBig} label="کتابخانه" active={["library", "law"].includes(current)} onClick={() => go({ view: "library" })} />
            <DockBtn icon={Menu} label="منو" active={false} onClick={() => setDrawerOpen(true)} />
          </div>
        </nav>

        {/* ═══ منوی کشویی موبایل — کامل معادل سایدبار دسکتاپ ═══ */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="right" className="flex w-[290px] flex-col gap-0 overflow-y-auto p-4 sm:w-[320px]">
            <SheetHeader className="p-0 pb-3 text-start">
              <SheetTitle className="flex items-center gap-2.5 text-base">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Scale className="h-4.5 w-4.5" /></span>
                منوی همیار حقوق
              </SheetTitle>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-1">
              <SideItem icon={Home} label="خانه" rail={false} active={current === "home"} onClick={() => go({ view: "home" })} />
              <SideItem
                icon={BookOpen}
                label="مطالعه"
                rail={false}
                active={["course", "learn", "case", "cards"].includes(current)}
                onClick={() => setDrawerStudy((v) => !v)}
                chevron
                open={drawerStudy}
              />
              {drawerStudy && (
                <div className="mb-1 space-y-1 border-s border-dashed border-border ps-2.5 pe-1 py-1">
                  <p className="px-2 pb-0.5 text-[10px] font-medium text-muted-foreground/70">درس‌های فعال</p>
                  {courses.length === 0 ? (
                    <p className="px-2 text-[11px] leading-relaxed text-muted-foreground/70">هنوز درسی فعال نیست؛ از کتابخانهٔ عمومی یکی را انتخاب کن.</p>
                  ) : (
                    courses.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => go({ view: "course", id: c.id })}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <CourseIcon icon={c.icon} className="h-3.5 w-3.5 shrink-0 text-bronze" />
                        <span className="min-w-0 flex-1 truncate text-start">{c.title}</span>
                        <span dir="ltr" className="shrink-0 text-[10px] tabular-nums opacity-70">{fa(lessonPctOf(c, progress))}%</span>
                      </button>
                    ))
                  )}
                </div>
              )}
              <SideItem icon={ClipboardList} label="تست" rail={false} active={current === "quiz"} onClick={() => go({ view: "quiz", id: last.lessonId })} />
              <SideItem icon={TrendingUp} label="پیشرفت" rail={false} active={current === "progress"} onClick={() => go({ view: "progress" })} />
              <SideItem icon={LibraryBig} label="کتابخانهٔ عمومی" rail={false} active={["library", "teacher"].includes(current)} onClick={() => go({ view: "library" })} />
              <SideItem icon={Landmark} label="کتابخانهٔ قوانین" rail={false} active={current === "law"} onClick={() => go({ view: "law" })} />
              <SideItem icon={GraduationCap} label="اساتید و مقالات" rail={false} active={["teachers", "post"].includes(current)} onClick={() => go({ view: "teachers" })} />
              {auth.user?.role === "teacher" && (
                <SideItem icon={PenSquare} label="اتاق استاد" rail={false} active={current === "studio"} onClick={() => go({ view: "studio" })} />
              )}
              {auth.user?.role === "admin" && (
                <>
                  <SideItem icon={Upload} label="افزودن کتاب" rail={false} active={current === "import"} onClick={() => go({ view: "import" })} />
                  <SideItem icon={ShieldCheck} label="پنل مدیریت" rail={false} active={current === "admin"} onClick={() => go({ view: "admin" })} />
                </>
              )}
              <SideItem icon={Settings} label="تنظیمات و پروفایل" rail={false} active={current === "settings"} onClick={() => go({ view: "settings" })} />
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-border/70 pt-3">
              <span className="text-[11px] text-muted-foreground">همیار حقوق</span>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <SyncHint collapsed />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
