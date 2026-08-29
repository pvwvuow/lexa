"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { Sun, Moon } from "lucide-react";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false}>
      {children}
    </NextThemesProvider>
  );
}

/**
 * دکمهٔ روز و شب — طراحی طلاییِ گرادیانی (بازسازی طرح ۶ شهریور)
 * قرص طلایی برند با خورشید/ماه، جابه‌جایی نرم چرخشی؛ در هدر و منوی موبایل.
 */
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
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
    setIsDark(next);
  };
  return (
    <button
      onClick={toggle}
      aria-label="تغییر حالت روشن و تاریک"
      title={mounted && isDark ? "رفتن به حالت روز" : "رفتن به حالت شب"}
      className="group relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#ecd29a] via-[#cda65e] to-[#8a6a30] text-[#1b1408] shadow-[0_3px_12px_-3px_rgba(205,166,94,0.65),inset_0_1px_0_rgba(255,255,255,0.5)] outline-none ring-1 ring-[#f6e7c1]/70 transition-all duration-300 hover:shadow-[0_5px_18px_-3px_rgba(205,166,94,0.85),inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-[1.06] focus-visible:ring-2 focus-visible:ring-white/80 active:scale-95"
    >
      {/* برق شیشه‌ای روی گرادیان طلایی */}
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/40 via-white/5 to-black/15" />
      <span aria-hidden className="pointer-events-none absolute -top-1/2 start-[-20%] h-[180%] w-2/3 rotate-12 bg-white/25 blur-[6px] transition-transform duration-500 group-hover:translate-x-[120%]" />
      {/* خورشید/ماه — تعویض چرخشی نرم */}
      <span className="relative block h-[18px] w-[18px]">
        <Sun
          className={`absolute inset-0 h-[18px] w-[18px] transition-all duration-500 ease-out ${
            mounted && isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"
          }`}
        />
        <Moon
          className={`absolute inset-0 h-[18px] w-[18px] transition-all duration-500 ease-out ${
            mounted && isDark ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"
          }`}
        />
      </span>
    </button>
  );
}
