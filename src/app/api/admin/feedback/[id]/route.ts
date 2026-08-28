import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

/** تایید یا رد یک پیشنهاد بازخورد — فقط مدیر؛ رکورد هرگز حذف نمی‌شود */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me)
    return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });
  if (me.role !== "admin")
    return NextResponse.json({ error: "دسترسی ویژهٔ مدیر است." }, { status: 403 });

  const { id } = await params;

  let body: { status?: string; adminNote?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  if (!["approved", "rejected"].includes(body.status ?? ""))
    return NextResponse.json({ error: "وضعیت باید approved یا rejected باشد." }, { status: 400 });

  try {
    const rec = await db.lessonFeedback.update({
      where: { id },
      data: {
        status: body.status!,
        adminNote: typeof body.adminNote === "string" ? body.adminNote.slice(0, 2000) : undefined,
        reviewedAt: new Date(),
      },
    });
    return NextResponse.json({
      ok: true,
      status: rec.status,
      adminNote: rec.adminNote,
      reviewedAt: rec.reviewedAt?.toISOString() ?? null,
    });
  } catch {
    return NextResponse.json({ error: "پیشنهاد یافت نشد." }, { status: 404 });
  }
}
