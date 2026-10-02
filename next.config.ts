import type { NextConfig } from "next";

// حالت "apk" → اکسپورت ایستا (خروجی out/ برای Capacitor) — بدون هیچ API سروری
const APK = process.env.NEXT_PUBLIC_APP_MODE === "apk";

const securityHeaders = [
  // جلوگیری از فریم‌شدن سایت در دامنه‌های دیگر (clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  // جلوگیری از MIME-sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // هیچ API حساسی به دوربین/میکروفون/مکان نیاز ندارد
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  output: APK ? "export" : "standalone",
  // در APK تصویر بهینه‌ساز سروری وجود ندارد
  images: APK ? { unoptimized: true } : undefined,
  // ⚠️ امنیت داده: فایل‌تریسینگ نباید دیتابیس/بکاپ/محیط را در خروجی کپی کند —
  // پکیج دسکتاپ عمومی است و db/custom.db شامل دادهٔ واقعی کاربران سرور است.
  outputFileTracingExcludes: {
    "*": ["./db/**", "./backups/**", "./data/**", "./upload/**", "./.env*"],
  },
  /* نشانگر گرد «N» حالت توسعه در هیچ دستگاهی نشان داده نشود */
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async headers() {
    // اکسپورت ایستا هدر سروری ندارد — هدرها سمت Capacitor/Caddy تنظیم می‌شوند
    if (APK) return [];
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
