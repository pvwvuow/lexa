import type { NextConfig } from "next";

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
  output: "standalone",
  /* نشانگر گرد «N» حالت توسعه در هیچ دستگاهی نشان داده نشود */
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
