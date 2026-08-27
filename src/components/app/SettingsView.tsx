"use client";

import * as React from "react";
import { KeyRound, Bot, Wand2, ShieldCheck, Loader2, CheckCircle2 } from "lucide-react";
import { useApp } from "@/lib/store";
import type { AiProvider } from "@/lib/store";
import { askAi } from "@/lib/aiClient";

const PROVIDERS: { key: AiProvider; title: string; desc: string; hint: string }[] = [
  { key: "builtin", title: "استاد داخلی (پیشفرض)", desc: "بدون نیاز به هیچ کلیدی؛ آمادهٔ استفاده", hint: "" },
  { key: "gemini", title: "Google Gemini", desc: "با کلید API گوگل؛ مثل gemini-2.0-flash", hint: "کلید را از aistudio.google.com بگیر" },
  { key: "openai", title: "سازگار با OpenAI", desc: "هر سرویس با آدرس /v1/chat/completions (OpenAI، GPT، DeepSeek، القلب و…)", hint: "آدرس پایه مثل https://api.openai.com/v1" },
];

export function SettingsView() {
  const ai = useApp((s) => s.ai);
  const update = useApp((s) => s.updateAi);
  const [testing, setTesting] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; msg: string } | null>(null);

  async function testConnection() {
    setTesting(true); setResult(null);
    try {
      const res = await askAi<{ text: string }>({ task: "free", mode: "QA", question: "فقط بنویس: استاد در دسترس است" });
      setResult({ ok: true, msg: res.text.slice(0, 120) || "اتصال برقرار است." });
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : "خطای ناشناخته" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-24 pt-6 sm:px-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><KeyRound className="h-6 w-6 text-bronze" /> تنظیمات هوش مصنوعی</h1>
        <p className="mt-1 text-sm text-muted-foreground">موتور «استاد حقوقی هوشمند» را انتخاب کن. کلید API فقط در مرورگر خودت ذخیره میشود و به هیچ سروری ارسال نمیشود جز مستقیم برای همان ارائهدهنده.</p>
      </header>

      {/* انتخاب پروایدر */}
      <section className="space-y-3">
        {PROVIDERS.map((p) => (
          <button
            key={p.key}
            onClick={() => update({ provider: p.key })}
            aria-pressed={ai.provider === p.key}
            className={`w-full rounded-2xl border p-4 text-start transition-all duration-200 ${ai.provider === p.key ? "border-bronze bg-gradient-to-l from-bronze/[0.09] to-transparent shadow-card ring-1 ring-inset ring-bronze/30" : "border-border bg-card hover:-translate-y-px hover:border-muted-foreground/40 hover:shadow-card"}`}
          >
            <div className="flex items-center gap-3">
              {p.key === "builtin" ? <Bot className="h-5 w-5 text-primary" /> : p.key === "gemini" ? <Wand2 className="h-5 w-5 text-primary" /> : <KeyRound className="h-5 w-5 text-primary" />}
              <div className="flex-1">
                <p className="font-bold">{p.title}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{p.desc}</p>
              </div>
              <span className={`h-4 w-4 rounded-full border-[5px] transition-colors ${ai.provider === p.key ? "border-bronze bg-white" : "border-border"}`} />
            </div>
          </button>
        ))}
      </section>

      {/* فیلدهای اختصاصی */}
      {ai.provider !== "builtin" && (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <Field label={ai.provider === "gemini" ? "مدل Gemini" : "نام مدل"} value={ai.model} onChange={(m) => update({ model: m })} placeholder={ai.provider === "gemini" ? "gemini-2.0-flash" : "gpt-4o-mini"} />
          {ai.provider === "openai" && (
            <Field label="آدرس پایه (Base URL)" value={ai.baseUrl} onChange={(b) => update({ baseUrl: b })} placeholder="https://api.openai.com/v1" dirAuto />
          )}
          <div>
            <label className="mb-1 block text-sm font-semibold">کلید API <span className="text-danger">*</span></label>
            <input
              type="password"
              value={ai.apiKey}
              onChange={(e) => update({ apiKey: e.target.value })}
              placeholder="AIza… یا sk-…"
              autoComplete="off"
              className="h-11 w-full rounded-xl border border-input bg-background px-3 outline-none transition-colors focus:border-bronze"
            />
          </div>
        </section>
      )}

      {/* شدت خلاقیت */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <label className="mb-2 block text-sm font-semibold" htmlFor="temp">سطح پیروی از متن (دمای مدل): {ai.temperature}</label>
        <input id="temp" type="range" min={0} max={1} step={0.05} value={ai.temperature}
          onChange={(e) => update({ temperature: Number(e.target.value) })} className="w-full accent-[var(--bronze)]" />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>دقیق و قانون‌محور</span><span>خلاق و آزاد</span></div>
      </section>

      {/* تست اتصال */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="mb-3 text-sm font-semibold">بررسی سلامت استاد</p>
        <button onClick={testConnection} disabled={testing} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {testing && <Loader2 className="h-4 w-4 animate-spin" />}
          تست اتصال
        </button>
        {result && (
          <p className={`mt-3 rounded-xl p-3 text-sm leading-relaxed ${result.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
            {result.ok && <CheckCircle2 className="me-1 inline h-4 w-4 align-text-bottom" />}{result.msg}
          </p>
        )}
      </section>

      <p className="flex items-start gap-2 rounded-2xl bg-accent p-4 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        امنیت: کلید تو فقط روی همین دستگاه (localStorage مرورگر) میماند. اگر دستگاه مشترک است، پس از استفاده آن را پاک کن.
      </p>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, dirAuto }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; dirAuto?: boolean }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir={dirAuto ? undefined : "auto"}
        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-left outline-none transition-colors focus:border-bronze"
      />
    </div>
  );
}
