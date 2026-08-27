"use client";

import * as React from "react";
import { Search, X, CornerDownLeft, GraduationCap, BookOpenText, Landmark } from "lucide-react";
import { navigate } from "@/lib/router";
import { fa } from "@/lib/fa";
import { flatLessons } from "@/lib/law/types";
import type { Course } from "@/lib/law/types";
import { LAW_CODES, allLawArticles, type LawCode } from "@/lib/law/statutes";
import { CourseIcon, UserAvatar } from "./common";

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

/** نتیجهٔ استاد برای «جستجوی اسم استاد» */
interface TeacherHit {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string | null;
  followers: number;
  postsCount: number;
  coursesCount: number;
  score: number;
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

/** نتیجهٔ مادهٔ قانونی از کتابخانهٔ قوانین */
interface LawHit {
  lawId: string;
  lawTitle: string;
  icon: string;
  book: string;
  chapter: string;
  no: string;
  text: string;
  score: number;
  snippet: string;
}

/** شاخص سبک قوانین — یک‌بار ساخته می‌شود و همیشه در حافظه می‌ماند */
interface LawIndexItem { law: LawCode; no: string; text: string; book: string; chapter: string; hay: string; plain: string }
let LAW_INDEX: LawIndexItem[] | null = null;
function buildLawIndex(): LawIndexItem[] {
  if (LAW_INDEX) return LAW_INDEX;
  const items: LawIndexItem[] = [];
  for (const { law, article, book, chapter } of allLawArticles()) {
    const plain = `${article.text}`.replace(/\s+/g, " ");
    items.push({ law, no: article.no, text: article.text, book, chapter, hay: norm(`${law.title} ماده ${article.no} ${plain}`), plain });
  }
  LAW_INDEX = items;
  return items;
}

export function GlobalSearch({ courses }: { courses: Course[] }) {
  const [open, setOpen] = React.useState(false);
  const [rawQ, setRawQ] = React.useState("");
  // ورودی دیبانس می‌شود تا تایپ روان بماند
  const [q, setQ] = React.useState("");
  const [cursor, setCursor] = React.useState(0);
  const [indexReady, setIndexReady] = React.useState(false);
  const [teachersLoading, setTeachersLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQ(rawQ), 110);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [rawQ]);

  // ── اساتید (برای جستجوی اسم استاد)؛ مهمان هم آزاد است ──
  const [teachers, setTeachers] = React.useState<
    { id: string; displayName: string; username: string; avatarUrl?: string | null; followers: number; posts: number; courses: number }[]
  >([]);

  const [index, setIndex] = React.useState<ReturnType<typeof buildIndex> | null>(null);
  const [lawIndex, setLawIndex] = React.useState<ReturnType<typeof buildLawIndex> | null>(null);

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

  // آماده‌سازی شاخص به صورت غیرمسدودکننده پس از باز شدن
  React.useEffect(() => {
    if (!open) return;
    setRawQ("");
    setQ("");
    setCursor(0);
    setIndex(null);
    setIndexReady(false);
    setTimeout(() => inputRef.current?.focus(), 40);
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback
      ?? ((cb: () => void) => window.setTimeout(cb, 120));
    idle(() => {
      setIndex(buildIndex(courses));
      setLawIndex(buildLawIndex());
      setIndexReady(true);
    });
    setTeachersLoading(true);
    fetch("/api/social/suggestions")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { teachers?: typeof teachers } | null) => {
        if (d?.teachers) setTeachers(d.teachers);
      })
      .catch(() => {})
      .finally(() => setTeachersLoading(false));
     
  }, [open]);

  const hits: Hit[] = React.useMemo(() => {
    if (!indexReady || !index) return [];
    const tokens = q.trim().split(/\s+/).filter(Boolean).map(norm);
    if (tokens.length === 0) return [];
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
        score: sc, snippet: (start > 0 ? "…" : "") + raw.trim() + (start + 130 < it.plain.length ? "…" : ""), at,
      });
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, 24);
  }, [q, index, indexReady]);

  /** مطابقت اساتید با عبارت — تطابق نام نمایشی/یوزرنیم؛ محبوبیت بیک سردسته */
  const teacherHits: TeacherHit[] = React.useMemo(() => {
    const tokens = q.trim().split(/\s+/).filter(Boolean).map(norm);
    if (tokens.length === 0 || teachers.length === 0) return [];
    const out: TeacherHit[] = [];
    for (const t of teachers) {
      const nameHay = norm(`${t.displayName} ${t.username}`);
      let ok = true;
      let sc = 0;
      for (const tk of tokens) {
        if (nameHay.includes(tk)) sc += 4;
        else { ok = false; break; }
      }
      if (!ok) continue;
      out.push({
        id: t.id, displayName: t.displayName, username: t.username,
        avatarUrl: t.avatarUrl ?? null, followers: t.followers,
        postsCount: t.posts, coursesCount: t.courses,
        score: sc + Math.min(t.followers, 12),
      });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 6);
  }, [q, teachers]);

  /** مطابقت مواد قوانین با عبارت — از کتابخانهٔ قوانین */
  const lawHits: LawHit[] = React.useMemo(() => {
    const tokens = q.trim().split(/\s+/).filter(Boolean).map(norm);
    if (tokens.length === 0 || !lawIndex) return [];
    const out: LawHit[] = [];
    for (const it of lawIndex) {
      let ok = true;
      let sc = 0;
      for (const tk of tokens) {
        const i = it.hay.indexOf(tk);
        if (i === -1) { ok = false; break; }
        sc += 1 + Math.min((it.hay.split(tk).length - 1), 4);
      }
      if (!ok) continue;
      // تطبیق شمارهٔ ماده وزن بالا دارد (مثل «۲۲۰» یا «ماده ۲۲۰»)
      if (norm(`ماده ${it.no}`).includes(tokens.join(" "))) sc += 6;
      const firstTok = tokens[0];
      let at = it.hay.indexOf(firstTok);
      if (at > it.plain.length) at = 0;
      const start = Math.max(0, at - 42);
      const raw = it.plain.slice(start, start + 150);
      out.push({
        lawId: it.law.id, lawTitle: it.law.title, icon: it.law.icon,
        book: it.book, chapter: it.chapter, no: it.no, text: it.text,
        score: sc, snippet: (start > 0 ? "…" : "") + raw.trim() + (start + 150 < it.plain.length ? "…" : ""),
      });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 8);
  }, [q, lawIndex]);

  type FlatHit = { kind: "teacher"; t: TeacherHit } | { kind: "law"; h: LawHit } | { kind: "lesson"; h: Hit };
  const flat: FlatHit[] = React.useMemo(
    () => [
      ...teacherHits.map((t) => ({ kind: "teacher" as const, t })),
      ...lawHits.map((h) => ({ kind: "law" as const, h })),
      ...hits.map((h) => ({ kind: "lesson" as const, h })),
    ],
    [teacherHits, lawHits, hits],
  );

  function go(item: FlatHit) {
    setOpen(false);
    if (item.kind === "teacher") navigate({ view: "teacher", id: item.t.id });
    else if (item.kind === "law") navigate({ view: "law", id: item.h.lawId });
    else navigate({ view: "learn", id: item.h.lessonId });
  }

  function onKeyDownList(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((v) => Math.min(v + 1, Math.max(0, flat.length - 1))); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((v) => Math.max(v - 1, 0)); }
    else if (e.key === "Enter" && flat[cursor]) { e.preventDefault(); go(flat[cursor]); }
  }

  // نشانگر صفحه‌کلید همیشه در دید باشد
  React.useEffect(() => {
    const el = listRef.current?.querySelector('[aria-selected="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  function hl(text: string): React.ReactNode[] {
    const tokens = q.trim().split(/\s+/).filter((t) => t.length >= 2);
    if (tokens.length === 0) return [text];
    const rx = new RegExp("(" + tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "gi");
    return text.split(rx).map((part, i) =>
      rx.test(part) ? (
        <mark key={i} className="rounded-[4px] bg-bronze/20 px-0.5 font-bold text-bronze">{part}</mark>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      ),
    );
  }

  const busy = (!indexReady || rawQ !== q) && true;
  const hasQuery = rawQ.trim().length > 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="جستجو در کتابخانه و اساتید"
        title="جستجو در کتابخانه و اساتید (/)"
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
          className="fixed inset-0 z-[60] flex items-end justify-center bg-background/70 p-0 backdrop-blur-sm sm:items-start sm:p-4 sm:pt-[12vh]"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-card sm:max-h-[70vh] sm:rounded-2xl">
            {/* ورودی */}
            <div className="flex items-center gap-2 border-b border-border/70 px-4 transition-colors focus-within:border-bronze/50">
              <Search className="h-4 w-4 shrink-0 text-bronze" />
              <input
                ref={inputRef}
                value={rawQ}
                onChange={(e) => { setRawQ(e.target.value); setCursor(0); }}
                onKeyDown={onKeyDownList}
                placeholder="جلسه، ماده یا اسم استاد…"
                className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
              />
              {(busy || teachersLoading) && hasQuery && (
                <span aria-hidden className="h-4 w-4 shrink-0 animate-pulse rounded-full bg-bronze/30" />
              )}
              <button onClick={() => setOpen(false)} aria-label="بستن" className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* بدنه */}
            <div ref={listRef} dir="rtl" className="min-h-0 flex-1 overflow-y-auto p-1.5">
              {/* حالت خالی: راهنما + دسترسی سریع به اساتید (چیپ‌های «پیشنهاد شروع» به درخواست کاربر حذف شد) */}
              {!hasQuery ? (
                <div className="space-y-4 px-2 pb-3 pt-3">
                  <p className="text-center text-xs leading-6 text-muted-foreground">
                    همهٔ جزوات، جلسه‌ها، مواد قانونی و جداول اینجا فهرست شده‌اند — با نوشتن نام استاد، پروفایلش را هم پیدا می‌کنی.
                  </p>
                  {teachers.length > 0 && (
                    <div className="space-y-2">
                      <p className="flex items-center gap-1.5 text-[10.5px] font-bold tracking-wide text-muted-foreground/80">
                        <GraduationCap className="h-3.5 w-3.5 text-bronze" /> اساتیدی که سریع پیدایشان می‌کنی
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {teachers.slice(0, 5).map((t) => (
                          <button
                            key={t.id}
                            onClick={() => { setOpen(false); navigate({ view: "teacher", id: t.id }); }}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background py-1 pe-3 ps-1 text-[11px] font-semibold transition-colors hover:border-bronze/50"
                          >
                            <UserAvatar src={t.avatarUrl} name={t.displayName} size="xs" />
                            {t.displayName}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : busy ? (
                <div className="space-y-1.5 p-1">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="block animate-pulse rounded-xl bg-muted/80 p-3">
                      <span className="mb-1.5 block h-3 w-2/5 rounded bg-border" />
                      <span className="block h-2.5 w-4/5 rounded bg-muted" />
                    </span>
                  ))}
                </div>
              ) : flat.length === 0 ? (
                <p className="px-3 py-8 text-center text-xs leading-6 text-muted-foreground">
                  چیزی پیدا نشد؛ با کلمهٔ دیگری امتحان کن.
                  <br />
                  <span className="text-[11px] opacity-80">نام ماده (مثلاً «ماده ۲۲۰») یا کلیدواژهٔ بحث را امتحان کن.</span>
                </p>
              ) : (
                <>
                  {/* نوار نتیجه */}
                  <div className="sticky top-0 z-10 mb-1 flex items-center justify-between rounded-xl bg-card/95 px-3 py-1.5 text-[10.5px] font-semibold text-muted-foreground backdrop-blur-sm">
                    <span>{fa(teacherHits.length)} استاد · {fa(lawHits.length)} ماده · {fa(hits.length)} جلسه</span>
                    <span dir="ltr" className="hidden font-display tabular-nums opacity-70 sm:inline">Esc</span>
                  </div>
                  <ul role="listbox" aria-label="نتیجه‌ها" className="space-y-0.5">
                    {teacherHits.length > 0 && (
                      <li aria-hidden className="flex items-center gap-2 px-3 pb-0.5 pt-1 text-[10px] font-bold tracking-wide text-muted-foreground/80">
                        <GraduationCap className="h-3.5 w-3.5 text-bronze" /> اساتید
                      </li>
                    )}
                    {flat.map((item, i) =>
                      item.kind === "teacher" ? (
                        <li key={`t-${item.t.id}`}>
                          <button
                            onMouseEnter={() => setCursor(i)}
                            onClick={() => go(item)}
                            aria-selected={i === cursor}
                            role="option"
                            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start transition-colors ${
                              i === cursor ? "bg-primary/10 ring-1 ring-inset ring-bronze/40" : "hover:bg-muted"
                            }`}
                          >
                            <UserAvatar src={item.t.avatarUrl} name={item.t.displayName} size="sm" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-bold text-foreground">{hl(item.t.displayName)}</span>
                              <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                                @{hl(item.t.username)} · {fa(item.t.followers)} دنبال‌کننده · {fa(item.t.postsCount)} مطلب{item.t.coursesCount > 0 ? ` · ${fa(item.t.coursesCount)} دوره` : ""}
                              </span>
                            </span>
                            <span className="shrink-0 rounded-full bg-bronze/10 px-2 py-0.5 text-[10px] font-bold text-bronze">استاد</span>
                            <CornerDownLeft className={`h-3.5 w-3.5 shrink-0 ${i === cursor ? "text-muted-foreground" : "invisible"}`} />
                          </button>
                        </li>
                      ) : item.kind === "law" ? (
                        <li key={`law-${item.h.lawId}-${item.h.no}`}>
                          <button
                            onMouseEnter={() => setCursor(i)}
                            onClick={() => go(item)}
                            aria-selected={i === cursor}
                            role="option"
                            className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-start transition-colors ${
                              i === cursor ? "bg-primary/10 ring-1 ring-inset ring-bronze/40" : "hover:bg-muted"
                            }`}
                          >
                            <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-bronze" />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-baseline gap-2">
                                <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-foreground">
                                  مادهٔ {item.h.no} {hl(item.h.lawTitle)}
                                </span>
                                <span className="shrink-0 rounded-full bg-bronze/10 px-2 py-0.5 text-[10px] font-bold text-bronze">قانون</span>
                              </span>
                              <span className="mt-0.5 block truncate text-[11px] text-bronze">{item.h.book} · {item.h.chapter}</span>
                              <span className="mt-1 block line-clamp-2 text-[11.5px] leading-5 text-muted-foreground">{hl(item.h.snippet)}</span>
                            </span>
                            <CornerDownLeft className={`mt-1 h-3.5 w-3.5 shrink-0 ${i === cursor ? "text-muted-foreground" : "invisible"}`} />
                          </button>
                        </li>
                      ) : (
                        <React.Fragment key={item.h.lessonId}>
                          {i === teacherHits.length + lawHits.length && teacherHits.length + lawHits.length > 0 && (
                            <li aria-hidden className="flex items-center gap-2 px-3 pb-0.5 pt-2 text-[10px] font-bold tracking-wide text-muted-foreground/80">
                              <BookOpenText className="h-3.5 w-3.5 text-bronze" /> جلسه‌ها
                            </li>
                          )}
                          <li>
                            <button
                              onMouseEnter={() => setCursor(i)}
                              onClick={() => go(item)}
                              aria-selected={i === cursor}
                              role="option"
                              className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-start transition-colors ${
                                i === cursor ? "bg-primary/10 ring-1 ring-inset ring-bronze/40" : "hover:bg-muted"
                              }`}
                            >
                              <CourseIcon icon={item.h.icon} className="mt-0.5 h-4 w-4 shrink-0 text-bronze" />
                              <span className="min-w-0 flex-1">
                                <span className="flex items-baseline gap-2">
                                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-foreground">{hl(item.h.lessonTitle)}</span>
                                  <span dir="ltr" className="shrink-0 font-display text-[10px] tabular-nums text-muted-foreground">{fa(item.h.idx)}/{fa(item.h.total)}</span>
                                </span>
                                <span className="mt-0.5 block truncate text-[11px] text-bronze">{item.h.courseTitle} · {item.h.chapterTitle}</span>
                                <span className="mt-1 block line-clamp-2 text-[11.5px] leading-5 text-muted-foreground">{hl(item.h.snippet)}</span>
                              </span>
                              <CornerDownLeft className={`mt-1 h-3.5 w-3.5 shrink-0 ${i === cursor ? "text-muted-foreground" : "invisible"}`} />
                            </button>
                          </li>
                        </React.Fragment>
                      ),
                    )}
                  </ul>
                </>
              )}
            </div>

            {/* پانویس */}
            <div className="flex items-center justify-between border-t border-border/70 px-4 py-2 text-[10.5px] text-muted-foreground">
              <span>بالا/پایین برای حرکت · Enter برای رفتن</span>
              <span className="hidden md:inline">کلاً {fa(indexReady ? courses.reduce((n, c) => n + c.chapters.reduce((m, ch) => m + ch.lessons.length, 0), 0) : 0)} جلسه ایندکس شده</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
