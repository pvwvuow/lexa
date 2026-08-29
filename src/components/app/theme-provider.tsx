"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { Sun, Moon, Droplets } from "lucide-react";

/* ─── سیستم تم سه‌حالته: روز / شب / شیشه‌ای (liquid glass کامل) ──────────────
   - «شب» با کلاس dark روی html (مثل قبل)
   - «شیشه‌ای» با کلاس theme-glass روی html — پالت روشنِ شفاف + والپاپر آۆرایی
   - کلید hh-theme در localStorage منبع حقیقت است؛ کلید theme (next-themes)
     همگام نگه داشته می‌شود تا toast ها و اسکریپت اولیه هم一致 بمانند. */

export type AppTheme = "light" | "dark" | "glass";

const THEME_KEY = "hh-theme";

export function readStoredTheme(): AppTheme {
  try {
    const t = localStorage.getItem(THEME_KEY) ?? localStorage.getItem("theme");
    if (t === "dark") return "dark";
    if (t === "glass") return "glass";
    return "light";
  } catch {
    return "light";
  }
}

export function applyTheme(t: AppTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", t === "dark");
  root.classList.toggle("theme-glass", t === "glass");
  try {
    localStorage.setItem(THEME_KEY, t);
    // next-themes و sonner فقط روز/شب می‌فهمند — شیشه‌ای از خانوادهٔ روشن است
    localStorage.setItem("theme", t === "dark" ? "dark" : "light");
  } catch {}
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false}>
      {children}
    </NextThemesProvider>
  );
}

/**
 * دکمهٔ تم طلایی — طراحی گرادیانیِ بازسازی‌شدهٔ ۶ شهریور
 * قرص طلایی برند با خورشید/ماه/قطره، جابه‌جایی نرم چرخشی؛ در هدر و منوی موبایل.
 * رفتار: چرخهٔ سه‌حالته روز → شب → شیشه‌ای → روز (درخواست کاربر: سوییچ بین هر ۳ تم، نه فقط روز و شب).
 */

const THEME_ORDER: AppTheme[] = ["light", "dark", "glass"];

const NEXT_THEME_LABEL: Record<AppTheme, string> = {
  light: "رفتن به حالت شب",
  dark: "رفتن به حالت شیشه‌ای",
  glass: "رفتن به حالت روز",
};
export function ThemeToggle() {
  const [mounted, setMounted] = React.useState(false);
  const [theme, setTheme] = React.useState<AppTheme>("light");
  React.useEffect(() => {
    setMounted(true);
    setTheme(readStoredTheme());
  }, []);
  const toggle = () => {
    const next = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
    applyTheme(next);
    setTheme(next);
  };
  const isDark = mounted && theme === "dark";
  const isGlass = mounted && theme === "glass";
  return (
    <button
      onClick={toggle}
      aria-label="تغییر تم برنامه (روز، شب، شیشه‌ای)"
      title={mounted ? NEXT_THEME_LABEL[theme] : "تغییر تم"}
      className="group relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#ecd29a] via-[#cda65e] to-[#8a6a30] text-[#1b1408] shadow-[0_3px_12px_-3px_rgba(205,166,94,0.65),inset_0_1px_0_rgba(255,255,255,0.5)] outline-none ring-1 ring-[#f6e7c1]/70 transition-all duration-300 hover:shadow-[0_5px_18px_-3px_rgba(205,166,94,0.85),inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-[1.06] focus-visible:ring-2 focus-visible:ring-white/80 active:scale-95"
    >
      {/* برق شیشه‌ای روی گرادیان طلایی */}
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/40 via-white/5 to-black/15" />
      <span aria-hidden className="pointer-events-none absolute -top-1/2 start-[-20%] h-[180%] w-2/3 rotate-12 bg-white/25 blur-[6px] transition-transform duration-500 group-hover:translate-x-[120%]" />
      {/* خورشید/ماه/قطره — تعویض چرخشی نرم */}
      <span className="relative block h-[18px] w-[18px]">
        <Sun
          className={`absolute inset-0 h-[18px] w-[18px] transition-all duration-500 ease-out ${
            mounted && isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"
          }`}
        />
        <Moon
          className={`absolute inset-0 h-[18px] w-[18px] transition-all duration-500 ease-out ${
            mounted && !isDark && !isGlass ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-50 opacity-0"
          }`}
        />
        <Droplets
          className={`absolute inset-0 h-[18px] w-[18px] transition-all duration-500 ease-out ${
            mounted && isGlass ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-50 opacity-0"
          }`}
        />
      </span>
    </button>
  );
}
