import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import {
  createSession,
  hashPassword,
  SESSION_COOKIE,
  toPublic,
} from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase-config";

export const runtime = "nodejs";

/* ─── پل حساب ابری ← حساب سروری ────────────────────────────────────────────────
 * کاربر با «ورود / ثبت‌نام» (حساب ابری/Supabase) وارد می‌شود و انتظار دارد
 * همه‌چیز — فالو، امتیاز، کامنت، کتابخانهٔ همگام — همان‌جا کار کند؛ اما این
 * قابلیت‌ها به نشست سروری تکیه دارند. این مسیر با توکن معتبر Supabase، هویت را
 * نزد خودِ Supabase راستی‌آزمایی می‌کند و یک حساب سروری هم‌نام (تطبیقی) می‌سازد
 * یا وارد آن می‌شود؛ سپس کوکی نشست را می‌نشاند.
 *
 * نگاشت پایدار و امن: username = «sb_» + ۸ نویسهٔ اول شناسهٔ یکتای Supabase
 * (deterministic — هر هویت ابری همیشه به همان حساب سروری می‌رسد)؛ رمز تصادفی
 * غیرقابل حدس — ورود مستقیم با رمز برای این حساب‌ها ممکن نیست، فقط پل.
 */

interface SbIdentity {
  id: string;
  email: string;
}

async function verifyWithSupabase(accessToken: string): Promise<SbIdentity | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { id?: string; email?: string };
    if (!j?.id) return null;
    return { id: j.id, email: j.email ?? "" };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  // سد سوءاستفاده: حداکثر ۲۰ پل در ۵ دقیقه از هر IP
  if (!rateLimit(req, "cloud-bridge", 20, 5 * 60_000))
    return NextResponse.json({ error: "تلاش‌های زیاد؛ چند دقیقه بعد دوباره." }, { status: 429 });

  let body: { accessToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }
  const accessToken = String(body.accessToken ?? "");
  if (!accessToken)
    return NextResponse.json({ error: "توکن حساب ابری یافت نشد." }, { status: 400 });

  const identity = await verifyWithSupabase(accessToken);
  if (!identity)
    return NextResponse.json({ error: "نشست حساب ابری معتبر نیست." }, { status: 401 });

  // نگاشت deterministic — بدون ستون اضافه، بدون تصادم با حساب‌های محلی
  const sub = identity.id.replace(/[^a-f0-9]/gi, "").toLowerCase();
  const username = `sb_${sub.slice(0, 8)}`;

  try {
    let user = await db.user.findUnique({ where: { username } });
    if (!user) {
      const local = identity.email.split("@")[0]?.slice(0, 30) || "کاربر Lexa";
      user = await db.user.create({
        data: {
          username,
          passwordHash: await hashPassword(randomBytes(32).toString("hex")),
          role: "user",
          displayName: local,
        },
      });
      console.log(`[auth] پل حساب ابری → حساب سروری ساخته شد → ${username}`);
    }

    const { token, expiresAt } = await createSession(user.id);
    await db.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } }).catch(() => {});

    const res = NextResponse.json({
      user: toPublic({
        id: user.id,
        username: user.username,
        role: user.role === "admin" ? "admin" : user.role === "teacher" ? "teacher" : "user",
        createdAt: user.createdAt.toISOString(),
        sessionId: "",
      }),
    });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      expires: expiresAt,
    });
    return res;
  } catch (e) {
    console.error("[auth] cloud-bridge error:", e);
    return NextResponse.json({ error: "خطای سرور؛ دوباره تلاش کنید." }, { status: 500 });
  }
}
