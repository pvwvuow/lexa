"use client";

import { useApp } from "@/lib/store";

/** فراخوانی استاد هوشمند با تنظیمات ذخیره‌شده کاربر */
export async function askAi<T = { text: string }>(body: Record<string, unknown>): Promise<T> {
  const { ai } = useApp.getState();
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, ai }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "ارتباط با استاد برقرار نشد.");
  return json as T;
}
