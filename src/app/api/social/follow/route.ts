import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** فالو / آنفالو استاد (توگل) — نیازمند حساب */
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "برای دنبال کردن، ابتدا وارد شوید." }, { status: 401 });

  let body: { teacherId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const teacherId = String(body.teacherId ?? "");
  if (!teacherId) return NextResponse.json({ error: "شناسهٔ استاد لازم است." }, { status: 400 });

  const teacher = await db.user.findUnique({ where: { id: teacherId }, select: { id: true, role: true } });
  if (!teacher || teacher.role !== "teacher")
    return NextResponse.json({ error: "استاد یافت نشد." }, { status: 404 });

  const existing = await db.follow.findUnique({
    where: { studentId_teacherId: { studentId: me.id, teacherId } },
  });

  if (existing) {
    await db.follow.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true, following: false });
  }
  await db.follow.create({ data: { studentId: me.id, teacherId } });
  return NextResponse.json({ ok: true, following: true });
}
