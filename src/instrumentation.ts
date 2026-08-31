/**
 * Next.js instrumentation — نقطهٔ ورود نگهبان داده‌ها
 * فقط در رانتایم nodejs (نه edge) و نه در فاز build
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startDataGuard } = await import("@/lib/data-guard");
  startDataGuard();
}
