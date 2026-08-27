import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** افزودن کامنت به مطلب — هر کاربر واردشده‌ای می‌تواند کامنت بگذارد */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "برای گذاشتن کامنت، ابتدا وارد شوید." }, { status: 401 });

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const text = (body.text ?? "").trim().slice(0, 1200);
  if (!text) return NextResponse.json({ error: "متن کامنت خالی است." }, { status: 400 });

  const post = await db.post.findUnique({ where: { id }, select: { id: true } });
  if (!post) return NextResponse.json({ error: "مطلب یافت نشد." }, { status: 404 });

  const c = await db.comment.create({
    data: { postId: id, userId: me.id, text },
    include: { user: { select: { username: true } } },
  });

  return NextResponse.json({
    ok: true,
    comment: { id: c.id, text: c.text, createdAt: c.createdAt.toISOString(), username: c.user.username },
  });
}
