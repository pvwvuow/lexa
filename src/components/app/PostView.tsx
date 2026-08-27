"use client";

// ─── صفحهٔ یک مطلب استاد: رندر با همان المان‌های تدریس + کامنت دانشجوها ────────
import * as React from "react";
import {
  Loader2, MessageCircle, Send, Trash2, Scale, Quote, ListChecks, Lightbulb,
  GitCompareArrows, HelpCircle, BookOpen, GraduationCap, ArrowLeft,
} from "lucide-react";
import type { LessonSection } from "@/lib/law/types";
import { useAuth } from "@/lib/auth-client";
import { navigate } from "@/lib/router";
import { fa } from "@/lib/fa";
import { SectionBody } from "./common";

interface PostData {
  id: string;
  title: string;
  summary: string;
  tags: string;
  blocks: LessonSection[];
  createdAt: string;
  updatedAt: string;
  author: { id: string; username: string; displayName: string; bio: string };
  canManage: boolean;
}
interface CommentItem { id: string; text: string; createdAt: string; username: string }

const BLOCK_LABEL: Record<string, { t: string; Icon: React.ComponentType<{ className?: string }> }> = {
  intro: { t: "درآمد", Icon: BookOpen },
  concept: { t: "مفهوم و توضیح", Icon: Lightbulb },
  law: { t: "مستند قانونی", Icon: Scale },
  notes: { t: "نکات کلیدی", Icon: ListChecks },
  example: { t: "مثال کاربردی", Icon: Quote },
  compare: { t: "جدول مقایسه", Icon: GitCompareArrows },
  summary: { t: "جمع‌بندی", Icon: GraduationCap },
  question: { t: "پرسش", Icon: HelpCircle },
};

export function PostView({ id }: { id: string }) {
  const [data, setData] = React.useState<PostData | null>(null);
  const [comments, setComments] = React.useState<CommentItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);

  // فرم کامنت
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [cErr, setCErr] = React.useState("");
  const { user } = useAuth();

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/posts/${id}`)
      .then((r) => r.json())
      .then((d: { post?: PostData; comments?: CommentItem[]; error?: string }) => {
        if (!alive) return;
        if (d.post) {
          setData(d.post);
          setComments(d.comments ?? []);
        } else setNotFound(true);
      })
      .catch(() => alive && setNotFound(true))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [id]);

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setCErr("");
    try {
      const res = await fetch(`/api/posts/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "ارسال ناموفق بود.");
      setComments((cs) => [d.comment as CommentItem, ...cs]);
      setText("");
    } catch (err) {
      setCErr(err instanceof Error ? err.message : "خطایی رخ داد.");
    } finally {
      setSending(false);
    }
  }

  async function removePost() {
    if (!data || !confirm("این مطلب برای همیشه حذف شود؟")) return;
    await fetch(`/api/posts/${id}`, { method: "DELETE" });
    navigate({ view: "teachers" });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-bronze">
        <Loader2 className="h-5 w-5 animate-spin" /> در حال بارگذاری مطلب…
      </div>
    );
  }
  if (notFound || !data) {
    return (
      <div className="mx-auto max-w-md pt-20 text-center">
        <p className="rounded-2xl border border-dashed border-border bg-card p-8 text-sm text-muted-foreground shadow-card">
          این مطلب یافت نشد — شاید نویسنده آن را حذف کرده باشد.
        </p>
        <button onClick={() => navigate({ view: "teachers" })} className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-bronze hover:underline">
          بازگشت به اساتید <ArrowLeft className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const faFull = new Date(data.createdAt).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-28 pt-6 sm:px-6">
      {/* سرصفحهٔ مطلب */}
      <header>
        <button onClick={() => navigate({ view: "teachers" })} className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-bronze">
          <ArrowLeft className="h-3.5 w-3.5 rotate-180" /> بازگشت به اساتید
        </button>

        <div className="flex items-center gap-3">
          <span aria-hidden className="h-12 w-12 shrink-0 rotate-45 rounded-[10px] bg-gradient-to-bl from-primary/90 to-bronze shadow-card" />
          <div>
            <p className="font-display text-sm font-bold">{data.author.displayName}</p>
            <p className="text-[11px] text-muted-foreground">@{data.author.username} · {faFull}</p>
          </div>
          {data.canManage && (
            <div className="ms-auto flex gap-2">
              <button
                onClick={() => navigate({ view: "studio" })}
                className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:border-bronze hover:text-bronze"
              >
                ویرایش در اتاق استاد
              </button>
              <button
                onClick={removePost}
                aria-label="حذف مطلب"
                className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-[11px] font-bold text-destructive transition-colors hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" /> حذف
              </button>
            </div>
          )}
        </div>

        <h1 className="mt-4 text-2xl font-extrabold leading-relaxed">{data.title}</h1>
        {data.summary && <p className="mt-2 leading-loose text-muted-foreground">{data.summary}</p>}
        {data.tags && (
          <p className="mt-2 flex flex-wrap gap-1.5">
            {data.tags.split(/[,،]/).filter(Boolean).map((tg) => (
              <span key={tg} className="rounded-full border border-bronze/30 bg-bronze/[0.07] px-2.5 py-0.5 text-[11px] font-medium text-bronze">#{tg.trim()}</span>
            ))}
          </p>
        )}
      </header>

      {/* بلوک‌های محتوا با المان‌های تدریس */}
      <article className="space-y-6 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-8">
        {(data.blocks as unknown[]).map((raw, i) => {
          const s = raw as LessonSection;
          const meta = BLOCK_LABEL[s.type];
          const MIcon = meta?.Icon ?? BookOpen;
          return (
            <section key={(s.id ?? "") + i}>
              {meta && (
                <div role="separator" className="mb-3 flex items-center gap-3">
                  <span aria-hidden className="grid h-7 w-7 shrink-0 rotate-45 place-items-center rounded-[8px] border border-bronze/40 bg-card shadow-card">
                    <MIcon className="h-3.5 w-3.5 -rotate-45 text-bronze" />
                  </span>
                  <span className="shrink-0 font-display text-[12.5px] font-bold tracking-wide text-bronze">
                    {meta.t}{s.title ? ` — ${s.title}` : ""}
                  </span>
                  <span aria-hidden className="h-px flex-1 bg-gradient-to-l from-transparent via-bronze/40 to-transparent" />
                </div>
              )}
              <SectionBody s={s} decorativeHeadless />
            </section>
          );
        })}
      </article>

      {/* کامنت‌ها */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <MessageCircle className="h-5 w-5 text-bronze" /> نظرات دانشجوها ({fa(comments.length)})
        </h2>

        {user ? (
          <form onSubmit={submitComment} className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              maxLength={1200}
              placeholder={`دیدگاهت دربارهٔ «${data.title}» را بنویس…`}
              className="w-full resize-none rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-bronze"
              aria-label="متن کامنت"
            />
            {cErr && <p className="mt-1.5 text-xs text-destructive">{cErr}</p>}
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10.5px] text-muted-foreground">{fa(text.length)} / ۱۲۰۰</span>
              <button
                type="submit"
                disabled={sending || !text.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-45"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 -scale-x-100" />}
                ارسال نظر
              </button>
            </div>
          </form>
        ) : (
          <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-card">
            برای گذاشتن کامنت، ابتدا از دکمهٔ «ورود / ثبت‌نام» وارد شو.
          </p>
        )}

        <ul className="space-y-2.5">
          {comments.map((c) => (
            <li key={c.id} className="rounded-2xl border border-border/80 bg-card p-4 shadow-card">
              <div className="mb-1 flex items-center gap-2.5">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-bl from-primary to-bronze font-display text-[11px] font-bold text-primary-foreground" aria-hidden>
                  {c.username.slice(0, 1)}
                </span>
                <span className="text-xs font-bold">{c.username}</span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(c.createdAt).toLocaleDateString("fa-IR", { month: "long", day: "numeric" })}
                </span>
              </div>
              <p className="whitespace-pre-line ps-9 text-sm leading-relaxed">{c.text}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
