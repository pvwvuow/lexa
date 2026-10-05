"use client";
/* ─── وضعیت نوار بالای اصلی (پنهان با اسکرول در موبایل) — مشترک بین AppShell و صفحه‌ها ───
 * نوارهای چسبان صفحه‌ها (مثل نوار جستجوی قانون) وقتی نوار اصلی پنهان شد، جای آن را
 * می‌گیرند و بالا می‌روند. مقدار فقط وقتی true است که نوار واقعاً پنهان است (موبایل). */
import * as React from "react";

let hidden = false;
const subs = new Set<() => void>();

export function setChromeHidden(v: boolean) {
  if (hidden === v) return;
  hidden = v;
  subs.forEach((f) => f());
}

export function useChromeHidden(): boolean {
  return React.useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => { subs.delete(cb); };
    },
    () => hidden,
    () => false,
  );
}
