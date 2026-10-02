"use client";
/* ─── فراخوانی استاد هوشمند ─────────────────────────────────────────────────
 * وب/دسکتاپ: درخواست به /api/ai سرور (rate-limit + builtin سرور).
 * اندروید (APK): بدون سرور — وظیفه مستقیماً در کلاینت اجرا می‌شود؛ فقط
 * پروایدرهای دارای کلید کاربر (Gemini / سازگار با OpenAI) کار می‌کنند.
 * ─────────────────────────────────────────────────────────────────────────── */
import { useApp } from "@/lib/store";
import { IS_APK } from "@/lib/app-mode";
import type { AiTaskBody } from "@/lib/ai/tasks";

export async function askAi<T = { text: string }>(body: Record<string, unknown>): Promise<T> {
  const { ai } = useApp.getState();

  if (IS_APK) {
    const { runAiTask, PERSIAN_FAIL, AiTaskError } = await import("@/lib/ai/tasks");
    if (!ai.apiKey || ai.provider === "builtin") {
      throw new Error(
        "در نسخهٔ اندروید، استاد هوشمند با کلید API شخصی شما کار می‌کند — از تنظیمات، یکی از پروایدرهای Gemini یا سازگار با OpenAI و کلیدش را ثبت کن."
      );
    }
    try {
      const result = await runAiTask({ ...(body as unknown as AiTaskBody), ai });
      return result as T;
    } catch (e) {
      if (e instanceof AiTaskError) throw e;
      throw new Error(`${PERSIAN_FAIL}\n(${e instanceof Error ? e.message : String(e)})`);
    }
  }

  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, ai }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "ارتباط با استاد برقرار نشد.");
  return json as T;
}
