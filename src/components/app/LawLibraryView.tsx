"use client";

// ─── کتابخانهٔ قوانین — ساختاری متفاوت از دوره‌ها: حس «نسخهٔ خطی و برگهٔ دادگاه» ──
// فهرست قانون‌ها + متن‌خوان ماده‌به‌ماده با جستجو، نشان‌گذاری، اندازهٔ قلم و چاپ.
import * as React from "react";
import {
  Scale, Search, Bookmark, BookmarkCheck, Copy, Check, Printer,
  AArrowDown, AArrowUp, Landmark, ScrollText, Diamond, FileSearch, X,
} from "lucide-react";
import { navigate } from "@/lib/router";
import { fa } from "@/lib/fa";
import {
  LAW_CODES, LAW_CATEGORIES, getLaw, lawArticleCount, flatLawArticles,
  lawCategoryLabel, type LawCode, type LawArticle,
} from "@/lib/law/statutes";

// ─── نشان‌گذاری مواد (localStorage) ──────────────────────────────────────────
const MARKS_KEY = "hh-law-marks";

function readMarks(): string[] {
  try {
    const raw = window.localStorage.getItem(MARKS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.slice(0, 400) : [];
  } catch {
    return [];
  }
}

function useLawMarks() {
  const [marks, setMarks] = React.useState<string[]>([]);
  React.useEffect(() => setMarks(readMarks()), []);
  const toggle = React.useCallback((key: string) => {
    setMarks((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try { window.localStorage.setItem(MARKS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);
  return { marks, toggle };
}

/** هایلایت نتیجهٔ جستجو در متن ماده */
function Hl({ text, tokens }: { text: string; tokens: string[] }) {
  if (!tokens.length) return <>{text}</>;
  const rx = new RegExp("(" + tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "gi");
  return (
    <>
      {text.split(rx).map((part, i) =>
        rx.test(part) ? (
          <mark key={i} className="rounded-[3px] bg-bronze/25 px-0.5 font-bold text-foreground">{part}</mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}

/** مُهر لوزی شمارهٔ ماده — به‌جای چیپ معمولی، حس پلمپ اسناد */
function ArticleSeal({ no }: { no: string }) {
  return (
    <span className="relative inline-grid h-14 w-14 shrink-0 rotate-45 place-items-center rounded-[12px] border border-bronze/45 bg-gradient-to-br from-bronze/15 to-transparent shadow-card">
      <span className="-rotate-45 text-center leading-tight">
        <span className="block text-[8.5px] font-bold text-bronze/80">ماده</span>
        <span className="block font-display text-[13px] font-extrabold text-bronze">{no}</span>
      </span>
    </span>
  );
}

function norm(s: string): string {
  return s
    .replace(/[ىي]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u064B-\u0652\u200c]/g, "")
    .replace(/[\u06F0-\u06F9\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) & 0xf))
    .toLowerCase();
}

// ═══ فهرست کتابخانهٔ قوانین ═══════════════════════════════════════════════════

function LawIndex({ marks }: { marks: string[] }) {
  const [cat, setCat] = React.useState("");
  const [q, setQ] = React.useState("");

  const list = React.useMemo(() => {
    let out = LAW_CODES;
    if (cat) out = out.filter((l) => l.category === cat);
    if (q.trim()) {
      const nq = norm(q.trim());
      out = out.filter(
        (l) =>
          norm(l.title).includes(nq) ||
          norm(l.description).includes(nq) ||
          flatLawArticles(l).some(
            (it) => norm(it.article.text).includes(nq) || norm(it.article.no).includes(nq),
          ),
      );
    }
    return out;
  }, [cat, q]);

  const markedLaws = React.useMemo(
    () => marks.filter((m) => m.startsWith("")).map((m) => m),
    [marks],
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-7 px-4 pb-28 pt-2 sm:px-6">
      <header className="relative overflow-hidden rounded-[26px] border border-bronze/30 bg-gradient-to-bl from-[#f6efe0] via-[#fbf6ea] to-[#efe4cc] p-6 text-[#3b2f18] shadow-card dark:from-[#221c12] dark:via-[#1c1810] dark:to-[#171310] dark:text-[#e8dcc2] sm:p-8">
        <div aria-hidden className="pattern-quilt absolute inset-0 opacity-[0.12]" />
        <div className="relative flex items-start gap-4">
          <span className="grid h-14 w-14 shrink-0 rotate-45 place-items-center rounded-[14px] border border-bronze/50 bg-bronze/10 shadow-card">
            <Landmark className="h-6 w-6 -rotate-45 text-bronze" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-extrabold tracking-tight">کتابخانهٔ قوانین</h1>
            <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed opacity-80">
              متن قانون‌های اصلی کشور، ماده‌به‌ماده — با جستجو در متن، نشان‌گذاری مواد و چاپ.
              گردآوری از {LAW_CODES[0].sourceLabel}؛ متن بعضی مواد گزیده است و برای استناد رسمی به سامانهٔ ملی مراجعه کنید.
            </p>
          </div>
        </div>
      </header>

      {/* نشان‌شده‌های من */}
      {markedLaws.length > 0 && <MarkedSummary marks={marks} />}

      {/* دسته‌ها */}
      <nav aria-label="دسته‌های قانون" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        <button
          onClick={() => setCat("")}
          aria-pressed={!cat}
          className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition-all ${
            !cat
              ? "border-bronze bg-gradient-to-l from-bronze/[0.16] to-transparent text-bronze shadow-card"
              : "border-border bg-card text-muted-foreground hover:border-bronze/40 hover:text-foreground"
          }`}
        >
          همهٔ قانون‌ها
        </button>
        {LAW_CATEGORIES.map((c) => (
          <button
            key={c.slug}
            onClick={() => setCat(c.slug)}
            aria-pressed={cat === c.slug}
            className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition-all ${
              cat === c.slug
                ? "border-bronze bg-gradient-to-l from-bronze/[0.16] to-transparent text-bronze shadow-card"
                : "border-border bg-card text-muted-foreground hover:border-bronze/40 hover:text-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
      </nav>

      {/* جستجو در همهٔ قانون‌ها */}
      <div className="law-field relative">
        <Search className="pointer-events-none absolute inset-y-0 start-4 my-auto h-4 w-4 text-bronze" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="جستجو در متن همهٔ مواد… مثلاً «ضمان» یا «۴۴ ساعت»"
          aria-label="جستجو در متن قوانین"
          className="h-12 w-full rounded-2xl border border-border bg-card ps-11 pe-10 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-bronze/60"
        />
        {q && (
          <button onClick={() => setQ("")} aria-label="پاک کردن" className="absolute inset-y-0 end-3 my-auto grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* کارت قانون‌ها — سبک جلد نسخهٔ خطی */}
      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
          قانونی با این مشخصات پیدا نشد؛ با واژهٔ دیگری جستجو کن.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((law) => (
            <button
              key={law.id}
              onClick={() => navigate({ view: "law", id: law.id })}
              className="group relative overflow-hidden rounded-[20px] border border-bronze/25 bg-card p-5 text-start shadow-card transition-colors hover:border-bronze/60"
            >
              <span aria-hidden className="absolute -top-[8px] start-1/2 h-px w-20 -translate-x-1/2 rtl:translate-x-1/2 bg-gradient-to-l from-transparent via-bronze/70 to-transparent" />
              <span aria-hidden className="pointer-events-none absolute -bottom-4 -start-2 select-none font-display text-[76px] leading-none text-bronze/[0.07]">
                {law.title.slice(0, 1)}
              </span>
              <div className="relative flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 rotate-45 place-items-center rounded-[11px] border border-bronze/40 bg-bronze/10 shadow-card transition-transform group-hover:scale-105">
                  <ScrollText className="h-4.5 w-4.5 -rotate-45 text-bronze" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-display text-[15.5px] font-extrabold group-hover:text-bronze">{law.title}</span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[9.5px] font-bold text-muted-foreground">{lawCategoryLabel(law.category)}</span>
                  </span>
                  <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-muted-foreground">{law.description}</span>
                  <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] font-semibold text-bronze">
                    <span className="inline-flex items-center gap-1"><Diamond className="h-3 w-3" />{fa(lawArticleCount(law))} ماده</span>
                    <span className="text-muted-foreground">{law.metaLabel}</span>
                  </span>
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** خلاصهٔ نشان‌شده‌ها در فهرست — کلیک به متن‌خوان همان قانون */
function MarkedSummary({ marks }: { marks: string[] }) {
  const items = React.useMemo(() => {
    return marks
      .map((m) => {
        const [lawId, no] = m.split("::");
        const law = getLaw(lawId);
        if (!law) return null;
        return { law, no };
      })
      .filter(Boolean) as { law: LawCode; no: string }[];
  }, [marks]);
  if (!items.length) return null;
  return (
    <section className="rounded-2xl border border-bronze/30 bg-bronze/[0.06] p-4">
      <h2 className="mb-2.5 flex items-center gap-2 text-sm font-bold text-bronze">
        <BookmarkCheck className="h-4 w-4" /> مواد نشان‌شدهٔ تو ({fa(items.length)})
      </h2>
      <div className="flex flex-wrap gap-1.5">
        {items.map(({ law, no }) => (
          <button
            key={`${law.id}::${no}`}
            onClick={() => navigate({ view: "law", id: law.id })}
            className="rounded-full border border-bronze/40 bg-background px-3 py-1 text-[11px] font-bold text-bronze transition-colors hover:bg-bronze/15"
          >
            {law.title} · مادهٔ {no}
          </button>
        ))}
      </div>
    </section>
  );
}

// ═══ متن‌خوان قانون ═══════════════════════════════════════════════════════════

function LawReader({ law }: { law: LawCode }) {
  const { marks, toggle } = useLawMarks();
  const [q, setQ] = React.useState("");
  const [font, setFont] = React.useState(17);
  const [onlyMarked, setOnlyMarked] = React.useState(false);
  const [copied, setCopied] = React.useState("");
  const [tocOpen, setTocOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem("hh-law-font"));
      if (saved >= 14 && saved <= 24) setFont(saved);
    } catch {}
  }, []);
  const setFontPersist = (v: number) => {
    const clamped = Math.min(24, Math.max(14, v));
    setFont(clamped);
    try { window.localStorage.setItem("hh-law-font", String(clamped)); } catch {}
  };

  const tokens = React.useMemo(
    () => q.trim().split(/\s+/).filter((t) => t.length >= 2).map(norm),
    [q],
  );

  // فیلتر کتاب‌ها بر اساس جستجو و نشان‌ها
  const books = React.useMemo(() => {
    return law.books
      .map((b) => ({
        ...b,
        chapters: b.chapters
          .map((ch) => ({
            ...ch,
            articles: ch.articles.filter((a) => {
              if (onlyMarked && !marks.includes(`${law.id}::${a.no}`)) return false;
              if (!tokens.length) return true;
              const hay = norm(`${a.no} ${a.text}`);
              return tokens.every((t) => hay.includes(t));
            }),
          }))
          .filter((ch) => ch.articles.length > 0),
      }))
      .filter((b) => b.chapters.length > 0);
  }, [law, tokens, onlyMarked, marks]);

  const totalShown = books.reduce(
    (n, b) => n + b.chapters.reduce((m, ch) => m + ch.articles.length, 0),
    0,
  );

  function copyArticle(a: LawArticle) {
    const text = `مادهٔ ${a.no} ${law.title} — ${a.text}`;
    navigator.clipboard?.writeText(text).then(
      () => { setCopied(a.no); setTimeout(() => setCopied(""), 1600); },
      () => {},
    );
  }

  function printLaw() {
    window.print();
  }

  // فهرست فصل‌ها برای منوی پیمایش
  const toc = law.books.map((b) => ({ title: b.title, chapters: b.chapters.map((c) => c.title) }));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-2 sm:px-6">
      {/* سرصفحهٔ قانون — جلد سند */}
      <header className="relative mt-3 overflow-hidden rounded-[26px] border border-bronze/30 bg-gradient-to-bl from-[#f6efe0] via-[#fbf6ea] to-[#efe4cc] p-6 text-[#3b2f18] shadow-card dark:from-[#221c12] dark:via-[#1c1810] dark:to-[#171310] dark:text-[#e8dcc2]">
        <div aria-hidden className="pattern-quilt absolute inset-0 opacity-[0.12]" />
        <div className="relative flex flex-wrap items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 rotate-45 place-items-center rounded-[14px] border border-bronze/50 bg-bronze/10 shadow-card">
            <ScrollText className="h-6 w-6 -rotate-45 text-bronze" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-extrabold tracking-tight">{law.title}</h1>
            <p className="mt-1 text-[11.5px] font-semibold opacity-75">{law.metaLabel}</p>
            <p className="mt-1 text-[11px] opacity-60">منبع گردآوری: {law.sourceLabel}</p>
          </div>
          <button
            onClick={() => setTocOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-bronze/40 bg-background/60 px-3 py-2 text-xs font-bold text-bronze xl:hidden"
            aria-expanded={tocOpen}
          >
            <FileSearch className="h-4 w-4" /> فهرست کتاب‌ها
          </button>
        </div>
      </header>

      {/* نوار ابزار */}
      <div className="no-print sticky top-16 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/95 p-2 shadow-card backdrop-blur">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-bronze" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجو در این قانون…"
            aria-label="جستجو در این قانون"
            className="h-10 w-full rounded-xl border border-border bg-background ps-9 pe-3 text-[13px] outline-none placeholder:text-muted-foreground/60 focus:border-bronze/60"
          />
        </div>
        <button
          onClick={() => setOnlyMarked((v) => !v)}
          aria-pressed={onlyMarked}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11.5px] font-bold transition-colors ${
            onlyMarked ? "border-bronze bg-bronze/15 text-bronze" : "border-border bg-background text-muted-foreground hover:text-bronze"
          }`}
        >
          <BookmarkCheck className="h-4 w-4" /> نشان‌شده‌ها
        </button>
        <div className="flex items-center overflow-hidden rounded-xl border border-border bg-background" role="group" aria-label="اندازهٔ قلم">
          <button onClick={() => setFontPersist(font - 1)} aria-label="کوچک‌تر" className="grid h-9 w-9 place-items-center text-muted-foreground hover:bg-muted hover:text-bronze"><AArrowDown className="h-4 w-4" /></button>
          <span className="border-x border-border px-2 text-[11px] font-bold tabular-nums text-muted-foreground">{fa(font)}</span>
          <button onClick={() => setFontPersist(font + 1)} aria-label="بزرگ‌تر" className="grid h-9 w-9 place-items-center text-muted-foreground hover:bg-muted hover:text-bronze"><AArrowUp className="h-4 w-4" /></button>
        </div>
        <button
          onClick={printLaw}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-[11.5px] font-bold text-muted-foreground transition-colors hover:border-bronze/50 hover:text-bronze"
        >
          <Printer className="h-4 w-4" /> چاپ
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{fa(totalShown)} ماده در حال نمایش</span>
        <span className="no-print">پیکر متن‌ها آموزشی است؛ برای استناد رسمی به سامانهٔ ملی قوانین مراجعه کنید.</span>
      </div>

      <div className="mt-3 flex gap-5">
        {/* فهرست کتاب‌ها — دسکتاپ چسبان / موبایل جمع‌شونده */}
        <nav
          aria-label="فهرست کتاب‌ها"
          className={`no-print top-36 sticky hidden max-h-[calc(100vh-10rem)] w-64 shrink-0 overflow-y-auto rounded-2xl border border-border bg-card/70 p-3 xl:block ${tocOpen ? "!block" : ""}`}
        >
          {toc.map((b, i) => (
            <div key={i} className="mb-3">
              <p className="px-1 pb-1 font-display text-[12px] font-extrabold text-bronze">{b.title}</p>
              {b.chapters.map((c, j) => (
                <p key={j} className="truncate rounded-lg px-2 py-1 text-[11.5px] text-muted-foreground" title={c}>
                  {c}
                </p>
              ))}
            </div>
          ))}
        </nav>

        {/* متن مواد — ستون نسخه */}
        <div ref={rootRef} className="min-w-0 flex-1 space-y-8" style={{ fontSize: `${font}px` }}>
          {totalShown === 0 && (
            <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
              {onlyMarked ? "هنوز ماده‌ای نشان نکرده‌ای؛ با دکمهٔ نشان کنار هر ماده می‌توانی آن را همین‌جا نگه داری." : "موردی با این عبارت پیدا نشد."}
            </p>
          )}
          {books.map((b) => (
            <section key={b.title} className="space-y-3">
              <div className="flex items-center gap-3">
                <span aria-hidden className="grid h-8 w-8 shrink-0 rotate-45 place-items-center rounded-[9px] border border-bronze/40 bg-card shadow-card">
                  <Diamond className="h-3.5 w-3.5 -rotate-45 text-bronze" />
                </span>
                <h2 className="font-display text-lg font-extrabold tracking-tight">{b.title}</h2>
                <span aria-hidden className="h-px flex-1 bg-gradient-to-l from-transparent via-bronze/40 to-transparent" />
              </div>
              {b.chapters.map((ch) => (
                <div key={ch.title} className="space-y-2.5">
                  <h3 className="ps-1 text-[13px] font-bold text-muted-foreground">{ch.title}</h3>
                  {ch.articles.map((a) => {
                    const marked = marks.includes(`${law.id}::${a.no}`);
                    return (
                      <article
                        key={a.no}
                        className="law-paper group relative rounded-[18px] border border-bronze/25 p-4 shadow-card sm:p-5"
                      >
                        <div className="flex items-start gap-3.5">
                          <ArticleSeal no={a.no} />
                          <p className="min-w-0 flex-1 leading-[2] text-foreground/95">
                            <Hl text={a.text} tokens={tokens} />
                            {a.gist && (
                              <span className="ms-2 inline-block align-middle text-[10px] font-bold text-muted-foreground/70">(گزیده)</span>
                            )}
                          </p>
                        </div>
                        <div className="no-print mt-3 flex items-center gap-1.5 border-t border-dashed border-border pt-2.5">
                          <button
                            onClick={() => toggle(`${law.id}::${a.no}`)}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                              marked ? "bg-bronze/15 text-bronze" : "text-muted-foreground hover:bg-muted hover:text-bronze"
                            }`}
                          >
                            {marked ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                            {marked ? "نشان‌شده" : "نشان کن"}
                          </button>
                          <button
                            onClick={() => copyArticle(a)}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-bronze"
                          >
                            {copied === a.no ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                            {copied === a.no ? "کپی شد" : "کپی ماده"}
                          </button>
                          <span className="ms-auto text-[10px] text-muted-foreground/60">{law.title}</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ))}
            </section>
          ))}
          {totalShown > 0 && (
            <p className="pt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
              پایان گزیدهٔ «{law.title}» — متن کامل مصوبه در {law.sourceLabel} موجود است.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══ دروازهٔ اصلی ══════════════════════════════════════════════════════════════

export function LawLibraryView({ id }: { id?: string }) {
  const { marks } = useLawMarks();
  const law = id ? getLaw(id) : undefined;
  if (id && !law) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-16 pb-28 text-center">
        <Scale className="mx-auto h-10 w-10 text-bronze/60" />
        <h1 className="mt-4 text-xl font-extrabold">این قانون در کتابخانه نیست</h1>
        <p className="mt-2 text-sm text-muted-foreground">از فهرست، یکی از قانون‌های موجود را انتخاب کن.</p>
        <button
          onClick={() => navigate({ view: "law" })}
          className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
        >
          فهرست قانون‌ها
        </button>
      </div>
    );
  }
  return law ? <LawReader law={law} /> : <LawIndex marks={marks} />;
}
