// ترکیب همهٔ منابع کتاب برای موتور مطالعه — جزوات داخلی + دوره‌های اساتید کتابخانه‌ای + کتاب‌های وارداتی
import { builtinCourses } from "@/lib/law/courses";
import type { Course } from "@/lib/law/types";

export function mergeAll(src: { customCourses?: Course[]; tBooks?: Course[] }): Course[] {
  return [...builtinCourses, ...(src.tBooks ?? []), ...(src.customCourses ?? [])];
}
