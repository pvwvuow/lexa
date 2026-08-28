"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false}>
      {children}
    </NextThemesProvider>
  );
}

/* ─── کلید روز/شب — قرص کشویی با خورشید و ماه ─────────────────────────────── */
export function ThemeToggle() {
  const [mounted, setMounted] = React.useState(false);
  const [isDark, setIsDark] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);
  const toggle = () => {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setIsDark(next);
  };

  return (
    <button
      onClick={toggle}
      role="switch"
      aria-checked={mounted && isDark}
      aria-label="تغییر حالت روشن و تاریک"
      title={mounted && isDark ? "حالت روشن" : "حالت تاریک"}
      className={`relative inline-flex h-8 w-[58px] shrink-0 items-center rounded-full border shadow-card transition-colors duration-300 ${
        mounted && isDark
          ? "border-indigo-300/25 bg-gradient-to-l from-[#1e2a4a] to-[#141d33]"
          : "border-amber-300/40 bg-gradient-to-l from-amber-100 to-sky-100"
      }`}
    >
      {/* دو آیکن ثابت داخل قرص */}
      <Sun className={`absolute start-1.5 h-4 w-4 transition-all duration-300 ${mounted && isDark ? "scale-75 text-white/30" : "rotate-0 text-amber-500"}`} />
      <Moon className={`absolute end-1.5 h-4 w-4 transition-all duration-300 ${mounted && isDark ? "rotate-0 text-indigo-200" : "scale-75 text-slate-400/50"}`} />

      {/* دستگیرهٔ کشویی */}
      <span
        aria-hidden
        className={`absolute top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full shadow-md transition-all duration-300 ${
          mounted && isDark
            ? "start-[calc(100%-1.75rem)] bg-[#27355c]"
            : "start-1 bg-white"
        }`}
      >
        {mounted && isDark ? (
          <Moon className="h-3.5 w-3.5 text-indigo-100" />
        ) : (
          <Sun className="h-3.5 w-3.5 text-amber-500" />
        )}
      </span>
    </button>
  );
}
