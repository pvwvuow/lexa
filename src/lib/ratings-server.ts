// ─── ابزار تجمیع امتیازها (سمت سرور) ─────────────────────────────────────────
import { db } from "@/lib/db";

export interface RatingAgg {
  avg: number; // میانگین ستاره‌ها ۰ تا ۵ (بدون رأی = صفر)
  count: number; // تعداد رأی‌دهندگان
}

/** میانگین و تعداد امتیاز یک دسته از هدف‌ها را یک‌جا برمی‌گرداند */
export async function ratingsAggMany(
  targetType: "post" | "tcourse",
  targetIds: string[],
): Promise<Map<string, RatingAgg>> {
  const map = new Map<string, RatingAgg>();
  if (!targetIds.length) return map;
  const rows = await db.rating.groupBy({
    by: ["targetId"],
    where: { targetType, targetId: { in: targetIds } },
    _avg: { stars: true },
    _count: { _all: true },
  });
  for (const r of rows) {
    map.set(r.targetId, {
      avg: Math.round((r._avg.stars ?? 0) * 10) / 10,
      count: r._count._all,
    });
  }
  return map;
}

export async function ratingsAggOne(
  targetType: "post" | "tcourse",
  targetId: string,
): Promise<RatingAgg> {
  const rows = await db.rating.aggregate({
    where: { targetType, targetId },
    _avg: { stars: true },
    _count: { _all: true },
  });
  return { avg: Math.round((rows._avg.stars ?? 0) * 10) / 10, count: rows._count._all };
}

/**
 * نمرهٔ رتبه‌بندی فید/کتابخانه: امتیاز بالا ⇒ جلوتر، ولی تازگی هم مهم است.
 * وزن امتیاز با جذرِ تعداد رأی کنترل می‌شود تا یکی دو رأی فیل نشود.
 */
export function feedScore(createdAtISO: string | Date, agg?: RatingAgg): number {
  const t = typeof createdAtISO === "string" ? new Date(createdAtISO).getTime() : createdAtISO.getTime();
  const ageDays = Math.max(0, (Date.now() - t) / 86_400_000);
  const ratingW = agg && agg.count > 0 ? agg.avg * Math.min(1.2, Math.sqrt(agg.count) / 2) : 0;
  return ratingW * 2 - ageDays * 0.35;
}
