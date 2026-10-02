import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ir.lexa.app',
  appName: 'Lexa',
  webDir: 'out',
  android: {
    // WebView مدرن اندروید — اجازهٔ بارگذاری همهٔ منابع محلی
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  server: {
    // اسکیم امن https روی لوکال‌هاست WebView — کوکی/لوکال‌استوریج پایدار
    androidScheme: 'https',
  },
};

export default config;
