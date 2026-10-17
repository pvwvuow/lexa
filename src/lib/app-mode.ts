// ─── حالت اجرای اپ ────────────────────────────────────────────────────────────
// "web"  → سایت/دسکتاپ (سرور استاندالون Next همهٔ /api را دارد)
// "apk"  → نسخهٔ اندروید (اکسپورت ایستا؛ بدون سرور — فقط کلاینت)
export const APP_MODE: "web" | "apk" = process.env.NEXT_PUBLIC_APP_MODE === "apk" ? "apk" : "web";
export const IS_APK = APP_MODE === "apk";

// Teachers, posts, courses and organisations come from the shared cloud
// (Supabase, see supabase/002_cloud_social.sql) on every platform — web,
// Android and desktop see one copy. NEXT_PUBLIC_CLOUD_SOCIAL=0 restores the old
// per-server SQLite social routes.
export const CLOUD_SOCIAL = process.env.NEXT_PUBLIC_CLOUD_SOCIAL !== "0";
/** social screens are unavailable only in a static build with cloud social turned off */
export const SOCIAL_OFF = IS_APK && !CLOUD_SOCIAL;
