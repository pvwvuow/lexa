import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureAdmin, getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** فهرست همهٔ پیشنهادهای بازخورد — فقط برای مدیر */
export async function GET() {
  await ensureAdmin();
  const me = await getSessionUser();
  if (!me)
    return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });
  if (me.role !== "admin")
    return NextResponse.json({ error: "دسترسی ویژهٔ مدیر است." }, { status: 403 });

  try {
    const rows = await db.lessonFeedback.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { username: true, role: true } } },
    });

    const items = rows.map((r) => ({
      id: r.id,
      username: r.user.username,
      userRole: r.user.role,
      courseId: r.courseId,
      chapterTitle: r.chapterTitle,
      lessonId: r.lessonId,
      lessonTitle: r.lessonTitle,
      matchPercent: r.matchPercent,
      needsChange: r.needsChange,
      severity: r.severity,
      status: r.status,
      adminNote: r.adminNote,
      createdAt: r.createdAt.toISOString(),
      reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
      analysis: r.analysis,
      suggestion: r.suggestion,
      conversationCount: Array.isArray(r.conversation)
        ? (r.conversation as unknown[]).length
        : (() => { try { return JSON.parse(String(r.conversation)).length ?? 0; } catch { return 0; } })(),
      messages: (() => {
        try {
          const arr = Array.isArray(r.conversation) ? r.conversation : JSON.parse(String(r.conversation));
          return (arr as { role?: string; content?: string }[])
            .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content ?? "") }))
            .slice(0, 40);
        } catch { return []; }
      })(),
    }));

    const totals = {
      all: items.length,
      pending: items.filter((i) => i.status === "pending").length,
      approved: items.filter((i) => i.status === "approved").length,
      rejected: items.filter((i) => i.status === "rejected").length,
      avgMatch:
        items.length > 0
          ? Math.round(items.reduce((s, i) => s + i.matchPercent, 0) / items.length)
          : null,
    };

    return NextResponse.json({ items, totals });
  } catch (err) {
    console.error("[admin/feedback]", err);
    return NextResponse.json({ error: "خواندن پیشنهادها ناموفق بود." }, { status: 500 });
  }
}
