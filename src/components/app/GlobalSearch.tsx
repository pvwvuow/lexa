"use client";

import * as React from "react";
import { Search, X, CornerDownLeft } from "lucide-react";
import { navigate } from "@/lib/router";
import { fa } from "@/lib/fa";
import { flatLessons } from "@/lib/law/types";
import type { Course } from "@/lib/law/types";
import { CourseIcon } from "./common";

/* ─── نرمال‌سازی متنی فارسی برای جستجو ─────────────────────────────────── */
function norm(s: string): string {
  return s
    .replace(/[ىي]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u064B-\u0652\u200c]/g, "")
    .replace(/[\u06F0-\u06F9\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) & 0xf))
    .toLowerCase();
}

interface Hit {
  courseId: string;
  courseTitle: string;
  icon?: string;
  chapterTitle: string;
  lessonId: string;
  lessonTitle: string;
  idx: number;
  total: number;
  score: number;
  snippet: string;
  at: number;
}

/** ساخت شاخص سبک از کل کتابخانه — یک‌بار به ازای تغییر آرایهٔ دوره‌ها */
function buildIndex(courses: Course[]) {
  const items: { c: Course; ch: string; l: { id: string; title: string }; flatIdx: number; total: number; hay: string; plain: string }[] = [];
  for (const c of courses) {
    const flats = flatLessons(c);
    const total = flats.length;
    flats.forEach(({ lesson, chapter }, i) => {
      let plain = `${lesson.title} ${chapter.title} ${c.title}`;
      for (const s of lesson.sections) {
        if (s.title) plain += ` ${s.title}`;
        if (s.body) plain += ` ${s.body}`;
        if (s.bullets) plain += ` ${s.bullets.join(" ")}`;
        if (s.law) for (const w of s.law) plain += ` ماده ${w.no} ${w.text}`;
        if (s.table) for (const r of s.table.rows) plain += ` ${r.join(" ")}`;
        if (s.questionText) plain += ` ${s.questionText}`;
      }
      for (const q of lesson.quiz.slice(0, 3)) plain += ` ${q.q}`;
      plain = plain.replace(/\s+/g, " ");
      items.push({ c, ch: chapter.title, l: { id: lesson.id, title: lesson.title }, flatIdx: i, total, hay: norm(plain), plain });
    });
  }
  return items;
}

export function GlobalSearch({ courses }: { courses: Course[] }) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [cursor, setCursor] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [index, setIndex] = React.useState<ReturnType<typeof buildIndex> | null>(null);
  React.useEffect(() => {
    setIndex(null);
  }, [courses]);

  /* میانبرهای کیبورد: / یا Ctrl+K باز میکند؛ Esc میبندد */
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (!typing && ((e.key === "/" && !e.ctrlKey && !e.metaKey) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k"))) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    if (open) {
      setQ("");
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 40);
      if (!index) setIndex(buildIndex(courses));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const hits: Hit[] = React.useMemo(() => {
    const tokens = q.trim().split(/\s+/).filter(Boolean).map(norm);
    if (!index || tokens.length === 0) return [];
    const out: Hit[] = [];
    for (const it of index) {
      let ok = true;
      let sc = 0;
      for (const tk of tokens) {
        const i = it.hay.indexOf(tk);
        if (i === -1) { ok = false; break; }
        sc += 1 + Math.min((it.hay.split(tk).length - 1), 4);
      }
      if (!ok) continue;
      const nt = norm(it.l.title);
      for (const tk of tokens) if (nt.includes(tk)) sc += 3;
      // برش قطعهٔ متن
      const firstTok = norm(q.trim().split(/\s+/)[0] ?? "");
      let at = it.hay.indexOf(firstTok);
      if (at > it.plain.length) at = 0;
      const start = Math.max(0, at - 38);
      const raw = it.plain.slice(start, start + 130);
      out.push({
        courseId: it.c.id, courseTitle: it.c.title, icon: it.c.icon,
        chapterTitle: it.ch, lessonId: it.l.id, lessonTitle: it.l.title,
        idx: it.flatIdx + 1, total: it.total,
        score: sc, snippet: (start > 0 ? "…​" : "") + raw.trim() + (start + 130 < it.plain.length ? "…" : ""), at,
      });
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, 24);
  }, [q, index]);

  function go(h: Hit) {
    setOpen(false);
    navigate({ view: "learn", id: h.lessonId });
  }

  function onKeyDownList(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((v) => Math.min(v + 1, hits.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((v) => Math.max(v - 1, 0)); }
    else if (e.key === "Enter" && hits[cursor]) { e.preventDefault(); go(hits[cursor]); }
  }

  function hl(text: string): React.ReactNode[] {
    const tokens = q.trim().split(/\s+/).filter((t) => t.length >= 2);
    if (tokens.length === 0) return [text];
    const rx = new RegExp("(" + tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "gi");
    return text.split(rx).map((part, i) =>
      rx.test(part) ? (
        <mark key={i} className="rounded-[4px] bg-bronze/20 px-0.5 text-bronze">{part}</mark>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      ),
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="جستجو در کتابخانه"
        title="جستجو در کتابخانه (/)"
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-muted-foreground shadow-card transition-colors hover:text-bronze"
      >
        <Search className="h-[17px] w-[17px]" />
        <span className="hidden text-xs font-medium md:inline">جستجو…</span>
        <kbd dir="ltr" className="hidden rounded-md border border-border bg-muted px-1.5 py-0.5 font-display text-[10px] leading-none opacity-80 lg:inline">/</kbd>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="جستجوی سراسری"
          className="fixed inset-0 z-[60] flex items-start justify-center bg-background/70 p-4 pt-[12vh] backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            {/* ورودی */}
            <div className="flex items-center gap-2 border-b border-border/70 px-4">
              <Search className="h-4 w-4 shrink-0 text-bronze" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => { setQ(e.target.value); setCursor(0); }}
                onKeyDown={onKeyDownList}
                placeholder="در همهٔ جزوات بگرد؛ مثلاً «دفاع مشروع» یا «مادهٔ ۶۸۴»…"
                className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
              />
              <button onClick={() => setOpen(false)} aria-label="بستن" className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* نتایج */}
            <div className="max-h-[52vh] overflow-y-auto p-1.5" dir="rtl">
              {q.trim() === "" ? (
                <p className="px-3 py-6 text-center text-xs leading-6 text-muted-foreground">
                  کلِ ۴ جزوه، همهٔ جلسه‌ها، مواد قانونی، جداول و سؤال‌ها اینجا فهرست شده‌اند.<br />
                  یک عبارت بنویس تا دقیقاً همان جلسه را پیدا کنی.
                </p>
              ) : hits.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">چیزی پیدا نشد؛ با کلمهٔ دیگری امتحان کن.</p>
              ) : (
                <ul role="listbox" aria-label="نتیجه‌ها" className="space-y-0.5">
                  {hits.map((h, i) => (
                    <li key={h.lessonId}>
                      <button
                        onMouseEnter={() => setCursor(i)}
                        onClick={() => go(h)}
                        aria-selected={i === cursor}
                        role="option"
                        className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-start transition-colors ${
                          i === cursor ? "bg-primary/10" : "hover:bg-muted"
                        }`}
                      >
                        <CourseIcon icon={h.icon} className="mt-0.5 h-4 w-4 shrink-0 text-bronze" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2">
                            <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-foreground">{hl(h.lessonTitle)}</span>
                            <span dir="ltr" className="shrink-0 font-display text-[10px] tabular-nums text-muted-foreground">{fa(h.idx)}/{fa(h.total)}</span>
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-bronze">{h.courseTitle} · {h.chapterTitle}</span>
                          <span className="mt-1 block line-clamp-2 text-[11.5px] leading-5 text-muted-foreground">{hl(h.snippet)}</span>
                        </span>
                        {i === cursor && <CornerDownLeft className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* پانویس */}
            <div className="flex items-center justify-between border-t border-border/70 px-4 py-2 text-[10.5px] text-muted-foreground">
              <span>بالا/پایین برای حرکت · Enter برای رفتن</span>
              <span dir="ltr" className="font-display tabular-nums">Esc</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
