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
      className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-colors lg:flex-row lg:rounded-lg lg:text-sm ${active ? "text-bronze" : "text-muted-foreground hover:text-foreground"}`}
    >
      <Icon className={`h-5 w-5 ${active ? "" : ""}`} />
      {label}
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
      {/* هدر */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:px-6">
          <button onClick={() => go({ view: "home" })} className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Scale className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-[15px] font-bold">همیار حقوق</span>
              <span className="block text-[10px] text-muted-foreground">استاد حقوقی هوشمند</span>
            </span>
          </button>

          {!isSubPage && (
            <nav aria-label="ناوبری اصلی" className="ms-auto hidden items-center gap-1 lg:flex">
              <NavBtn icon={Home} label="خانه" active={current === "home"} onClick={() => go({ view: "home" })} />
              <NavBtn icon={BookOpen} label="مطالعه" active={current === "course"} onClick={() => go({ view: "course", id: "madani-1" })} />
              <NavBtn icon={ClipboardList} label="تست" active={current === "quiz"} onClick={() => go({ view: "quiz", id: last.lessonId })} />
              <NavBtn icon={TrendingUp} label="پیشرفت" active={current === "progress"} onClick={() => go({ view: "progress" })} />
              <NavBtn icon={Upload} label="افزودن کتاب" active={current === "import"} onClick={() => go({ view: "import" })} />
            </nav>
          )}

          <div className="flex items-center gap-1.5 ms-auto lg:ms-0">
            <ThemeToggle />
            <button
              onClick={() => go({ view: "settings" })}
              aria-label="تنظیمات هوش مصنوعی"
              title="تنظیمات هوش مصنوعی"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
            >
              <Settings className="h-4 w-4" />
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
      <footer className="mt-auto hidden border-t border-border/70 py-3 text-center text-xs text-muted-foreground lg:block">
        همیار حقوق — ابزار صرفاً آموزشی است و جایگزین مشاورهٔ حقوقی نیست · قانون مدنی © به پرسش‌ها پاسخ می‌دهد، پاسخ نهایی با قاضی است
      </footer>

      {/* ناوبری پایین موبایل */}
      <nav aria-label="ناوبری پایین" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur lg:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-md grid-cols-4 py-1">
          <NavBtn icon={Home} label="خانه" active={["home", "course"].includes(current)} onClick={() => go({ view: "home" })} />
          <NavBtn icon={BookOpen} label="تدریس" active={isSubPage} onClick={() => go(last.lessonId ? { view: "learn", id: last.lessonId } : { view: "course", id: "madani-1" })} />
          <NavBtn icon={ClipboardList} label="تست" active={false} onClick={() => go(last.lessonId ? { view: "quiz", id: last.lessonId } : { view: "cards" })} />
          <NavBtn icon={TrendingUp} label="پیشرفت" active={current === "progress"} onClick={() => go({ view: "progress" })} />
        </div>
      </nav>
    </>
  );
}
