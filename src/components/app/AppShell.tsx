"use client";

import * as React from "react";
import { Home, BookOpen, ClipboardList, TrendingUp, Settings, Upload, Scale } from "lucide-react";
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

function NavBtn({ icon: Icon, label, active, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all duration-200 lg:flex-row ${
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Icon className="h-[17px] w-[17px]" />
      {label}
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

  React.useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="flex items-center gap-3 text-bronze"><Scale className="h-6 w-6 animate-pulse" /><span className="font-bold">همیار حقوق</span></div>
      </div>
    );
  }

  const current = route.view;
  const isSubPage = ["learn", "quiz", "case"].includes(current);

  function go(r: Route) {
    navigate(r);
  }

  return (
    <>
      {/* هدر با خط طلایی امضایی */}
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

          {!isSubPage && (
            <nav aria-label="ناوبری اصلی" className="ms-auto hidden items-center gap-0.5 lg:flex">
              <NavBtn icon={Home} label="خانه" active={current === "home"} onClick={() => go({ view: "home" })} />
              <NavBtn icon={BookOpen} label="مطالعه" active={current === "course"} onClick={() => go({ view: "course", id: "madani-1" })} />
              <NavBtn icon={ClipboardList} label="تست" active={current === "quiz"} onClick={() => go({ view: "quiz", id: last.lessonId })} />
              <NavBtn icon={TrendingUp} label="پیشرفت" active={current === "progress"} onClick={() => go({ view: "progress" })} />
              <NavBtn icon={Upload} label="افزودن کتاب" active={current === "import"} onClick={() => go({ view: "import" })} />
            </nav>
          )}

          <div className={`flex items-center gap-1.5 ${isSubPage ? "ms-auto" : "ms-auto lg:ms-2"}`}>
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
    </>
  );
}
