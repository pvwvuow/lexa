"use client";

// ─── تنظیمات — عمومی (پروفایل، آواتار، رمز) + هوش مصنوعی ──────────────────────
import * as React from "react";
import {
  KeyRound, Bot, Wand2, ShieldCheck, Loader2, CheckCircle2,
  UserCog, Upload, Trash2, Camera, GraduationCap, User as UserIcon, Save, WifiOff,
  Palette, Sun, Moon, Droplets,
} from "lucide-react";
import { useApp } from "@/lib/store";
import type { AiProvider } from "@/lib/store";
import { askAi } from "@/lib/aiClient";
import { useAuth } from "@/lib/auth-client";
import { fa } from "@/lib/fa";
import { UserAvatar } from "./common";
import { OfflineSettings } from "./OfflineSettings";
import { applyTheme, readStoredTheme, type AppTheme } from "./theme-provider";

type Tab = "general" | "ai" | "offline";

export function SettingsView() {
  const [tab, setTab] = React.useState<Tab>("general");

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-24 pt-6 sm:px-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><KeyRound className="h-6 w-6 text-bronze" /> تنظیمات</h1>
        <p className="mt-1 text-sm text-muted-foreground">پروفایل و حساب کاربری خودت را مدیریت کن؛ نصب آفلاین و استاد هوشمند هم همین‌جاست.</p>
      </header>

      {/* زبانه‌ها */}
      <div role="tablist" aria-label="بخش‌های تنظیمات" className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-muted/50 p-1">
        {([["general", "عمومی", UserIcon], ["ai", "هوش مصنوعی", Bot], ["offline", "آفلاین", WifiOff]] as const).map(([k, t, Ico]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`inline-flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-all ${
              tab === k ? "bg-card text-bronze shadow-card" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Ico className="h-4 w-4" /> {t}
          </button>
        ))}
      </div>

      {/* انتخاب تم — همیشه نمایان */}
      <ThemePicker />

      {tab === "general" ? <GeneralSettings /> : tab === "ai" ? <AiSettings /> : <OfflineSettings />}
    </div>
  );
}

/* ═══ انتخاب تم — روز / شب / شیشه‌ای (همیشه نمایان، حتی بدون ورود) ═════════ */

const THEME_OPTIONS: {
  key: AppTheme;
  title: string;
  desc: string;
  Icon: React.ComponentType<{ className?: string }>;
  preview: string;
  chip: string;
}[] = [
  {
    key: "light",
    title: "روز",
    desc: "آلاباستر گرم و یشمی عمیق",
    Icon: Sun,
    preview: "bg-gradient-to-br from-[#f5f3ed] to-[#e9e6dc]",
    chip: "bg-[#1d4b40]",
  },
  {
    key: "dark",
    title: "شب",
    desc: "زغالی با ته‌مایهٔ سبز و برنج براق",
    Icon: Moon,
    preview: "bg-gradient-to-br from-[#101512] to-[#232b26]",
    chip: "bg-[#2a604f]",
  },
  {
    key: "glass",
    title: "شیشه‌ای",
    desc: "شیشهٔ مایع کامل روی والپاپر آۆرایی",
    Icon: Droplets,
    preview: "bg-[radial-gradient(120px_80px_at_20%_0%,rgba(150,200,172,0.55),transparent),radial-gradient(120px_80px_at_100%_60%,rgba(233,211,160,0.55),transparent),linear-gradient(160deg,#f2f5ee,#e7ede4)]",
    chip: "bg-white/60 ring-1 ring-white/90 backdrop-blur",
  },
];

function ThemePicker() {
  const [theme, setThemeState] = React.useState<AppTheme>("light");
  React.useEffect(() => {
    setThemeState(readStoredTheme());
  }, []);
  const pick = (t: AppTheme) => {
    applyTheme(t);
    setThemeState(t);
  };
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <h2 className="flex items-center gap-2 font-bold"><Palette className="h-5 w-5 text-bronze" /> تم و ظاهر</h2>
      <p className="mb-4 mt-1 text-xs leading-relaxed text-muted-foreground">
        حالت نمایش برنامه را انتخاب کن؛ انتخاب تو روی همین دستگاه ذخیره می‌شود.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {THEME_OPTIONS.map(({ key, title, desc, Icon, preview, chip }) => {
          const selected = theme === key;
          return (
            <button
              key={key}
              onClick={() => pick(key)}
              aria-pressed={selected}
              className={`rounded-2xl border p-3 text-start transition-all duration-200 ${
                selected
                  ? "border-bronze bg-gradient-to-l from-bronze/[0.09] to-transparent ring-1 ring-inset ring-bronze/30"
                  : "border-border bg-background/50 hover:-translate-y-px hover:border-bronze/50"
              }`}
            >
              <span className={`relative mb-2.5 block h-16 overflow-hidden rounded-xl border border-border/60 shadow-inner ${preview}`}>
                <span className={`absolute end-2 top-2 h-3.5 w-3.5 rounded-full ${chip}`} />
                <span className="absolute bottom-2 start-2 end-8 h-4 rounded-md bg-white/55 ring-1 ring-white/70 backdrop-blur-[2px]" />
              </span>
              <span className="flex items-center gap-1.5 text-sm font-bold">
                <Icon className={`h-4 w-4 ${selected ? "text-bronze" : "text-muted-foreground"}`} />
                {title}
                {key === "glass" && <span className="rounded-full bg-bronze/15 px-1.5 py-px text-[9px] font-extrabold text-bronze">جدید</span>}
              </span>
              <span className="mt-0.5 block text-[10.5px] leading-relaxed text-muted-foreground">{desc}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ═══ زبانهٔ عمومی ══════════════════════════════════════════════════════════ */

function GeneralSettings() {
  const auth = useAuth();
  const u = auth.user;

  const [name, setName] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [savedMsg, setSavedMsg] = React.useState("");
  const [pErr, setPErr] = React.useState("");
  const [savingProfile, setSavingProfile] = React.useState(false);

  // آواتار
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [avatarBusy, setAvatarBusy] = React.useState(false);
  const [aErr, setAErr] = React.useState("");

  // رمز
  const [curPw, setCurPw] = React.useState("");
  const [newPw, setNewPw] = React.useState("");
  const [confPw, setConfPw] = React.useState("");
  const [pwErr, setPwErr] = React.useState("");
  const [pwOk, setPwOk] = React.useState("");
  const [pwBusy, setPwBusy] = React.useState(false);

  React.useEffect(() => {
    if (u) {
      setName(u.displayName ?? "");
      setBio(u.bio ?? "");
    }
  }, [u?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!u) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
        برای داشتن پروفایل، ابتدا از دکمهٔ «ورود / ثبت‌نام» وارد شو یا حساب بساز.
      </p>
    );
  }

  const canAvatar = u.role === "teacher" || u.role === "admin";
  const canBio = canAvatar;
  const faJoin = new Date(u.createdAt).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" });

  function flash(msg: string) {
    setSavedMsg(msg);
    setPErr("");
    setTimeout(() => setSavedMsg(""), 5000);
  }

  async function saveProfile() {
    setSavingProfile(true); setPErr(""); setSavedMsg("");
    try {
      const patch: { displayName?: string; bio?: string } = { displayName: name.trim() };
      if (canBio) patch.bio = bio.trim();
      const res = await auth.updateProfile(patch);
      if (!res.ok) throw new Error(res.error ?? "ذخیره نشد.");
      flash("پروفایل ذخیره شد.");
    } catch (e) {
      setPErr(e instanceof Error ? e.message : "خطایی رخ داد.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function uploadAvatar(file: File) {
    setAErr(""); setAvatarBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "آپلود ناموفق بود.");
      await auth.refreshMe();
    } catch (e) {
      setAErr(e instanceof Error ? e.message : "خطایی رخ داد.");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setAErr(""); setAvatarBusy(true);
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (!res.ok) throw new Error("حذف ناموفق بود.");
      await auth.refreshMe();
    } catch (e) {
      setAErr(e instanceof Error ? e.message : "خطایی رخ داد.");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function changePassword(e?: React.FormEvent) {
    e?.preventDefault();
    setPwErr(""); setPwOk("");
    if (newPw !== confPw) {
      setPwErr("تکرار رمز با رمز تازه یکسان نیست.");
      return;
    }
    if (newPw.length < 8) {
      setPwErr("رمز تازه باید دست‌کم ۸ نویسه باشد.");
      return;
    }
    setPwBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current: curPw, next: newPw }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "تغییر رمز ناموفق بود.");
      setPwOk("رمز عبور عوض شد.");
      setCurPw(""); setNewPw(""); setConfPw("");
    } catch (err) {
      setPwErr(err instanceof Error ? err.message : "خطایی رخ داد.");
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* کارت پروفایل */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h2 className="mb-4 flex items-center gap-2 font-bold"><UserCog className="h-5 w-5 text-bronze" /> پروفایل شخصی</h2>

        {/* آواتار */}
        <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border border-border/70 bg-background/60 p-4">
          <span className="relative inline-block p-3">
            <UserAvatar src={u.avatarUrl} name={u.displayName || u.username} size="lg" />
            {avatarBusy && (
              <span className="absolute inset-0 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-bronze" /></span>
            )}
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-bold">آواتار</p>
            {canAvatar ? (
              <>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={avatarBusy}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-bold transition-colors hover:border-bronze hover:text-bronze disabled:opacity-45"
                  >
                    <Camera className="h-3.5 w-3.5" /> انتخاب تصویر…
                  </button>
                  {u.avatarUrl && (
                    <button
                      onClick={removeAvatar}
                      disabled={avatarBusy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-bold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-45"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> برداشتن
                    </button>
                  )}
                </div>
                <p className="text-[10.5px] leading-relaxed text-muted-foreground">PNG یا JPG تا ۲ مگابایت — مربع بهترین حالت است.</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  aria-hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadAvatar(f);
                    e.target.value = "";
                  }}
                />
              </>
            ) : (
              <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
                آپلود آواتار ویژهٔ اساتید است؛ آواتار تو خودکار با حرف اول حساب ساخته می‌شود.
              </p>
            )}
            {aErr && <p className="text-xs text-destructive">{aErr}</p>}
          </div>
        </div>

        <div className="space-y-4">
          <Field label="نام نمایشی" value={name} onChange={setName} placeholder={u.username} hint={`اگر خالی بگذاری، «${u.username}» نمایش داده می‌شود.`} />
          {canBio && (
            <div>
              <label className="mb-1 block text-sm font-semibold">معرفی کوتاه</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                maxLength={320}
                placeholder="مثلاً: مدرس حقوق مدنی و تجارت — دانشجویان را در سفر فتح آزمون وکالت همراهی می‌کنم."
                className="w-full resize-y rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-bronze"
              />
              <p className="mt-1 text-[10.5px] text-muted-foreground">این متن روی پروفایل استاد و پیشنهادهای خانه نشان داده می‌شود.</p>
            </div>
          )}

          {/* شناسنامهٔ حساب */}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-xl border border-dashed border-border px-4 py-3 text-xs sm:grid-cols-[110px_1fr]">
            <dt className="font-semibold text-muted-foreground">نام کاربری</dt>
            <dd dir="ltr" className="text-start font-bold">{u.username}</dd>
            <dt className="font-semibold text-muted-foreground">نقش</dt>
            <dd className="inline-flex items-center gap-1.5 font-bold">
              {u.role === "admin" ? (
                <><ShieldCheck className="h-3.5 w-3.5 text-bronze" /> مدیر سامانه</>
              ) : u.role === "teacher" ? (
                <><GraduationCap className="h-3.5 w-3.5 text-bronze" /> استاد همیار</>
              ) : (
                <>دانشجو</>
              )}
            </dd>
            <dt className="font-semibold text-muted-foreground">عضویت از</dt>
            <dd>{faJoin}</dd>
          </dl>

          {(savedMsg || pErr) && (
            <p className={`rounded-xl px-3 py-2 text-sm ${savedMsg ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
              {savedMsg && <CheckCircle2 className="me-1 inline h-4 w-4 align-text-bottom" />}{savedMsg || pErr}
            </p>
          )}
          <div className="flex justify-end">
            <button
              onClick={saveProfile}
              disabled={savingProfile}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-45"
            >
              {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} ذخیرهٔ پروفایل
            </button>
          </div>
        </div>
      </section>

      {/* تغییر رمز */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h2 className="mb-4 flex items-center gap-2 font-bold"><KeyRound className="h-5 w-5 text-bronze" /> تغییر رمز عبور</h2>
        <form onSubmit={changePassword} className="space-y-3">
          <Field label="رمز فعلی" value={curPw} onChange={setCurPw} type="password" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="رمز تازه" value={newPw} onChange={setNewPw} type="password" hint="دست‌کم ۸ نویسه" />
            <Field label="تکرار رمز تازه" value={confPw} onChange={setConfPw} type="password" />
          </div>
          {(pwOk || pwErr) && (
            <p className={`rounded-xl px-3 py-2 text-sm ${pwOk ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
              {pwOk && <CheckCircle2 className="me-1 inline h-4 w-4 align-text-bottom" />}{pwOk || pwErr}
            </p>
          )}
          <div className="flex justify-end">
            <button type="submit" disabled={pwBusy || !curPw || !newPw} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-45">
              {pwBusy && <Loader2 className="h-4 w-4 animate-spin" />} تغییر رمز
            </button>
          </div>
        </form>
      </section>

      <p className="flex items-start gap-2 rounded-2xl bg-accent p-4 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        همهٔ داده‌های شما فقط با همین حساب گره خورده‌اند؛ پس از تغییر رمز، پیشرفت و کتابخانه بدون هیچ تغییری می‌ماند.
      </p>
    </div>
  );
}

/* ═══ زبانهٔ هوش مصنوعی (همان تنظیمات قبلی) ═════════════════════════════════ */

const PROVIDERS: { key: AiProvider; title: string; desc: string; hint: string }[] = [
  { key: "builtin", title: "استاد داخلی (پیشفرض)", desc: "بدون نیاز به هیچ کلیدی؛ آمادهٔ استفاده", hint: "" },
  { key: "gemini", title: "Google Gemini", desc: "با کلید API گوگل؛ مثل gemini-2.0-flash", hint: "کلید را از aistudio.google.com بگیر" },
  { key: "openai", title: "سازگار با OpenAI", desc: "هر سرویس با آدرس /v1/chat/completions (OpenAI، GPT، DeepSeek، القلب و…)", hint: "آدرس پایه مثل https://api.openai.com/v1" },
];

function AiSettings() {
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
    <div className="space-y-6">
      <p className="text-sm leading-relaxed text-muted-foreground">
        موتور «استاد حقوقی هوشمند» را انتخاب کن. کلید API فقط در مرورگر خودت ذخیره میشود و به هیچ سروری ارسال نمیشود جز مستقیم برای همان ارائهدهنده.
      </p>

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

      {ai.provider !== "builtin" && (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <Field label={ai.provider === "gemini" ? "مدل Gemini" : "نام مدل"} value={ai.model} onChange={(m) => update({ model: m })} placeholder={ai.provider === "gemini" ? "gemini-2.0-flash" : "gpt-4o-mini"} />
          {ai.provider === "openai" && (
            <Field label="آدرس پایه (Base URL)" value={ai.baseUrl} onChange={(b) => update({ baseUrl: b })} placeholder="https://api.openai.com/v1" />
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

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <label className="mb-2 block text-sm font-semibold" htmlFor="temp">سطح پیروی از متن (دمای مدل): {ai.temperature}</label>
        <input id="temp" type="range" min={0} max={1} step={0.05} value={ai.temperature}
          onChange={(e) => update({ temperature: Number(e.target.value) })} className="w-full accent-[var(--bronze)]" />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>دقیق و قانون‌محور</span><span>خلاق و آزاد</span></div>
      </section>

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

/* ─── ابزار فرم مشترک ── */
function Field({
  label, value, onChange, placeholder, hint, type = "text", dirAuto,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; hint?: string; type?: string; dirAuto?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir={dirAuto ? undefined : "auto"}
        className="h-11 w-full rounded-xl border border-input bg-background px-3 outline-none transition-colors focus:border-bronze"
      />
      {hint && <p className="mt-1 text-[10.5px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// جلوگیری از هشدار unused برای Upload در پیکربندی‌های مختلف eslint
void Upload;
