// ترکیب همهٔ منابع کتاب برای موتور مطالعه — جزوات داخلی + دوره‌های اساتید کتابخانه‌ای + کتاب‌های وارداتی
import { builtinCourses } from "@/lib/law/courses";
import type { Course } from "@/lib/law/types";

export function mergeAll(src: { customCourses?: Course[]; tBooks?: Course[] }): Course[] {
  return [...builtinCourses, ...(src.tBooks ?? []), ...(src.customCourses ?? [])];
}

/**
 * مانند mergeAll ولی دوره‌های داخلیِ حذف‌شده از «کتابخانهٔ من» (hiddenBuiltins)
 * از فهرست‌ها کنار می‌روند؛ برای همهٔ سطح‌های نمایشی (سایدبار، جستجو، آزمون و …).
 * نکته: باز شدن مستقیم با شناسه همچنان کار می‌کند تا پیشرفت هرگز قابل‌دسترس نبودن نشود.
 */
export function mergeVisible(src: {
  customCourses?: Course[];
  tBooks?: Course[];
  hiddenBuiltins?: string[];
}): Course[] {
  const hidden = new Set(src.hiddenBuiltins ?? []);
  const base = builtinCourses.filter((c) => !hidden.has(c.id));
  return [...base, ...(src.tBooks ?? []), ...(src.customCourses ?? [])];
}
