import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ir.lexa.app',
  appName: 'Lexa',
  webDir: 'out',
  android: {
    allowMixedContent: false,
    // ⚠️ captureInput باید false بماند (0.10.9): با true، کاپاسیتور ورودی کیبورد را با
    // BaseInputConnection ساده جایگزین می‌کند و برای حروف غیرلاتین (فارسی) رویداد input
    // تا وقتی حرفی پاک نشود نمی‌رسد — ریشهٔ باگ «جستجو تا پاک‌کردن آخرین حرف نتیجه نمی‌دهد».
    // (ionic-team/capacitor#757 و #8193)
    captureInput: false,
    webContentsDebuggingEnabled: false,
  },
  server: {
    // اسکیم امن https روی لوکال‌هاست WebView — کوکی/لوکال‌استوریج پایدار
    androidScheme: 'https',
  },
};

export default config;
