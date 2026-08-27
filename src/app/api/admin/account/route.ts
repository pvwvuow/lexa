import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, hashPassword, verifyPassword } from "@/lib/auth";
import { validatePassword, validateUsername } from "@/lib/auth-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** تغییر نام کاربری یا رمز عبور مدیر — با تأیید رمز فعلی */
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me)
    return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });
  if (me.role !== "admin")
    return NextResponse.json({ error: "دسترسی ویژهٔ مدیر است." }, { status: 403 });

  let body: { currentPassword?: string; newUsername?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر." }, { status: 400 });
  }

  try {
    const admin = await db.user.findUnique({ where: { id: me.id } });
    if (!admin || !(await verifyPassword(body.currentPassword ?? "", admin.passwordHash)))
      return NextResponse.json(
        { error: "رمز فعلی نادرست است." },
        { status: 401 }
      );

    const data: { username?: string; passwordHash?: string } = {};
    const newUsername = (body.newUsername ?? "").trim();
    if (newUsername && newUsername !== admin.username) {
      const err = validateUsername(newUsername);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
      const taken = await db.user.findUnique({ where: { username: newUsername } });
      if (taken)
        return NextResponse.json(
          { error: "این نام کاربری قبلاً گرفته شده است." },
          { status: 409 }
        );
      data.username = newUsername;
    }
    if (body.newPassword) {
      const err = validatePassword(body.newPassword);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
      data.passwordHash = await hashPassword(body.newPassword);
    }

    if (!Object.keys(data).length)
      return NextResponse.json({ error: "تغییری ارسال نشده است." }, { status: 400 });

    await db.user.update({ where: { id: me.id }, data });
    console.log(`[admin] حساب مدیر به‌روزرسانی شد`);
    return NextResponse.json({ ok: true, newUsername: data.username ?? null });
  } catch (e) {
    console.error("[admin-account] error:", e);
    return NextResponse.json({ error: "خطای سرور." }, { status: 500 });
  }
}
