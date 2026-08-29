import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { FEEDBACK_ANALYZE_SPEC, lessonContextBlock } from "@/lib/ai/prompts";
import { dispatch, extractJson, PERSIAN_FAIL, type AiConf } from "@/lib/ai/providers";

export const runtime = "nodejs";
export const maxDuration = 120;

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  ts?: number;
}

interface Body {
  courseId?: string;
  chapterTitle?: string;
  lessonId?: string;
  lessonTitle?: string;
  messages?: ChatMsg[];
  context?: Record<string, unknown>;
  ai?: AiConf;
}

interface AnalyzeResult {
  matchPercent?: number;
  needsChange?: boolean;
  severity?: string;
  analysis?: string;
  suggestion?: string;
}

const SEVERITIES = ["minor", "moderate", "major"];

/**
 * تحلیل نهایی کل گفت‌وگو + ثبت ابدی پیشنهاد برای مدیر.
 * فقط افزودنی: رکورد ساخته می‌شود و هرگز حذف/بازنویسی نمی‌شود (فقط وضعیت بررسی تغییر می‌کند).
 */
export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me)
    return NextResponse.json({ error: "برای ثبت بازخورد ابتدا وارد حساب خود شوید." }, { status: 401 });
  if (!rateLimit(req, `feedback:${me.id}`, 10, 60_000))
    return NextResponse.json({ error: "بازخوردها را با فاصلهٔ زمانی بفرستید." }, { status: 429 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const msgs = (body.messages ?? []).filter(
    (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
  );
  const userMsgCount = msgs.filter((m) => m.role === "user").length;
  if (userMsgCount === 0)
    return NextResponse.json({ error: "هنوز انتقادی ثبت نکرده‌اید." }, { status: 400 });

  // محدودیت حجم: حداکثر ۳۰ پیام و هر پیام ۴۰۰۰ نویسه
  const trimmed = msgs.slice(-30).map((m) => ({ ...m, content: m.content.slice(0, 4000) }));

  try {
    // قضاوت نهایی ساختاریافته روی کل گفت‌وگو
    const transcript = trimmed
      .map((m) => `${m.role === "user" ? "دانشجو" : "تحلیلگر"}: ${m.content}`)
      .join("\n\n")
      .slice(-9000);
    const userPrompt = `سابقهٔ کامل گفت‌وگوی بازخورد:\n${transcript}\n\nطبق دستور، فقط JSON نهایی برگردان.`;
    let parsed: AnalyzeResult | null = null;

    for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
      const raw = await dispatch(body.ai ?? {}, FEEDBACK_ANALYZE_SPEC, `${userPrompt}${lessonContextBlock(body.context as never)}`, 0.25);
      parsed = extractJson<AnalyzeResult>(raw);
    }

    const analysis = (parsed?.analysis ?? "").trim() ||
      "تحلیل ساختاریافته دریافت نشد؛ اما انتقاد کاربر با موفقیت ثبت شد و منتظر بررسی مدیر است.";
    const suggestion = (parsed?.suggestion ?? "").trim() ||
      "پیشنهاد تازه‌سازی در دسترس نیست؛ لطفاً گفت‌وگوی پیوست را مستقیم بخوانید.";
    const matchPercent =
      typeof parsed?.matchPercent === "number" && Number.isFinite(parsed.matchPercent)
        ? Math.min(100, Math.max(0, Math.round(parsed.matchPercent)))
        : 0;
    const severity = SEVERITIES.includes(parsed?.severity ?? "") ? parsed!.severity! : "moderate";
    const needsChange = typeof parsed?.needsChange === "boolean" ? parsed.needsChange : true;

    const rec = await db.lessonFeedback.create({
      data: {
        userId: me.id,
        courseId: String(body.courseId ?? "").slice(0, 40) || "custom",
        chapterTitle: String(body.chapterTitle ?? "").slice(0, 160),
        lessonId: String(body.lessonId ?? "").slice(0, 60) || "unknown",
        lessonTitle: String(body.lessonTitle ?? "").slice(0, 200),
        conversation: JSON.stringify(trimmed),
        matchPercent,
        needsChange,
        severity,
        analysis: analysis.slice(0, 6000),
        suggestion: suggestion.slice(0, 6000),
        status: "pending",
      },
    });

    return NextResponse.json({
      id: rec.id,
      createdAt: rec.createdAt.toISOString(),
      status: rec.status,
      matchPercent,
      needsChange,
      severity,
      analysis,
      suggestion,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[feedback/submit]", msg);
    return NextResponse.json({ error: `${PERSIAN_FAIL}\n(${msg.slice(0, 180)})` }, { status: 502 });
  }
}
