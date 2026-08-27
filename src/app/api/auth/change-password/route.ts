// ─── تغییر رمز عبور توسط خود کاربر ────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, hashPassword, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });

  let body: { current?: string; next?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const current = String(body.current ?? "");
  const nextPw = String(body.next ?? "");
  if (nextPw.length < 8)
    return NextResponse.json({ error: "رمز تازه باید دست‌کم ۸ نویسه باشد." }, { status: 400 });

  const row = await db.user.findUnique({ where: { id: me.id }, select: { passwordHash: true } });
  if (!row || !(await verifyPassword(current, row.passwordHash)))
    return NextResponse.json({ error: "رمز فعلی درست نیست." }, { status: 400 });

  await db.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(nextPw) } });
  return NextResponse.json({ ok: true });
}
