"use client";

import * as React from "react";
import { RotateCcw, Check, BookX } from "lucide-react";
import type { Flashcard } from "@/lib/law/types";
import { builtinCourses } from "@/lib/law/courses";
import { useApp } from "@/lib/store";
import { mergeVisible } from "@/lib/books";
import { fa } from "@/lib/fa";

function buildDeck(): Flashcard[] {
  const st0 = useApp.getState();
  const courses = mergeVisible(st0);
  const deck: Flashcard[] = [];
  for (const c of courses) {
    for (const ch of c.chapters) {
      for (const l of ch.lessons) {
        // کارت‌های قانون: ماده ↔ متن
        for (const s of l.sections) {
          for (const law of s.law ?? []) {
            deck.push({ front: `متن مادهٔ ${law.no} (${law.source || "قانون"}) چیست؟`, back: law.text, lawRef: `${law.no}` });
          }
        }
        // کارت‌های جمع‌بندی
        const summary = l.sections.find((s) => s.type === "summary");
        if (summary?.bullets?.length) {
          deck.push({
            front: `از جلسهٔ «${l.title}»: ${summary.bullets[0].slice(0, 60)}… — ادامه؟`,
            back: summary.bullets.join("\n"),
          });
        }
      }
    }
  }
  return deck;
}

export function FlashcardsView() {
  const custom = useApp((s) => s.customCourses);
  const tBooks = useApp((s) => s.tBooks);
  const [deck, setDeck] = React.useState<Flashcard[]>([]);
  /** صف امروز: دنباله‌ای از اندیس‌های deck — کارت «مرور» به انتهای همین صف برمی‌گردد */
  const [order, setOrder] = React.useState<number[]>([]);
  const [pos, setPos] = React.useState(0);
  const [flipped, setFlipped] = React.useState(false);
  const [stats, setStats] = React.useState({ known: 0, review: 0 });

  React.useEffect(() => {
    const d = buildDeck();
    setDeck(d);
    setOrder(d.map((_, idx) => idx));
    setPos(0);
    setStats({ known: 0, review: 0 });
    void custom;
  }, [custom]);

  const finished = deck.length > 0 && pos >= order.length;

  function advance(known: boolean) {
    setFlipped(false);
    setStats((s) => ({ known: s.known + (known ? 1 : 0), review: s.review + (known ? 0 : 1) }));
    if (!known) setOrder((o) => [...o, o[pos]]); // تکرار واقعی «نیاز به مرور» در انتهای صف امروز
    setPos((p) => p + 1);
  }

  function restart() {
    setOrder(deck.map((_, idx) => idx));
    setPos(0);
    setStats({ known: 0, review: 0 });
    setFlipped(false);
  }

  if (deck.length === 0)
    return <div className="mx-auto max-w-xl px-4 py-20 text-center text-muted-foreground">کارت‌ها در حال آماده‌سازی هستند…</div>;

  const card = deck[order[Math.min(pos, order.length - 1)]];

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 px-4 pb-24 pt-8 sm:px-6">
      <header className="space-y-1 text-center">
        <h1 className="text-xl font-bold">مرور سریع با فلش‌کارت</h1>
        <p className="font-display text-sm text-muted-foreground">{finished ? "صف امروز تمام شد" : `کارت ${fa(pos + 1)} از ${fa(order.length)} — باقی‌مانده: ${fa(order.length - pos)}`} — بلدها: {fa(stats.known)} | نیازمند مرور: {fa(stats.review)}</p>
      </header>

      <div className="flip-scene h-80 cursor-pointer select-none" onClick={() => !finished && setFlipped(!flipped)}>
        {finished ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-4 border border-border bg-card p-8 text-center shadow-card">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-success/15 text-2xl text-success">✓</span>
            <p className="text-lg font-extrabold">صف مرور امروز تمام شد!</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{fa(order.length)} کارت مرور شد — بلدها: {fa(stats.known)} · نیازمند مرور دوباره: {fa(stats.review)}</p>
            <button onClick={restart} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-transform active:scale-[.97]">
              <RotateCcw className="h-4 w-4" /> شروع دوباره از اول
            </button>
          </div>
        ) : (
        <div className={`flip-inner h-full w-full ${flipped ? "flipped" : ""}`}>
          {/* روی کارت */}
          <div className="flip-face flex flex-col items-center justify-center gap-4 border border-border bg-card p-8 shadow-card">
            <span aria-hidden className="pointer-events-none absolute inset-3 rounded-xl border border-dashed border-bronze/25" />
            <span className="rounded-full border border-primary/25 bg-primary/10 px-4 py-1 font-display text-xs font-bold text-primary">سؤال</span>
            <p className="font-body relative z-10 max-h-44 overflow-y-auto px-2 text-center text-lg font-semibold leading-loose">{card.front}</p>
            <span className="absolute bottom-6 text-[11px] text-muted-foreground/70">برای دیدن پاسخ کلیک کن</span>
          </div>
          {/* پشت کارت */}
          <div className="flip-face flip-back flex flex-col items-center justify-center border border-bronze/40 bg-gradient-to-b from-bronze/[0.08] to-card p-6 shadow-card">
            <span aria-hidden className="pointer-events-none absolute inset-3 rounded-xl border border-dashed border-bronze/30" />
            <span className="mb-3 rounded-full border border-bronze/40 bg-bronze/15 px-4 py-1 font-display text-xs font-bold text-bronze">پاسخ استاد</span>
            <p className="font-body relative z-10 max-h-48 overflow-y-auto whitespace-pre-line text-center text-[16px] leading-loose">{card.back}</p>
          </div>
        </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-3">
        {finished ? (
          <p className="text-xs text-muted-foreground">فردا دوباره سر بزن — تکرار فاصله‌دار، کلید ماندگاری ماده‌ها در حافظه است.</p>
        ) : (
          <>
        <button onClick={() => { setFlipped(false); advance(true); }} aria-label="بلد بودم" className="inline-flex items-center gap-2 rounded-xl bg-success px-6 py-3 text-sm font-bold text-white transition-transform active:scale-[.97]">
          <Check className="h-4 w-4" /> بلد بودم
        </button>
        <button onClick={() => { setFlipped(false); advance(false); }} aria-label="نیاز به مرور دارم" className="inline-flex items-center gap-2 rounded-xl border border-warn bg-warn/10 px-6 py-3 text-sm font-bold text-warn transition-transform active:scale-[.97]">
          <BookX className="h-4 w-4" /> نیاز به مرور دارم
        </button>
          </>
        )}
        <button onClick={restart} aria-label="شروع مجدد" title="شروع مجدد" className="grid h-11 w-11 place-items-center rounded-xl border border-border text-muted-foreground hover:text-foreground">
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      <p className="text-center text-xs text-muted-foreground">کارتی که «مرور» علامت بخورد در انتهای صف امروز تکرار می‌شود؛ روش فاصله‌دار ساده.</p>
    </div>
  );
}
