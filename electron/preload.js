/* ─── Lexa — پل امن بین رندرر و فرآیند اصلی (به‌روزرسانی برنامه) ────────────
 * contextIsolation روشن است؛ فقط این API محدود در window.lexaDesktop دیده
 * می‌شود — هیچ دسترسی Node مستقیمی به رندرر داده نمی‌شود.
 * ─────────────────────────────────────────────────────────────────────── */

"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lexaDesktop", {
  /** وضعیت دسکتاپ: نسخه، پلتفرم، اجرا از لایهٔ آپدیت‌شده یا باندل */
  status: () => ipcRenderer.invoke("lexa:update:status"),
  /** بررسی به‌روزرسانی → AppUpdateCheck */
  check: () => ipcRenderer.invoke("lexa:update:check"),
  /** دانلود و نصب آپدیت (پیشرفت با onEvent) → { ok, version } */
  apply: () => ipcRenderer.invoke("lexa:update:apply"),
  /** راه‌اندازی مجدد برای ورود به نسخهٔ جدید */
  restart: () => ipcRenderer.invoke("lexa:update:restart"),
  /** گوش دادن به رویدادها (بررسی بی‌صدای استارتاپ + پیشرفت آپدیت) */
  onEvent: (cb) => {
    const handler = (_e, ev) => {
      try {
        cb(ev);
      } catch {
        /* بی‌اثر */
      }
    };
    ipcRenderer.on("lexa:update:event", handler);
    return () => ipcRenderer.removeListener("lexa:update:event", handler);
  },
});
