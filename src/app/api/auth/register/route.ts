import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  createSession,
  ensureAdmin,
  hashPassword,
  SESSION_COOKIE,
  toPublic,
} from "@/lib/auth";
import { validatePassword, validateUsername } from "@/lib/auth-shared";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  await ensureAdmin();
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const username = (body.username ?? "").trim();
  const password = body.password ?? "";

  const invalid = validateUsername(username) ?? validatePassword(password);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  try {
    const exists = await db.user.findUnique({ where: { username } });
    if (exists) {
      if (exists.role === "admin")
        return NextResponse.json(
          { error: "این نام کاربری محفوظ است؛ نام دیگری انتخاب کنید." },
          { status: 409 }
        );
      return NextResponse.json(
        { error: "این نام کاربری قبلاً ثبت شده است." },
        { status: 409 }
      );
    }

    const user = await db.user.create({
      data: { username, passwordHash: await hashPassword(password), role: "user" },
    });
    await db.userBlob
      .create({ data: { userId: user.id } })
      .catch(() => {});

    const { token, expiresAt } = await createSession(user.id);
    const res = NextResponse.json({
      user: toPublic({
        id: user.id,
        username: user.username,
        role: user.role === "admin" ? "admin" : "user",
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
    console.log(`[auth] ثبت‌نام موفق → ${username}`);
    return res;
  } catch (e) {
    console.error("[auth] register error:", e);
    return NextResponse.json({ error: "خطای سرور؛ دوباره تلاش کنید." }, { status: 500 });
  }
}
