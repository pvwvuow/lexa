// ─── حالت اجرای اپ ────────────────────────────────────────────────────────────
// "web"  → سایت/دسکتاپ (سرور استاندالون Next همهٔ /api را دارد)
// "apk"  → نسخهٔ اندروید (اکسپورت ایستا؛ بدون سرور — فقط کلاینت)
export const APP_MODE: "web" | "apk" = process.env.NEXT_PUBLIC_APP_MODE === "apk" ? "apk" : "web";
export const IS_APK = APP_MODE === "apk";
