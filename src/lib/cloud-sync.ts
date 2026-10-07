"use client";
/* ─── سینک ابری خودکار Lexa — همهٔ پلتفرم‌ها (وب/دسکتاپ/APK) ──────────────────
 * «حساب، حساب است»: کاربر با یک حساب ابری (Supabase) وارد می‌شود و داده‌اش —
 * استور (پیشرفت/نشان‌ها/کتابخانهٔ من)، مباحث ضعیف و نشان‌های مواد قانونی — روی
 * همهٔ دستگاه‌ها یکی می‌شود. قواعد:
 *   ۱) ورود در همان لحظه (دیالوگ CloudAuth / کارت تنظیمات): ابر تازه‌تر است → اعمال؛
 *      ابر خالی → پوش اولیه؛ دریافت ناموفق → هیچ پوشی (حساب دست‌نخورده می‌ماند).
 *      در طول ورود، پوش خودکار معلق است (holdCloudPush).
 *   ۲) هر تغییر استور → پوش خودکار با تأخیر ۲.۵ ثانیه (debounce)
 *   ۳) بوت اپ → اگر حساب نشست با حساب قبلی دستگاه فرق داشت → پاک‌سازی دادهٔ محلی؛
 *              اگر savedAt ابر از آخرین پوش این دستگاه تازه‌تر بود → اعمال و رفرش؛
 *              ابر هنوز هیچ بلابی ندارد → پوش اولیه همان لحظه (دادهٔ دستگاه بی‌پشتیبان نمی‌ماند)
 * آخرین نویسنده برنده است؛ پوش‌ها پشت‌سرهم (هم‌زمان نه) ارسال می‌شوند تا بلابِ کهنه‌تر
 * هرگز بعد از بلابِ تازه‌تر به سرور نرسد. با خروج/تعویض حساب دادهٔ محلی پاک می‌شود تا
 * هیچ نشتی بین حساب‌ها (نشان‌ها، پیشرفت، کتاب‌ها) رخ ندهد.
 * ─────────────────────────────────────────────────────────────────────────── */

import { useEffect } from "react";
import { useApp } from "./store";
import {
  sbUser, sbPushState, sbPullState, collectLocal, applyLocal, onAuthChange,
} from "./supabase";

// توجه: sbUser باید «همراه با تغییر نشست» خوانده شود — uidOf در هر فراخوانی تازه است

const LAST_PUSH = "lexa-cloud-lastpush"; // پسوند: :<uid> — هر حساب جدا
const BOOT_GUARD = "lexa-cloud-bootapplied";
const LAST_UID = "lexa-cloud-lastuid"; // آخرین حساب واردشدهٔ این دستگاه — برای تشخیص تعویض حساب

/** شمارندهٔ تعلیق پوش خودکار — تا پایان بررسی ابرِ ورود، دادهٔ پاک‌شده/کهنه به ابر نمی‌رود */
let pushHold = 0;
export function holdCloudPush(on: boolean) {
  pushHold = Math.max(0, pushHold + (on ? 1 : -1));
}

function uidOf(): string {
  try { return sbUser()?.id || "anon"; } catch { return "anon"; }
}
function lastPush(): number {
  try { return Number(localStorage.getItem(`${LAST_PUSH}:${uidOf()}`) || 0) || 0; } catch { return 0; }
}
function setLastPush(t: number) {
  try { localStorage.setItem(`${LAST_PUSH}:${uidOf()}`, String(t)); } catch { /* ignore */ }
}

/** آخرین حساب واردشدهٔ این دستگاه را ثبت می‌کند */
export function noteCloudUid(uid: string) {
  try { localStorage.setItem(LAST_UID, uid); } catch { /* ignore */ }
}
/** آخرین حساب واردشدهٔ این دستگاه — اگر نباشد یعنی تا حالا حساب ابری روی این دستگاه نبوده */
export function priorCloudUid(): string | null {
  try { return localStorage.getItem(LAST_UID); } catch { return null; }
}

/** زمان آخرین ذخیرهٔ موفق روی ابر برای حساب جاری (ms) — برای نمایش «آخرین ذخیره» به کاربر */
export function cloudLastPushAt(): number {
  return lastPush();
}

/** پس از هر پوش دستی موفق (ورود/خروج) زمان آن ثبت شود */
export function noteCloudPushed(savedAt: unknown) {
  setLastPush(Number(savedAt || Date.now()));
}

/**
 * پاک‌سازی کامل «دادهٔ کاربر» از دستگاه — برای تعویض حساب و خروج.
 * نشان‌ها/پیشرفت/یادداشت‌ها/کتاب‌ها/تاریخچهٔ آزمون/مباحث ضعیف/نشان‌های قانون
 * همه پاک می‌شوند تا هرگز به حساب بعدی نشت نکنند. تنظیمات AI حفظ می‌شود.
 */
export function wipeLocalUserData() {
  try { localStorage.removeItem("lexa-law-marks"); } catch { /* ignore */ }
  try { localStorage.removeItem("hoh_weak_topics"); } catch { /* ignore */ }
  try { useApp.getState().reset(); } catch { /* ignore */ }
}

/**
 * تشخیص تعویض حساب روی این دستگاه: اگر قبلاً حساب دیگری وارد شده بود و uid جدید
 * با آن فرق داشت، دادهٔ محلی (نشان‌ها/پیشرفت/…) متعلق به حساب قبلی است و هرگز
 * نباید به حساب جدید برسد — پاک می‌شود. خروجی: آیا تعویض (و پاک‌سازی) رخ داد.
 * هم در دیالوگ ورود (CloudAuth) و هم در بوت (useCloudAutoSync) صدا زده می‌شود.
 */
export function handleAccountSwitch(newUid: string | null | undefined): boolean {
  if (!newUid) return false;
  const prev = priorCloudUid();
  const switched = !!prev && prev !== newUid;
  if (switched) wipeLocalUserData();
  noteCloudUid(newUid);
  return switched;
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

/** هوک سراسری — یک بار در AppShell سوار می‌شود */
export function useCloudAutoSync() {
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pullDone = false; // پوش تا پایان pull بوت صبر می‌کند — جلوگیری از له‌کردن دادهٔ تازه‌ترِ ابر
    let pushing = false; // فقط یک پوش در جریان — بلاب کهنه هرگز بعد از بلاب تازه نمی‌رسد
    const logged = () => !!sbUser();

    const schedulePush = (ms: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(flushPush, ms);
    };
    const flushPush = async () => {
      timer = null;
      if (disposed || !logged()) return;
      if (!pullDone) { schedulePush(1200); return; } // بوت هنوز ابر را بررسی نکرده
      if (pushHold > 0) { schedulePush(1500); return; } // ورود در جریان — ابر هنوز بررسی نشده
      if (pushing) { schedulePush(400); return; } // پوش قبلی هنوز تمام نشده
      pushing = true;
      try {
        const blob = collectLocal();
        const err = await sbPushState(blob);
        if (!err) setLastPush(Number(blob.savedAt || Date.now()));
      } catch { /* آفلاین — تغییر بعدی دوباره تلاش می‌کند */ }
      finally { pushing = false; }
    };

    // ۱) بوت: اگر حسابِ نشست با آخرین حساب واردشدهٔ دستگاه فرق داشت، دادهٔ حساب قبلی
    //    نباید به این حساب برسد — پاک‌سازی، بعد ابر مرجع است.
    //    سپس: ابر تازه‌تر از آخرین پوش این دستگاه؟ → اعمال و رفرش یک‌باره
    //    ابر خالی؟ → پوش اولیه همان لحظه
    (async () => {
      let cloudEmpty = false;
      try {
        const u = sbUser();
        if (u) {
          // تعویض حساب نسبت به آخرین بوت — نشت دادهٔ حساب قبلی ممنوع
          handleAccountSwitch(u.id);
        }
        if (logged()) {
          const { err, data } = await sbPullState();
          if (!disposed && !err) {
            const hasData = !!data && typeof data === "object" && Object.keys(data as object).length > 0;
            if (hasData && adoptCloudBlob(data)) {
              setTimeout(() => window.location.reload(), 350);
              return;
            }
            cloudEmpty = !hasData;
          }
        }
      } catch { /* آفلاین — پوش خودکار بعداً جبران می‌کند */ }
      pullDone = true;
      if (cloudEmpty && !disposed) schedulePush(0);
    })();

    // ۲) تغییر استور → پوش با تأخیر
    const unsub = useApp.subscribe(() => {
      if (!logged()) return;
      schedulePush(2500);
    });

    // ۳) پس از ورود وسط نشست (دیالوگ/کارت ابر خودش pull/push اولیه را می‌زند) —
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
