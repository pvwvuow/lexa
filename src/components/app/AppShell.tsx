"use client";

import * as React from "react";
import {
  Home, BookOpen, ClipboardList, TrendingUp, Settings, Upload, Scale,
  PanelRightClose, PanelRightOpen, ChevronsLeft, ChevronsRight,
} from "lucide-react";
import { useRoute, navigate, type Route } from "@/lib/router";
import { useApp } from "@/lib/store";
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

type NavMode = "expanded" | "rail" | "hidden";

/** آیتم منوی ستونی — در حالت نوار باریک فقط آیکون با تولتیپ */
function SideItem({
  icon: Icon, label, active, rail, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; active?: boolean; rail: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
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
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-5 w-5" />
      {label}
      {active && <span aria-hidden className="absolute -top-px h-0.5 w-6 rounded-full bg-gradient-to-l from-bronze to-primary" />}
    </button>
  );
}

export function AppShell() {
  const route = useRoute();
  const last = useApp((s) => s.lastLocation);
  const [mounted, setMounted] = React.useState(false);

  // منوی ستونی دسکتاپ: باز / نوار باریک / مخفی — فقط «مخفی» ماندگار ذخیره می‌شود
  const [mode, setMode] = React.useState<NavMode>("expanded");

  React.useEffect(() => {
    setMounted(true);
    try {
      if (window.localStorage.getItem("hh-nav") === "hidden") setMode("hidden");
    } catch {}
  }, []);

  const isSubPage = ["learn", "quiz", "case"].includes(route.view);

  // در زیرصفحه‌ها منو خودکار جمع می‌شود تا تمرکز روی محتوا بماند
  React.useEffect(() => {
    if (!mounted) return;
    setMode((m) => (m === "hidden" ? "hidden" : isSubPage ? "rail" : "expanded"));
  }, [isSubPage, mounted]);

  function expandNav() { setMode("expanded"); }
  function collapseNav() { setMode("rail"); }
  function hideNav() {
    setMode("hidden");
    try { window.localStorage.setItem("hh-nav", "hidden"); } catch {}
  }
  function restoreNav() {
    setMode("expanded");
    try { window.localStorage.setItem("hh-nav", "open"); } catch {}
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
    navigate(r);
  }

  // ─── سایدبار ستونی سمت راست (دسکتاپ) ───
  const Sidebar = mode !== "hidden" && (
    <aside
      className={`sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-e border-border/70 bg-card/50 backdrop-blur-sm transition-[width] duration-200 ease-out lg:flex ${
        rail ? "w-[76px]" : "w-[228px]"
      }`}
    >
      <nav aria-label="ناوبری اصلی" className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        <SideItem icon={Home} label="خانه" rail={rail} active={current === "home"} onClick={() => go({ view: "home" })} />
        <SideItem icon={BookOpen} label="مطالعه" rail={rail} active={["course", "learn", "case", "cards"].includes(current)} onClick={() => go({ view: "course", id: "madani-1" })} />
        <SideItem icon={ClipboardList} label="تست" rail={rail} active={current === "quiz"} onClick={() => go({ view: "quiz", id: last.lessonId })} />
        <SideItem icon={TrendingUp} label="پیشرفت" rail={rail} active={current === "progress"} onClick={() => go({ view: "progress" })} />
        <SideItem icon={Upload} label="افزودن کتاب" rail={rail} active={current === "import"} onClick={() => go({ view: "import" })} />
      </nav>

      <div className="space-y-1 border-t border-border/70 p-3">
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
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronsRight className="h-[18px] w-[18px] shrink-0" />
            جمع کردن منو
          </button>
        )}
        <button
          onClick={hideNav}
          title="پنهان کردن منو"
          aria-label="پنهان کردن منو"
          className={`w-full items-center gap-2.5 rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-bronze ${
            rail ? "grid h-10 place-items-center" : "flex px-3 py-2.5 text-sm font-medium"
          }`}
        >
          <PanelRightClose className="h-[18px] w-[18px] shrink-0" />
          {!rail && <span>پنهان کردن</span>}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen">
      {Sidebar}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* هدر — لوگو راست، ابزارها چپ */}
        <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-[-1px] h-px bg-gradient-to-l from-transparent via-bronze/60 to-transparent" />
          <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6">
            <button onClick={() => go({ view: "home" })} className="group flex items-center gap-2.5">
              <span className="relative grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-card transition-transform duration-200 group-hover:scale-[1.04]">
                <Scale className="h-5 w-5" />
                <span aria-hidden className="absolute -bottom-1 -end-1 grid h-3.5 w-3.5 place-items-center rounded-full border-2 border-background bg-bronze" />
              </span>
              <span className="leading-tight">
                <span className="block text-base font-bold tracking-tight">همیار حقوق</span>
                <span className="block text-[10px] font-medium text-bronze">استاد حقوقی هوشمند</span>
              </span>
            </button>

            <div className="flex items-center gap-1.5 ms-auto">
              {mode === "hidden" && (
                <button
                  onClick={restoreNav}
                  aria-label="نمایش منوی کنار"
                  title="نمایش منو"
                  className="hidden h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-card transition-colors hover:text-bronze lg:inline-flex"
                >
                  <PanelRightOpen className="h-[18px] w-[18px]" />
                </button>
              )}
              <ThemeToggle />
              <button
                onClick={() => go({ view: "settings" })}
                aria-label="تنظیمات هوش مصنوعی"
                title="تنظیمات هوش مصنوعی"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-card transition-colors hover:text-bronze"
              >
                <Settings className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
        </header>

        {/* محتوا */}
        <main className="flex-1">
          {route.view === "home" && <DashboardView />}
          {route.view === "course" && <CourseView id={route.id} />}
          {route.view === "learn" && <LearnView key={route.id} id={route.id} />}
          {route.view === "quiz" && <QuizView key={route.id ?? "mixed"} id={route.id} />}
          {route.view === "case" && <CaseStudyView id={route.id} />}
          {route.view === "cards" && <FlashcardsView />}
          {route.view === "progress" && <ProgressView />}
          {route.view === "settings" && <SettingsView />}
          {route.view === "import" && <ImportView />}
        </main>

        {/* فوتر دسکتاپ */}
        <footer className="mt-auto hidden border-t border-border/70 py-4 text-center text-xs leading-relaxed text-muted-foreground lg:block">
          همیار حقوق — ابزار صرفاً آموزشی است و جایگزین مشاورهٔ حقوقی نیست · قانون مدنی © به پرسش‌ها پاسخ می‌دهد، پاسخ نهایی با قاضی است
        </footer>

        {/* داک شناور موبایل */}
        <nav aria-label="ناوبری پایین" className="fixed inset-x-3 bottom-2 z-40 rounded-2xl border border-border/80 bg-card/95 shadow-card backdrop-blur-md lg:hidden pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto grid max-w-md grid-cols-4 p-1">
            <DockBtn icon={Home} label="خانه" active={["home", "course"].includes(current)} onClick={() => go({ view: "home" })} />
            <DockBtn icon={BookOpen} label="تدریس" active={isSubPage} onClick={() => go(last.lessonId ? { view: "learn", id: last.lessonId } : { view: "course", id: "madani-1" })} />
            <DockBtn icon={ClipboardList} label="تست" active={current === "quiz"} onClick={() => go(last.lessonId ? { view: "quiz", id: last.lessonId } : { view: "cards" })} />
            <DockBtn icon={TrendingUp} label="پیشرفت" active={current === "progress"} onClick={() => go({ view: "progress" })} />
          </div>
        </nav>
      </div>
    </div>
  );
}
