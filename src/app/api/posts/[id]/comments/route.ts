import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** افزودن کامنت به مطلب — هر کاربر واردشده‌ای می‌تواند؛ پاسخ به کامنت دیگر هم امکان دارد */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "برای گذاشتن کامنت، ابتدا وارد شوید." }, { status: 401 });
  if (!rateLimit(req, `comment:${me.id}`, 12, 60_000))
    return NextResponse.json({ error: "کامنت‌ها را با فاصلهٔ زمانی بفرستید." }, { status: 429 });

  let body: { text?: string; replyToId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const text = (body.text ?? "").trim().slice(0, 1200);
  if (!text) return NextResponse.json({ error: "متن کامنت خالی است." }, { status: 400 });

  const post = await db.post.findUnique({ where: { id }, select: { id: true } });
  if (!post) return NextResponse.json({ error: "مطلب یافت نشد." }, { status: 404 });

  // اعتبارسنجی ریپلای: والد باید از همان مطلب باشد و خودش زیرمجموعهٔ دو‌سطحی نکند
  let replyToId: string | null = null;
  if (typeof body.replyToId === "string" && body.replyToId) {
    const parent = await db.comment.findUnique({
      where: { id: body.replyToId },
      select: { id: true, postId: true, replyToId: true, user: { select: { username: true } } },
    });
    if (!parent || parent.postId !== id)
      return NextResponse.json({ error: "نظرِ مورد پاسخ یافت نشد." }, { status: 400 });
    // یک سطح عمق کافی است؛ پاسخ به پاسخ به والد اول چسبانده می‌شود
    replyToId = parent.replyToId ?? parent.id;
  }

  const c = await db.comment.create({
    data: { postId: id, userId: me.id, text, replyToId },
    include: {
      user: { select: { id: true, username: true, avatarUrl: true } },
      replyTo: { include: { user: { select: { username: true } } } },
    },
  });

  return NextResponse.json({
    ok: true,
    comment: {
      id: c.id,
      text: c.text,
      createdAt: c.createdAt.toISOString(),
      replyToId: c.replyToId ?? null,
      replyToUsername: c.replyTo?.user.username ?? null,
      userId: c.user.id,
      username: c.user.username,
      avatarUrl: c.user.avatarUrl,
    },
  });
}
