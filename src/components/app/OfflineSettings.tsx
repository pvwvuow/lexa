"use client";

// ─── تب «آفلاین» تنظیمات — بازسازی کارِ ازدست‌رفتهٔ دیشب ─────────────────────────
// همهٔ موتور این بخش در lib/offline.ts محفوظ مانده بود (usePwaInstall،
// precacheDesignAssets، listOfflineMetas، storageEstimate، purgeBrowserCache و…)
// ولی UI تنظیمات آن با ریست کانتینر پریده بود؛ این فایل همان بخش است.
import * as React from "react";
import {
  Download, Smartphone, CheckCircle2, Loader2, RefreshCw, PackageOpen,
  HardDrive, Trash2, Wrench, ShieldCheck, WifiOff, Share, PlusSquare, Info,
} from "lucide-react";
import { fa } from "@/lib/fa";
import {
  DESIGN_VERSION, getDesignMeta, saveDesignMeta, precacheDesignAssets,
  listOfflineMetas, removeOfflineItem, clearOfflineItems, subscribeOffline,
  storageEstimate, formatBytes, faDateTime, designPackOutdated,
  usePwaInstall, purgeBrowserCache, type OfflineItemMeta,
} from "@/lib/offline";

const KIND_BADGE: Record<OfflineItemMeta["kind"], { t: string; cls: string }> = {
  post: { t: "مطلب", cls: "border-primary/30 bg-primary/[0.07] text-primary" },
  tcourse: { t: "دورهٔ استاد", cls: "border-bronze/30 bg-bronze/[0.07] text-bronze" },
  builtin: { t: "دورهٔ آماده", cls: "border-success/30 bg-success/10 text-success" },
};

export function OfflineSettings() {
  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-muted-foreground">
        همیار حقوق را روی دستگاه نصب کن و مطالب دلخواهت را ذخیره کن تا بدون اینترنت هم در دسترس بمانند.
      </p>
      <InstallCard />
      <DesignPackCard />
      <SavedItemsCard />
      <StorageCard />
      <DoctorCard />
    </div>
  );
}

/* ═══ ۱) نصب برنامه (PWA) ═══════════════════════════════════════════════ */

function InstallCard() {
  const { canInstall, installed, install, platform, inApp } = usePwaInstall();
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  async function doInstall() {
    setBusy(true); setMsg("");
    try {
      const r = await install();
      if (r === "accepted") setMsg("نصب شد! همیار حقوق حالا مثل یک برنامهٔ واقعی روی دستگاه توست.");
      else if (r === "dismissed") setMsg("نصب لغو شد؛ هر وقت خواستی دوباره اینجا می‌توانی نصب کنی.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <h2 className="mb-3 flex items-center gap-2 font-bold"><Smartphone className="h-5 w-5 text-bronze" /> نصب روی دستگاه (اپ آفلاین)</h2>

      {installed ? (
        <p className="flex items-center gap-2 rounded-xl bg-success/10 px-4 py-3 text-sm font-bold text-success">
          <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
          همیار حقوق روی همین دستگاه نصب است؛ از صفحهٔ اصلی گوشی یا دسکتاپت بازش کن.
        </p>
      ) : inApp ? (
        <p className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-400/10 px-4 py-3 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          الان داخل یک مرورگر درون‌برنامه‌ای (مثل تلگرام یا اینستاگرام) هستی و نصب در آن ممکن نیست.
          لینک سایت را کپی کن و در کروم (اندروید) یا سافاری (آیفون) باز کن؛ آن‌جا دکمهٔ نصب فعال می‌شود.
        </p>
      ) : canInstall ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={doInstall}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-45"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            نصب همیار حقوق روی همین دستگاه
          </button>
          <span className="text-xs text-muted-foreground">پنجرهٔ نصب مرورگر باز می‌شود؛ «نصب» را بزن.</span>
        </div>
      ) : platform === "ios" ? (
        <ol className="space-y-2 rounded-xl border border-dashed border-border px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <li className="font-bold text-foreground">نصب روی آیفون / آیپد — دو قدم ساده:</li>
          <li className="flex items-center gap-2"><Share className="h-3.5 w-3.5 shrink-0 text-bronze" /> در نوار پایین سافاری دکمهٔ «اشتراک‌گذاری» (مربع با فلش بالا) را بزن.</li>
          <li className="flex items-center gap-2"><PlusSquare className="h-3.5 w-3.5 shrink-0 text-bronze" /> «افزودن به صفحهٔ اصلی» (Add to Home Screen) را انتخاب کن.</li>
        </ol>
      ) : (
        <p className="flex items-start gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-bronze" />
          برای نصب، در منوی مرورگر (سه‌نقطهٔ بالا در کروم) گزینهٔ «نصب برنامه» یا «Add to Home Screen» را انتخاب کن —
          یا آیکون نصب را در نوار آدرس بزن. این گزینه بعد از چند ثانیه ماندن در سایت خودکار هم ظاهر می‌شود.
        </p>
      )}

      {msg && (
        <p className="mt-3 rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
          <CheckCircle2 className="me-1 inline h-4 w-4 align-text-bottom" />{msg}
        </p>
      )}
    </section>
  );
}

/* ═══ ۲) بستهٔ طراحی آفلاین (پوسته/فونت/رسانه) ══════════════════════════ */

function DesignPackCard() {
  const [meta, setMeta] = React.useState(() => getDesignMeta());
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  React.useEffect(() => { setMeta(getDesignMeta()); }, []);

  const outdated = designPackOutdated();
  const status = !meta
    ? { t: "ذخیره نشده", cls: "text-muted-foreground" }
    : outdated
      ? { t: "نیاز به به‌روزرسانی دارد", cls: "text-amber-600 dark:text-amber-400" }
      : { t: "به‌روز است", cls: "text-success" };

  async function save() {
    setBusy(true); setMsg("");
    try {
      const n = await precacheDesignAssets();
      if (n > 0) {
        saveDesignMeta();
        setMeta(getDesignMeta());
        setMsg(`بستهٔ طراحی ذخیره شد (${fa(n)} فایل) — از این به بعد سایت بدون اینترنت هم با همان ظاهر بالا می‌آید.`);
      } else {
        setMsg("ذخیرهٔ بسته ممکن نشد؛ اتصال اینترنت را چک کن و دوباره تلاش کن.");
      }
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(""), 6000);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <h2 className="mb-3 flex items-center gap-2 font-bold"><PackageOpen className="h-5 w-5 text-bronze" /> پوستهٔ آفلاین (بستهٔ طراحی)</h2>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        ظاهر سایت — فونت‌ها، رنگ‌ها و تصاویر پایه — با این بسته روی دستگاه ذخیره می‌شود تا آفلاین هم چیز عوض نشود.
        نسخهٔ بسته: <span dir="ltr" className="font-bold">{DESIGN_VERSION}</span>
        {meta?.savedAt ? <> · آخرین ذخیره: <span className="font-semibold">{faDateTime(meta.savedAt)}</span></> : null}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-[11px] font-bold ${status.cls}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" /> {status.t}
        </span>
        <button
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-45"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {meta ? "به‌روزرسانی بستهٔ طراحی" : "ذخیرهٔ بستهٔ طراحی"}
        </button>
      </div>
      {msg && (
        <p className={`mt-3 rounded-xl px-3 py-2 text-xs leading-relaxed ${msg.includes("نمکن نشد") || msg.includes("ممکن نشد") ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
          {msg}
        </p>
      )}
    </section>
  );
}

/* ═══ ۳) مطالب ذخیره‌شدهٔ من ════════════════════════════════════════════ */

function SavedItemsCard() {
  const [items, setItems] = React.useState<OfflineItemMeta[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(() => {
    void listOfflineMetas().then((ms) => {
      setItems(ms.sort((a, b) => b.savedAt - a.savedAt));
      setLoading(false);
    });
  }, []);

  React.useEffect(() => {
    refresh();
    return subscribeOffline(refresh);
  }, [refresh]);

  async function clearAll() {
    if (!confirm(`همهٔ ${fa(items.length)} مورد ذخیره‌شده از حافظهٔ آفلاین پاک شود؟`)) return;
    await clearOfflineItems();
    refresh();
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 font-bold"><WifiOff className="h-5 w-5 text-bronze" /> مطالب ذخیره‌شدهٔ من</h2>
        {items.length > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-bold text-muted-foreground">{fa(items.length)} مورد</span>
        )}
        {items.length > 1 && (
          <button
            onClick={() => void clearAll()}
            className="ms-auto inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-[11px] font-bold text-destructive transition-colors hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> پاک‌سازی همه
          </button>
        )}
      </div>

      {loading ? (
        <p className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> در حال خواندن حافظهٔ دستگاه…
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-4 text-xs leading-relaxed text-muted-foreground">
          هنوز چیزی برای مطالعهٔ آفلاین ذخیره نکرده‌ای. کنار هر مطلب در خانه و صفحهٔ مطالب، و در سربرگ دوره‌ها،
          دکمهٔ <Download className="inline h-3.5 w-3.5 align-text-bottom text-bronze" /> «دانلود آفلاین» هست.
        </p>
      ) : (
        <ul className="divide-y divide-border/70">
          {items.map((it) => {
            const badge = KIND_BADGE[it.kind];
            const title = it.card.title || "بدون عنوان";
            const sub = it.kind === "post"
              ? (it.card as { author?: { displayName?: string } }).author?.displayName
              : (it.card as { teacher?: { displayName?: string } }).teacher?.displayName;
            return (
              <li key={`${it.kind}:${it.id}`} className="flex items-center gap-3 py-2.5">
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-bold ${badge.cls}`}>{badge.t}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-bold">{title}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {sub ? `${sub} · ` : ""}ذخیره: {faDateTime(it.savedAt)}
                  </span>
                </span>
                <button
                  onClick={() => void removeOfflineItem(it.kind, it.id)}
                  aria-label={`حذف ${title} از ذخیره‌های آفلاین`}
                  title="حذف از ذخیره‌های آفلاین"
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ═══ ۴) فضای مصرفی ════════════════════════════════════════════════════ */

function StorageCard() {
  const [est, setEst] = React.useState<{ usage: number; quota: number } | null>(null);

  React.useEffect(() => {
    void storageEstimate().then(setEst);
  }, []);

  const pct = est && est.quota > 0 ? Math.min(100, (est.usage / est.quota) * 100) : 0;

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <h2 className="mb-3 flex items-center gap-2 font-bold"><HardDrive className="h-5 w-5 text-bronze" /> فضای مصرفی روی دستگاه</h2>
      {est ? (
        <div className="space-y-2">
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-l from-bronze to-amber-400 transition-all" style={{ width: `${Math.max(2, pct)}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-bold text-foreground">{formatBytes(est.usage)}</span> از سهمیهٔ مجاز
            {est.quota > 0 ? <> ({formatBytes(est.quota)})</> : null} — شامل پوستهٔ آفلاین، مطالب ذخیره‌شده و حافظهٔ موقت.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">مرورگرت گزارش حجم نمی‌دهد؛ نگران نباش، داده‌ها به‌صورت خودکار مدیریت می‌شوند.</p>
      )}
    </section>
  );
}

/* ═══ ۵) دکتر مهربان — نجات صفحهٔ خراب ═════════════════════════════════ */

function DoctorCard() {
  const [busy, setBusy] = React.useState(false);

  async function run() {
    if (!confirm("حافظهٔ موقت مرورگر کامل پاک شود و صفحه تازه شود؟\nپیشرفت، حساب و ذخیره‌های آفلاین تو دست‌نخورده می‌ماند.")) return;
    setBusy(true);
    await purgeBrowserCache();
  }

  return (
    <section className="rounded-2xl border border-dashed border-border bg-card p-5">
      <h2 className="mb-2 flex items-center gap-2 font-bold"><Wrench className="h-5 w-5 text-bronze" /> دکتر مهربان</h2>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        اگر صفحه‌ای بالا نیامد، ظاهر عوض‌شدگی عجیب دیدی یا نسخهٔ آفلاین گیر کرد، این دکمه حافظهٔ موقت مرورگر را
        کامل پاک می‌کند و سایت را با نسخهٔ تازه از نو باز می‌کند.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => void run()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl border border-bronze/50 bg-bronze/10 px-4 py-2 text-xs font-bold text-bronze transition-colors hover:bg-bronze/20 disabled:opacity-45"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
          پاک‌سازی حافظهٔ موقت و رفرش کامل
        </button>
        <span className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-success" /> داده‌های تو حذف نمی‌شود
        </span>
      </div>
    </section>
  );
}
