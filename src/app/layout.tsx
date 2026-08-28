import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/app/theme-provider";

export const metadata: Metadata = {
  title: "همیار حقوق — استاد حقوقی هوشمند",
  description:
    "اپلیکیشن آموزشی حقوق برای دانشجویان کارشناسی؛ تدریس مرحله‌به‌مرحله حقوق مدنی و تجارت با استاد هوش مصنوعی، تست، فلش‌کارت و تحلیل پیشرفت.",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground min-h-screen flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
