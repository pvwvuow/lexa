import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/app/theme-provider";
import { SwRegister } from "@/components/app/SwRegister";
import { compatScript, errorOverlayScript, apkApiShimScript } from "@/lib/compat-script";

const IS_APK = process.env.NEXT_PUBLIC_APP_MODE === "apk";

export const metadata: Metadata = {
  title: "Lexa — استاد حقوقی هوشمند",
  description:
    "اپلیکیشن آموزشی حقوق برای دانشجویان کارشناسی؛ تدریس مرحله‌به‌مرحله حقوق مدنی و تجارت با استاد هوش مصنوعی، تست، فلش‌کارت و تحلیل پیشرفت.",
  icons: { icon: "/favicon.svg", apple: "/icons/apple-touch-icon.png" },
  manifest: "/manifest.webmanifest",
  applicationName: "Lexa",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Lexa" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0d211a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // perf-lite: پروفایل کارایی موبایل — در APK بلورها/انیمیشن‌های سنگین خاموش
    // می‌شوند تا اسکرول و رندر روی WebView گوشی سبک بماند (globals.css)
    <html lang="fa" dir="rtl" suppressHydrationWarning className={IS_APK ? "perf-lite" : undefined}>
      <head>
        {/* پلی‌فیل‌های سازگاری — باید قبل از همهٔ چانک‌ها اجرا شود (WebView قدیمی) */}
        <script dangerouslySetInnerHTML={{ __html: compatScript }} />
        {/* اورلی خطا + شیم /api برای APK — کاربر devtools ندارد و سرور محلی 200+HTML برمی‌گرداند */}
        {IS_APK ? <script dangerouslySetInnerHTML={{ __html: apkApiShimScript }} /> : null}
        {IS_APK ? <script dangerouslySetInnerHTML={{ __html: errorOverlayScript }} /> : null}
        {/* اعمال زودهنگام تم (روز/شب/شیشه‌ای) قبل از اولین رنگ‌آمیزی — بدون فلش */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("lexa-theme")||localStorage.getItem("hh-theme")||localStorage.getItem("theme")||"light";var c=document.documentElement.classList;if(t==="dark")c.add("dark");else if(t==="glass")c.add("theme-glass");}catch(e){}})();`,
          }}
        />
      </head>
      <body className="antialiased bg-background text-foreground min-h-screen flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
        <SwRegister />
      </body>
    </html>
  );
}
