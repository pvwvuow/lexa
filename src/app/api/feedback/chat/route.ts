import { NextResponse } from "next/server";
import { FEEDBACK_SYSTEM, lessonContextBlock } from "@/lib/ai/prompts";
import { dispatch, extractJson, PERSIAN_FAIL, type AiConf } from "@/lib/ai/providers";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 120;

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

interface Body {
  messages?: ChatMsg[];
  context?: Record<string, unknown>;
  ai?: AiConf;
}

/** یک نوبت گفت‌وگوی بازخورد: پاسخ استاد + برآورد زندهٔ درصد تطابق با جزوه */
export async function POST(req: Request) {
  if (!rateLimit(req, "fbchat", 20, 60_000))
    return NextResponse.json({ error: "درخواست‌ها زیاد است؛ چند لحظه صبر کنید." }, { status: 429 });
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const msgs = (body.messages ?? []).filter(
    (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
  );
  if (msgs.length === 0)
    return NextResponse.json({ error: "پیامی برای تحلیل وجود ندارد." }, { status: 400 });

  // آخرین پیام باید کاربر باشد
  if (msgs[msgs.length - 1].role !== "user")
    return NextResponse.json({ error: "ترتیب پیام‌ها نامعتبر است." }, { status: 400 });

  const transcript = msgs
    .map((m) => `${m.role === "user" ? "دانشجو" : "تحلیلگر"}: ${m.content}`)
    .join("\n\n");

  const user = `سابقهٔ گفت‌وگو:\n${transcript.slice(-9000)}\n\nهمین حالا فقط JSON پاسخ بده.`;

  try {
    const raw = await dispatch(body.ai ?? {}, FEEDBACK_SYSTEM, `${user}${lessonContextBlock(body.context as never)}`, 0.5);
    const parsed = extractJson<{ reply?: string; matchEstimate?: number | null }>(raw);
    if (!parsed?.reply?.trim()) throw new Error("پاسخ ساختاریافته دریافت نشد.");
    const est = typeof parsed.matchEstimate === "number"
      ? Math.min(100, Math.max(0, Math.round(parsed.matchEstimate)))
      : null;
    return NextResponse.json({ reply: parsed.reply.trim(), matchEstimate: est });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[feedback/chat]", msg);
    return NextResponse.json({ error: `${PERSIAN_FAIL}\n(${msg.slice(0, 180)})` }, { status: 502 });
  }
}
