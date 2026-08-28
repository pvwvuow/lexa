import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  createSession,
  ensureAdmin,
  SESSION_COOKIE,
  toPublic,
  verifyPassword,
} from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  await ensureAdmin();
  // سد brute-force: حداکثر ۱۰ ورود در ۵ دقیقه از هر IP
  if (!rateLimit(req, "login", 10, 5 * 60_000))
    return NextResponse.json({ error: "تلاش‌های ورود زیاد بوده؛ لطفاً چند دقیقه صبر کنید." }, { status: 429 });
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }
  const username = (body.username ?? "").trim();
  const password = body.password ?? "";
  if (!username || !password)
    return NextResponse.json(
      { error: "نام کاربری و رمز عبور را وارد کنید." },
      { status: 400 }
    );

  try {
    const user = await db.user.findUnique({ where: { username } });
    // پیام یکسان برای هر دو حالت (نمی‌گویم کدام غلط است)
    if (!user || !(await verifyPassword(password, user.passwordHash)))
      return NextResponse.json(
        { error: "نام کاربری یا رمز عبور نادرست است." },
        { status: 401 }
      );

    const { token, expiresAt } = await createSession(user.id);
    await db.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });

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
    console.log(`[auth] ورود موفق → ${username}`);
    return res;
  } catch (e) {
    console.error("[auth] login error:", e);
    return NextResponse.json({ error: "خطای سرور؛ دوباره تلاش کنید." }, { status: 500 });
  }
}
