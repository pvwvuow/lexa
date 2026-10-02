import path from "node:path";

/**
 * ریشهٔ پوشهٔ آپلودهای رسانه‌ای.
 *
 * وب/سرور: <cwd>/data/uploads (رفتار قدیمی — بدون تغییر)
 * دسکتاپ (الکترون): LEXA_UPLOADS_DIR را main-core به پروفایل کاربر
 * (userData/uploads) ست می‌کند تا آپلودهای کاربر:
 *   ۱) هرگز داخل باندلِ نصب نباشند (حریم خصوصی)
 *   ۲) با آپدیت دلتا بازنویسی یا پاک نشوند (دادهٔ کاربر ماندگار است)
 */
export function uploadsRoot(): string {
  const override = process.env.LEXA_UPLOADS_DIR;
  if (override && override.trim()) return override.trim();
  return path.join(process.cwd(), "data", "uploads");
}

export function avatarsDir(): string {
  return path.join(uploadsRoot(), "avatars");
}

export function coversDir(): string {
  return path.join(uploadsRoot(), "covers");
}
