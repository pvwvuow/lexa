// ─── امتیاز ستاره‌ای به مطلب یا دورهٔ استاد ────────────────────────────────────
// هر کاربر یک رأی برای هر هدف دارد و می‌تواند آن را تغییر دهد.
// میانگین بالاتر ⇒ در فیدها و کتابخانهٔ عمومی جلوتر دیده می‌شود.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { ratingsAggOne } from "@/lib/ratings-server";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TargetType = "post" | "tcourse";

async function exists(type: TargetType, id: string): Promise<boolean> {
  if (!id) return false;
  if (type === "post") return !!(await db.post.findUnique({ where: { id }, select: { id: true } }));
  return !!(await db.teacherCourse.findUnique({ where: { id }, select: { id: true } }));
}

function parseTarget(v: unknown): TargetType | null {
  return v === "post" || v === "tcourse" ? v : null;
}

/** دریافت وضعیت امتیاز یک هدف (میانگین، تعداد، رأی خود من) */
export async function GET(req: NextRequest) {
  const targetType = parseTarget(req.nextUrl.searchParams.get("targetType"));
  const targetId = req.nextUrl.searchParams.get("targetId") ?? "";
  if (!targetType || !targetId)
    return NextResponse.json({ error: "هدف امتیاز نامعتبر است." }, { status: 400 });

  const me = await getSessionUser();
  const agg = await ratingsAggOne(targetType, targetId);
  let my: number | null = null;
  if (me) {
    const r = await db.rating.findUnique({
      where: { userId_targetType_targetId: { userId: me.id, targetType, targetId } },
      select: { stars: true },
    });
    my = r?.stars ?? null;
  }
  return NextResponse.json({ ...agg, my });
}

/** ثبت یا تغییر امتیاز */
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "برای امتیاز دادن ابتدا وارد شوید." }, { status: 401 });
  if (!rateLimit(req, `rating:${me.id}`, 40, 60_000))
    return NextResponse.json({ error: "امتیازها را با فاصلهٔ زمانی ثبت کنید." }, { status: 429 });

  let body: { targetType?: unknown; targetId?: unknown; stars?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const targetType = parseTarget(body.targetType);
  const targetId = String(body.targetId ?? "");
  const stars = Number(body.stars);
  if (!targetType)
    return NextResponse.json({ error: "نوع هدف باید post یا tcourse باشد." }, { status: 400 });
  if (!Number.isInteger(stars) || stars < 1 || stars > 5)
    return NextResponse.json({ error: "امتیاز باید عددی بین ۱ تا ۵ باشد." }, { status: 400 });
  if (!(await exists(targetType, targetId)))
    return NextResponse.json({ error: "مورد موردنظر یافت نشد." }, { status: 404 });

  // upsert — تاریخچه حفظ نمی‌شود ولی رأی آخر مهم است؛ رکورد ابدی می‌ماند
  await db.rating.upsert({
    where: { userId_targetType_targetId: { userId: me.id, targetType, targetId } },
    update: { stars },
    create: { userId: me.id, targetType, targetId, stars },
  });

  const agg = await ratingsAggOne(targetType, targetId);
  return NextResponse.json({ ok: true, ...agg, my: stars });
}
