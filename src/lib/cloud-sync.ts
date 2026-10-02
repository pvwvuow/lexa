"use client";
/* ─── سینک ابری خودکار Lexa — همهٔ پلتفرم‌ها (وب/دسکتاپ/APK) ──────────────────
 * «حساب، حساب است»: کاربر با یک حساب ابری (Supabase) وارد می‌شود و داده‌اش —
 * استور (پیشرفت/نشان‌ها/کتابخانهٔ من)، مباحث ضعیف و نشان‌های مواد قانونی — روی
 * همهٔ دستگاه‌ها یکی می‌شود. قواعد:
 *   ۱) ورود در همان لحظه (دیالوگ CloudAuth): ابر تازه‌تر است → اعمال؛ ابر خالی → پوش اولیه
 *   ۲) هر تغییر استور → پوش خودکار با تأخیر ۲.۵ ثانیه (debounce)
 *   ۳) بوت اپ → اگر savedAt ابر از آخرین پوشِ این دستگاه تازه‌تر بود → اعمال و رفرش
 * آخرین نویسنده برنده است؛ هیچ پاک‌سازی محلی انجام نمی‌شود (خروج فقط خروج است).
 * ─────────────────────────────────────────────────────────────────────────── */

import { useEffect } from "react";
import { useApp } from "./store";
import {
  sbUser, sbPushState, sbPullState, collectLocal, applyLocal, onAuthChange,
} from "./supabase";

// توجه: sbUser باید «همراه با تغییر نشست» خوانده شود — uidOf در هر فراخوانی تازه است

const LAST_PUSH = "lexa-cloud-lastpush"; // پسوند: :<uid> — هر حساب جدا
const BOOT_GUARD = "lexa-cloud-bootapplied";

function uidOf(): string {
  try { return sbUser()?.id || "anon"; } catch { return "anon"; }
}
function lastPush(): number {
  try { return Number(localStorage.getItem(`${LAST_PUSH}:${uidOf()}`) || 0) || 0; } catch { return 0; }
}
function setLastPush(t: number) {
  try { localStorage.setItem(`${LAST_PUSH}:${uidOf()}`, String(t)); } catch { /* ignore */ }
}

/** بلاب ابر را «اقتباس» می‌کند: اعمال + ثبت savedAt به‌عنوان آخرین وضعیت دیده‌شده.
 *  هم در بوت و هم بعد از ورود در دیالوگ استفاده می‌شود تا رفرشِ اعمال دقیقاً یک‌بار باشد.
 *  برمی‌گرداند: آیا چیزی تغییر کرد (نیازمند رفرش) */
export function adoptCloudBlob(data: unknown): boolean {
  const savedAt = Number((data as { savedAt?: number } | null)?.savedAt || 0);
  if (savedAt > lastPush() && sessionStorage.getItem(BOOT_GUARD) !== "1") {
    sessionStorage.setItem(BOOT_GUARD, "1");
    const done = applyLocal(data as Record<string, unknown>);
    setLastPush(savedAt);
    return done.length > 0;
  }
  return false;
}

/** بازیابی دستی از ابر (منوی حساب) — بدون شرطِ تازه‌تربودن همیشه اعمال می‌شود */
export function forceApplyCloudBlob(data: unknown): boolean {
  const savedAt = Number((data as { savedAt?: number } | null)?.savedAt || Date.now());
  const done = applyLocal(data as Record<string, unknown>);
  setLastPush(savedAt);
  return done.length > 0;
}

/** هوک سراسری — یک بار در AppShell سوار می‌شود */
export function useCloudAutoSync() {
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pullDone = false; // پوش تا پایان pull بوت صبر می‌کند — جلوگیری از له‌کردن دادهٔ تازه‌ترِ ابر
    const logged = () => !!sbUser();

    const schedulePush = (ms: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(flushPush, ms);
    };
    const flushPush = async () => {
      timer = null;
      if (disposed || !logged()) return;
      if (!pullDone) { schedulePush(1200); return; } // بوت هنوز ابر را بررسی نکرده
      try {
        const blob = collectLocal();
        const err = await sbPushState(blob);
        if (!err) setLastPush(Number(blob.savedAt || Date.now()));
      } catch { /* آفلاین — تغییر بعدی دوباره تلاش می‌کند */ }
    };

    // ۱) بوت: ابر تازه‌تر از آخرین پوش این دستگاه؟ → اعمال و رفرش یک‌باره
    (async () => {
      try {
        if (logged()) {
          const { err, data } = await sbPullState();
          if (!disposed && !err && data) {
            if (adoptCloudBlob(data)) {
              setTimeout(() => window.location.reload(), 350);
              return;
            }
          }
        }
      } catch { /* آفلاین — پوش خودکار بعداً جبران می‌کند */ }
      pullDone = true;
    })();

    // ۲) تغییر استور → پوش با تأخیر
    const unsub = useApp.subscribe(() => {
      if (!logged()) return;
      schedulePush(2500);
    });

    // ۳) پس از ورود وسط نشست (دیالوگ ابر خودش pull/push اولیه را می‌زند) —
    //    فقط محافظ بوت را پاک کنیم تا رفرشِ اعمالِ ابر یک‌باره ممکن باشد
    const off = onAuthChange(() => {
      try { sessionStorage.removeItem(BOOT_GUARD); } catch { /* ignore */ }
    });

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      unsub();
      off();
    };
  }, []);
}
