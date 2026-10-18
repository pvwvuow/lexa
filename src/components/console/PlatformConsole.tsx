"use client";
/* Lexa platform console (phase A1 of docs/ADMIN_PLATFORM.md): the Lexa admin's home. A full-screen
 * workspace with its own navigation: overview, requests, centres, users, audit log, learning
 * analytics and security. Sections live in the address (#/admin/<section>) so back/forward and
 * links work. Reads and writes go through supabase/013_admin_console.sql. */
import * as React from "react";
import {
  Activity, AlertTriangle, ArrowLeftRight, BookOpen, Building2, CheckCircle2, ClipboardList, Clock, Gauge,
  GraduationCap, Inbox, KeyRound, LayoutDashboard, LibraryBig, LogOut, PlugZap, ScrollText, Settings,
  ShieldAlert, ShieldCheck, Timer, Upload, UserCheck, Users, XCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth-client";
import { navigate } from "@/lib/router";
import { useAal } from "@/lib/mfa";
import { consoleSectionFromHash, setWorkspacePref } from "@/lib/workspace";
import {
  actionLabel, adminError, adminHome, adminOrgLifecycle, adminOrgsOverview, adminUsers, faAgo, faDate, faDateTime,
  faDaysLeft, faHours, faNum, type AdminAlert, type AdminHome, type AdminOrgRow,
} from "@/lib/cloud-api/admin-console";
import { adminReviewTeacher, adminTeacherRequests, type TeacherRequest } from "@/lib/cloud-api/orgs";
import { MfaPanel } from "@/components/app/MfaPanel";
import { AdminStudyPanel } from "@/components/app/AdminStudyPanel";
import { ComparisonReportPanel } from "@/components/app/ComparisonReportPanel";
import {
  Badge, Btn, ConfirmDialog, ConsoleFrame, DataTable, Drawer, EmptyState, KeyValues, Kpi, Notice, PageHeader, Panel,
  RefreshBtn, SearchBox, TrendChart, useLoad, type ConfirmSpec, type NavGroup, type Tone,
} from "./ConsoleKit";
import { AdminCentresPage } from "./AdminCentresPage";
import { AdminUsersPage } from "./AdminUsersPage";
import { AdminAuditPage } from "./AdminAuditPage";

export type ConsoleSection = "overview" | "requests" | "centres" | "users" | "audit" | "learning" | "security";
const SECTIONS: ConsoleSection[] = ["overview", "requests", "centres", "users", "audit", "learning", "security"];
const TITLES: Record<ConsoleSection, string> = {
  overview: "نمای کلی", requests: "درخواست‌ها", centres: "مراکز آموزشی", users: "کاربران",
  audit: "گزارش ممیزی", learning: "تحلیل یادگیری", security: "امنیت",
};

/** shared state between sections: jump to a centre / user with a search */
export interface ConsoleNav {
  go: (s: ConsoleSection, opts?: { centre?: string; q?: string }) => void;
}

export function PlatformConsole({ onExit }: { onExit?: () => void }) {
  const auth = useAuth();
  const aal = useAal();
  const [section, setSection] = React.useState<ConsoleSection>(() => {
    const s = consoleSectionFromHash("overview") as ConsoleSection;
    return SECTIONS.includes(s) ? s : "overview";
  });
  const [centreFocus, setCentreFocus] = React.useState<string | null>(null);
  const [userQuery, setUserQuery] = React.useState("");
  const [topQ, setTopQ] = React.useState("");
  const home = useLoad(() => adminHome(), []);

  React.useEffect(() => {
    const onHash = () => {
      const s = consoleSectionFromHash("overview") as ConsoleSection;
      if (SECTIONS.includes(s)) setSection(s);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = React.useCallback<ConsoleNav["go"]>((s, opts) => {
    if (opts?.centre !== undefined) setCentreFocus(opts.centre);
    if (opts?.q !== undefined) setUserQuery(opts.q);
    setSection(s);
    const h = `#/admin/${s}`;
    if (window.location.hash !== h) window.location.hash = h;
    window.scrollTo({ top: 0 });
  }, []);

  const exit = () => {
    setWorkspacePref("learning");
    if (onExit) onExit();
    else navigate({ view: "home" });
  };

  const k = home.data?.kpis;
  const qd = home.data?.queues;
  const alerts = home.data?.alerts ?? [];
  const groups: NavGroup[] = [
    {
      label: "پیشخوان",
      items: [
        { key: "overview", label: "نمای کلی", icon: LayoutDashboard, badge: alerts.length || null, tone: alerts.some((a) => a.rank <= 2) ? "bad" : "warn" },
        { key: "requests", label: "درخواست‌ها", icon: Inbox, badge: ((qd?.teacher_requests ?? 0) + (qd?.org_requests ?? 0)) || null },
      ],
    },
    {
      label: "مدیریت",
      items: [
        { key: "centres", label: "مراکز آموزشی", icon: Building2, badge: qd?.orgs_delete_due || null, tone: "bad" },
        { key: "users", label: "کاربران و نقش‌ها", icon: Users },
        { key: "audit", label: "گزارش ممیزی", icon: ScrollText },
      ],
    },
    {
      label: "گزارش‌ها",
      items: [{ key: "learning", label: "تحلیل یادگیری", icon: Activity }],
    },
    {
      label: "سیستم",
      items: [{ key: "security", label: "امنیت", icon: ShieldCheck, badge: k?.admins_no_mfa || null, tone: "warn" }],
    },
  ];

  const footer = (
    <div className="space-y-2">
      <div className="flex items-center gap-2.5 rounded-lg bg-white/[0.05] px-2.5 py-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-bronze/90 text-[13px] font-bold text-[#132018]">
          {(auth.user?.displayName || auth.user?.username || "?").slice(0, 1)}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[12.5px] font-bold text-white">{auth.user?.displayName || auth.user?.username}</span>
          <span className="block text-[10.5px] text-white/50">مدیر Lexa</span>
        </span>
        {aal === "aal2"
          ? <span title="ورود دومرحله‌ای تأییدشده"><ShieldCheck className="h-4 w-4 text-emerald-400" /></span>
          : <button type="button" title="ورود دومرحله‌ای لازم است" onClick={() => go("security")}><ShieldAlert className="h-4 w-4 text-amber-400" /></button>}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" onClick={exit} className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 px-2 py-1.5 text-[11.5px] font-semibold text-white/75 hover:bg-white/[0.06] hover:text-white">
          <BookOpen className="h-3.5 w-3.5" /> محیط یادگیری
        </button>
        <button type="button" onClick={() => navigate({ view: "settings" })} className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 px-2 py-1.5 text-[11.5px] font-semibold text-white/75 hover:bg-white/[0.06] hover:text-white">
          <Settings className="h-3.5 w-3.5" /> تنظیمات
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" onClick={() => navigate({ view: "import" })} className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-white/55 hover:text-white">
          <Upload className="h-3.5 w-3.5" /> افزودن کتاب
        </button>
        <button type="button" onClick={() => navigate({ view: "library" })} className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-white/55 hover:text-white">
          <LibraryBig className="h-3.5 w-3.5" /> کتابخانه
        </button>
      </div>
    </div>
  );

  const nav: ConsoleNav = { go };
  return (
    <ConsoleFrame
      product="Lexa"
      workspace="کنسول مدیریت پلتفرم"
      groups={groups}
      active={section}
      onSelect={(s) => go(s as ConsoleSection)}
      footer={footer}
      crumbs={["کنسول مدیریت", TITLES[section]]}
      topActions={
        <>
          <SearchBox value={topQ} onChange={setTopQ} placeholder="جستجوی کاربر (نام، ایمیل)…" className="hidden w-72 md:block"
            onEnter={() => { if (topQ.trim()) go("users", { q: topQ.trim() }); }} />
          {aal !== "aal2" && <Btn size="sm" kind="secondary" icon={ShieldAlert} onClick={() => go("security")} className="text-amber-700 dark:text-amber-400">ورود دومرحله‌ای</Btn>}
          <button type="button" onClick={exit} className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-flex">
            <LogOut className="h-4 w-4" /> خروج از کنسول
          </button>
        </>
      }
    >
      {section === "overview" && <OverviewPage home={home.data} error={home.error} busy={home.busy} at={home.at} reload={home.reload} nav={nav} />}
      {section === "requests" && <RequestsPage onChanged={home.reload} />}
      {section === "centres" && <AdminCentresPage focus={centreFocus} onFocusDone={() => setCentreFocus(null)} onChanged={home.reload} />}
      {section === "users" && <AdminUsersPage initialQuery={userQuery} />}
      {section === "audit" && <AdminAuditPage />}
      {section === "learning" && <LearningPage />}
      {section === "security" && <SecurityPage nav={nav} />}
    </ConsoleFrame>
  );
}

// --- overview ---
function alertView(a: AdminAlert): { tone: Tone; title: string; text: string } {
  const name = a.name ?? "";
  switch (a.kind) {
    case "admins_no_mfa": return { tone: "bad", title: "مدیر بدون ورود دومرحله‌ای", text: `${faNum(a.count)} حساب مدیر Lexa هنوز ورود دومرحله‌ای ندارد.` };
    case "org_delete_due": return { tone: "bad", title: `مهلت حذف «${name}» تمام شده`, text: "مرکز آمادهٔ حذف دائمی است؛ تصمیم بگیرید: حذف یا لغو." };
    case "org_expired": return { tone: "bad", title: `اعتبار «${name}» تمام شده`, text: `از ${faDate(a.at)} حساب‌های مرکز دسترسی رسمی ندارند.` };
    case "org_expiring": return { tone: "warn", title: `اعتبار «${name}» رو به پایان است`, text: `${faDate(a.at)} (${faDaysLeft(a.at)})` };
    case "org_students_full": return { tone: "warn", title: `ظرفیت دانشجوی «${name}» پر است`, text: `${faNum(a.used)} از ${faNum(a.cap)} حساب دانشجویی.` };
    case "org_teachers_full": return { tone: "warn", title: `ظرفیت مدرس «${name}» پر است`, text: `${faNum(a.used)} از ${faNum(a.cap)} صندلی مدرس.` };
    case "connector_failed": return { tone: "bad", title: `کانکتور «${name}» خطا داده`, text: `${faNum(a.count)} اجرای ناموفق در ۲۴ ساعت؛ آخرین: ${faAgo(a.at)}.` };
    case "api_errors": return { tone: "warn", title: `خطای API در «${name}»`, text: `${faNum(a.count)} پاسخ خطای سرور در ۲۴ ساعت.` };
    default: return { tone: "muted", title: String(a.kind), text: "" };
  }
}

function OverviewPage({ home, error, busy, at, reload, nav }: {
  home: AdminHome | null; error: unknown; busy: boolean; at: Date | null; reload: () => Promise<void>; nav: ConsoleNav;
}) {
  if (error && !home) {
    return (
      <>
        <PageHeader title="نمای کلی پلتفرم" />
        <Notice tone="bad" title="داده‌های کنسول خوانده نشد" action={<Btn size="sm" onClick={() => void reload()}>تلاش دوباره</Btn>}>{adminError(error)}</Notice>
      </>
    );
  }
  const k = home?.kpis;
  const q = home?.queues;
  const series = home?.series ?? [];
  const labels = series.map((p) => faDate(p.day));
  const v = (n: number | null | undefined) => (home ? faNum(n ?? 0) : "…");
  return (
    <>
      <PageHeader
        title="نمای کلی پلتفرم"
        description="وضعیت لحظه‌ای Lexa: کاربران، مراکز، یادگیری، صف کارها و هشدارهایی که به تصمیم شما نیاز دارند."
        meta={home && (
          <>
            <span>امروز {faDate(home.today)}</span>
            <span aria-hidden>·</span>
            <span>به‌روزرسانی {faDateTime(home.generated_at)}</span>
            {home.mfa ? <Badge tone="ok" dot>نشست دومرحله‌ای</Badge> : <Badge tone="warn" dot>نشست یک‌مرحله‌ای</Badge>}
          </>
        )}
        actions={<RefreshBtn onClick={() => void reload()} busy={busy} at={at} />}
      />

      {home && !home.mfa && (
        <div className="mb-5">
          <Notice tone="warn" title="ورود دومرحله‌ای فعال نیست"
            action={<Btn size="sm" kind="primary" icon={KeyRound} onClick={() => nav.go("security")}>فعال‌سازی</Btn>}>
            کاربران، گزارش ممیزی و همهٔ تغییرات (تعلیق، پلن، نقش) فقط با نشست دومرحله‌ای باز می‌شوند.
          </Notice>
        </div>
      )}

      {!!home?.alerts.length && (
        <Panel title="نیازمند توجه" icon={AlertTriangle} className="mb-5" bodyClass="p-0"
          actions={<Badge tone="bad">{faNum(home.alerts.length)} مورد</Badge>}>
          <ul className="divide-y divide-border">
            {home.alerts.slice(0, 8).map((a, i) => {
              const av = alertView(a);
              return (
                <li key={i} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${av.tone === "bad" ? "bg-red-500" : "bg-amber-500"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{av.title}</p>
                    <p className="truncate text-[11.5px] text-muted-foreground">{av.text}</p>
                  </div>
                  {a.org_id && <Btn size="sm" onClick={() => nav.go("centres", { centre: a.org_id })}>بررسی</Btn>}
                  {a.kind === "admins_no_mfa" && <Btn size="sm" onClick={() => nav.go("security")}>بررسی</Btn>}
                </li>
              );
            })}
          </ul>
          {home.alerts.length > 8 && <p className="border-t border-border px-4 py-2 text-[11.5px] text-muted-foreground">و {faNum(home.alerts.length - 8)} مورد دیگر در «مراکز آموزشی».</p>}
        </Panel>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="کاربران" value={v(k?.users)} icon={Users} spark={series.map((p) => p.signups)}
          hint={k ? `${faNum(k.users_new_7d)} نفر جدید در ۷ روز · ${faNum(k.signins_7d)} ورود` : undefined} onClick={() => nav.go("users")} />
        <Kpi label="یادگیرندهٔ فعال (۷ روز)" value={v(k?.learners_7d)} icon={Activity} tone="ok" spark={series.map((p) => p.learners)}
          hint={k ? `امروز ${faNum(k.learners_1d)} · ۳۰ روز ${faNum(k.learners_30d)}` : undefined} onClick={() => nav.go("learning")} />
        <Kpi label="ساعت مطالعه (۳۰ روز)" value={k ? faHours(k.study_seconds_30d) : "…"} icon={Timer} tone="info" spark={series.map((p) => p.seconds)}
          hint={k ? `${faHours(k.study_seconds_7d)} ساعت در ۷ روز اخیر` : undefined} />
        <Kpi label="مراکز فعال" value={v(k?.orgs_active)} icon={Building2}
          hint={k ? `${faNum(k.orgs_pending)} در انتظار · ${faNum(k.orgs_suspended)} معلق · ${faNum(k.orgs_expired)} منقضی` : undefined}
          onClick={() => nav.go("centres")} />
        <Kpi label="دانشجوی رسمی" value={v(k?.official_students)} icon={GraduationCap}
          hint={k ? `از ${faNum(k.student_seats)} صندلی خریداری‌شده` : undefined} />
        <Kpi label="کلاس فعال" value={v(k?.classes_active)} icon={ClipboardList} hint={k ? `${faNum(k.exams_next_7d)} آزمون رسمی در ۷ روز آینده` : undefined} />
        <Kpi label="مدرسان" value={v(k?.teachers)} icon={UserCheck} hint={k ? `${faNum(k.admins)} مدیر Lexa` : undefined} />
        <Kpi label="حساب معلق" value={v(k?.suspended_users)} icon={ShieldAlert} tone={k?.suspended_users ? "warn" : "muted"}
          onClick={() => nav.go("users")} hint="تعلیق‌ها با دلیل در ممیزی ثبت می‌شوند" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Panel title="روند ۳۰ روز اخیر" description="یادگیرندگان فعال و ثبت‌نام‌های تازه، به روز تهران" className="xl:col-span-2">
          {series.length
            ? <TrendChart labels={labels} series={[
                { name: "یادگیرندهٔ فعال", values: series.map((p) => p.learners), color: "#b08d4f", area: true },
                { name: "ثبت‌نام تازه", values: series.map((p) => p.signups), color: "#0f766e" },
              ]} />
            : <div className="h-48 animate-pulse rounded-lg bg-muted/60" />}
        </Panel>

        <Panel title="صف کارها" icon={Inbox} bodyClass="p-0">
          <ul className="divide-y divide-border">
            <QueueRow icon={UserCheck} label="درخواست حساب مدرس" n={q?.teacher_requests} oldest={q?.teacher_requests_oldest} onOpen={() => nav.go("requests")} />
            <QueueRow icon={Building2} label="درخواست پنل مرکز" n={q?.org_requests} oldest={q?.org_requests_oldest} onOpen={() => nav.go("requests")} />
            <QueueRow icon={XCircle} label="مرکز آمادهٔ حذف دائمی" n={q?.orgs_delete_due} tone="bad" onOpen={() => nav.go("centres")} />
            <QueueRow icon={Clock} label="مرکز در دورهٔ مهلت حذف" n={q?.orgs_delete_scheduled} onOpen={() => nav.go("centres")} />
          </ul>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Panel title="سلامت و امنیت" icon={Gauge} bodyClass="p-0">
          <ul className="divide-y divide-border text-[13px]">
            <HealthRow icon={PlugZap} label="اجرای ناموفق کانکتور (۲۴ ساعت)" n={k?.connector_failed_24h} missing="SQL 012 هنوز اجرا نشده" />
            <HealthRow icon={ArrowLeftRight} label="خطای سرور در API مراکز (۲۴ ساعت)" n={k?.api_errors_24h} missing="SQL 010 هنوز اجرا نشده" />
            <HealthRow icon={ShieldAlert} label="مدیر Lexa بدون ورود دومرحله‌ای" n={k?.admins_no_mfa} missing="خوانده نشد" />
          </ul>
        </Panel>

        <Panel title="فعالیت‌های اخیر" icon={ScrollText} className="xl:col-span-2" bodyClass="p-0"
          actions={<Btn size="sm" kind="ghost" onClick={() => nav.go("audit")}>همهٔ رویدادها</Btn>}>
          {!home ? <div className="m-4 h-40 animate-pulse rounded-lg bg-muted/60" />
            : !home.mfa ? <div className="p-4"><EmptyState icon={ShieldAlert} title="با ورود دومرحله‌ای دیده می‌شود" text="گزارش ممیزی شامل اطلاعات دانشجویان است." /></div>
            : !home.recent.length ? <div className="p-4"><EmptyState title="هنوز رویدادی ثبت نشده" /></div>
            : (
              <ul className="divide-y divide-border">
                {home.recent.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-2 text-[12.5px]">
                    <span className="w-24 shrink-0 text-[11px] tabular-nums text-muted-foreground">{faAgo(r.at)}</span>
                    <span className="min-w-0 flex-1 truncate"><b>{actionLabel(r.action)}</b>{r.target_name && <> · {r.target_name}</>}{r.org && <span className="text-muted-foreground"> · {r.org}</span>}</span>
                    <span className="hidden shrink-0 text-[11.5px] text-muted-foreground sm:inline">{r.actor ? `@${r.actor}` : "سیستم"}</span>
                  </li>
                ))}
              </ul>
            )}
        </Panel>
      </div>
    </>
  );
}

function QueueRow({ icon: Icon, label, n, oldest, onOpen, tone }: {
  icon: React.ComponentType<{ className?: string }>; label: string; n?: number; oldest?: string | null; onOpen: () => void; tone?: Tone;
}) {
  const has = (n ?? 0) > 0;
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-muted/50">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold">{label}</span>
          {has && oldest && <span className="block text-[11px] text-muted-foreground">قدیمی‌ترین: {faAgo(oldest)}</span>}
        </span>
        {n === undefined ? <span className="h-4 w-6 animate-pulse rounded bg-muted" />
          : has ? <Badge tone={tone ?? "warn"}>{faNum(n)}</Badge> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
      </button>
    </li>
  );
}

function HealthRow({ icon: Icon, label, n, missing }: { icon: React.ComponentType<{ className?: string }>; label: string; n?: number | null; missing: string }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {n === undefined ? <span className="h-4 w-6 animate-pulse rounded bg-muted" />
        : n === null ? <span className="text-[11px] text-muted-foreground">{missing}</span>
        : n > 0 ? <Badge tone="bad">{faNum(n)}</Badge> : <Badge tone="ok" dot>سالم</Badge>}
    </li>
  );
}

// --- requests ---
function RequestsPage({ onChanged }: { onChanged: () => void }) {
  const teachers = useLoad(() => adminTeacherRequests("pending"), []);
  const orgs = useLoad(() => adminOrgsOverview().then((r) => r.filter((o) => o.status === "pending")), []);
  const [open, setOpen] = React.useState<TeacherRequest | null>(null);
  const [confirm, setConfirm] = React.useState<ConfirmSpec | null>(null);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");

  const done = () => { void teachers.reload(); void orgs.reload(); onChanged(); };
  async function review(approve: boolean) {
    if (!open) return;
    setBusy(true); setErr("");
    try { await adminReviewTeacher(open.userId, approve, note.trim()); setOpen(null); setNote(""); done(); }
    catch (e) { setErr(adminError(e)); } finally { setBusy(false); }
  }
  const orgAct = (o: AdminOrgRow, act: "activate" | "archive") => setConfirm({
    title: act === "activate" ? `فعال‌سازی «${o.name}»` : `رد درخواست «${o.name}»`,
    text: act === "activate"
      ? "پنل مرکز فعال می‌شود و مدیرانش می‌توانند مدرس دعوت کنند و حساب دانشجویی بسازند. پلن، ظرفیت و انقضا را بعداً از «مراکز آموزشی» تنظیم کنید."
      : "درخواست بایگانی می‌شود و دلیل آن در گزارش ممیزی می‌ماند. بعداً قابل بازگردانی است.",
    confirmLabel: act === "activate" ? "فعال کن" : "رد درخواست",
    danger: act === "archive",
    needReason: act === "archive",
    run: (reason) => adminOrgLifecycle(o.id, act, reason),
  });

  return (
    <>
      <PageHeader title="درخواست‌ها" description="درخواست‌های حساب مدرس و پنل مرکز آموزشی که منتظر تصمیم شما هستند."
        actions={<RefreshBtn onClick={done} busy={teachers.busy || orgs.busy} />} />
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="حساب مدرس" icon={UserCheck} bodyClass="p-0" actions={teachers.data && <Badge tone={teachers.data.length ? "warn" : "ok"}>{faNum(teachers.data.length)}</Badge>}>
          {teachers.error ? <div className="p-4"><Notice tone="bad" title="خوانده نشد">{adminError(teachers.error)}</Notice></div> : (
            <DataTable rows={teachers.data} rowKey={(r) => r.userId} onRowClick={(r) => { setOpen(r); setNote(""); setErr(""); }}
              empty={<EmptyState icon={CheckCircle2} title="درخواستی در انتظار نیست" />}
              columns={[
                { key: "n", header: "متقاضی", cell: (r) => <span><b>{r.fullName}</b><span className="block text-[11px] text-muted-foreground">@{r.user?.username}</span></span> },
                { key: "c", header: "سوابق", hideBelow: "md", cell: (r) => <span className="line-clamp-2 text-[12px] text-muted-foreground">{r.credentials || "—"}</span> },
                { key: "t", header: "زمان", cell: (r) => <span className="whitespace-nowrap text-[12px] text-muted-foreground">{faAgo(r.createdAt)}</span> },
              ]} />
          )}
        </Panel>
        <Panel title="پنل مرکز آموزشی" icon={Building2} bodyClass="p-0" actions={orgs.data && <Badge tone={orgs.data.length ? "warn" : "ok"}>{faNum(orgs.data.length)}</Badge>}>
          {orgs.error ? <div className="p-4"><Notice tone="bad" title="خوانده نشد">{adminError(orgs.error)}</Notice></div> : (
            <DataTable rows={orgs.data} rowKey={(r) => r.id}
              empty={<EmptyState icon={CheckCircle2} title="درخواستی در انتظار نیست" />}
              columns={[
                { key: "n", header: "مرکز", cell: (o) => <span><b>{o.name}</b><span className="block text-[11px] text-muted-foreground" dir="ltr">{o.slug}{o.city ? ` · ${o.city}` : ""}</span></span> },
                { key: "o", header: "درخواست‌دهنده", hideBelow: "md", cell: (o) => <span className="text-[12px]">{o.owner_username ? `@${o.owner_username}` : "—"}{o.contact && <span className="block text-[11px] text-muted-foreground">{o.contact}</span>}</span> },
                { key: "t", header: "زمان", hideBelow: "sm", cell: (o) => <span className="text-[12px] text-muted-foreground">{faAgo(o.created_at)}</span> },
                { key: "a", header: "", cell: (o) => (
                  <div className="flex justify-end gap-1.5">
                    <Btn size="sm" kind="primary" onClick={() => orgAct(o, "activate")}>فعال‌سازی</Btn>
                    <Btn size="sm" kind="ghost" onClick={() => orgAct(o, "archive")}>رد</Btn>
                  </div>
                ) },
              ]} />
          )}
        </Panel>
      </div>

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.fullName ?? ""} subtitle={open?.user ? `@${open.user.username} · ${faDateTime(open.createdAt)}` : undefined}
        footer={
          <div className="space-y-2">
            {err && <p role="alert" className="text-[12px] text-red-600">{err}</p>}
            <div className="flex justify-end gap-2">
              <Btn kind="secondary" busy={busy} onClick={() => void review(false)}>رد درخواست</Btn>
              <Btn kind="primary" busy={busy} onClick={() => void review(true)}>تأیید و ساخت حساب مدرس</Btn>
            </div>
          </div>
        }>
        {open && (
          <>
            <KeyValues items={[["نام کامل", open.fullName], ["راه ارتباط", open.contact || "—"], ["سوابق", open.credentials || "—"], ["معرفی", open.bio || "—"]]} />
            <label className="block space-y-1">
              <span className="text-[12px] font-bold">یادداشت برای متقاضی (اختیاری؛ در رد درخواست به او نشان داده می‌شود)</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={600}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-bronze" />
            </label>
          </>
        )}
      </Drawer>
      <ConfirmDialog spec={confirm} onClose={() => setConfirm(null)} onDone={done} errorText={adminError} />
    </>
  );
}

// --- learning analytics ---
function LearningPage() {
  const orgs = useLoad(() => adminOrgsOverview(), []);
  return (
    <>
      <PageHeader title="تحلیل یادگیری" description="زمان مطالعهٔ فعال در کل Lexa و گزارش مقایسهٔ زمان مطالعه با نمره در هر مرکز." />
      <div className="space-y-5">
        <Panel title="زمان مطالعه" icon={Timer}><AdminStudyPanel /></Panel>
        <Panel title="گزارش مقایسه" icon={ArrowLeftRight}
          description="هم‌بستگی زمان مطالعه و نمره؛ گروه‌های کمتر از ۱۰ نفر برای حفظ حریم خصوصی پنهان می‌شوند.">
          <ComparisonReportPanel admin orgs={(orgs.data ?? []).map((o) => ({ id: o.id, name: o.name }))} />
        </Panel>
      </div>
    </>
  );
}

// --- security ---
function SecurityPage({ nav }: { nav: ConsoleNav }) {
  const aal = useAal();
  const admins = useLoad(() => (aal === "aal2" ? adminUsers({ role: "admin", limit: 100 }) : Promise.resolve(null)), [aal]);
  return (
    <>
      <PageHeader title="امنیت" description="ورود دومرحله‌ای شما، مدیران Lexa و قواعدی که از داده‌ها محافظت می‌کنند." />
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Panel title="ورود دومرحله‌ای حساب شما" icon={KeyRound}><MfaPanel /></Panel>
          <Panel title="مدیران Lexa" icon={ShieldCheck} bodyClass="p-0"
            actions={<Btn size="sm" kind="ghost" onClick={() => nav.go("users")}>مدیریت نقش‌ها</Btn>}>
            {aal !== "aal2" ? <div className="p-4"><EmptyState icon={ShieldAlert} title="با ورود دومرحله‌ای دیده می‌شود" /></div> : (
              <DataTable rows={admins.data?.rows ?? (admins.busy ? null : [])} rowKey={(r) => r.id}
                columns={[
                  { key: "u", header: "مدیر", cell: (r) => <span><b>{r.display_name || r.username}</b><span className="block text-[11px] text-muted-foreground">@{r.username} · {r.email_masked}</span></span> },
                  { key: "m", header: "ورود دومرحله‌ای", cell: (r) => r.mfa ? <Badge tone="ok" dot>فعال</Badge> : <Badge tone="bad" dot>ندارد</Badge> },
                  { key: "l", header: "آخرین ورود", cell: (r) => <span className="text-[12px] text-muted-foreground">{faAgo(r.last_sign_in_at)}</span> },
                ]} />
            )}
          </Panel>
        </div>
        <Panel title="قواعد حفاظتی فعال" icon={ShieldCheck}>
          <ul className="space-y-3 text-[12.5px] leading-relaxed">
            {[
              ["کمترین دسترسی", "هر کار در پایگاه داده بررسی می‌شود؛ پنهان‌بودن دکمه به‌تنهایی دسترسی نمی‌دهد."],
              ["ورود دومرحله‌ای", "کاربران، ممیزی و همهٔ تغییرات مدیریتی فقط با نشست دومرحله‌ای."],
              ["دلیل و ممیزی", "تعلیق، تغییر نقش، بایگانی و حذف بدون دلیل انجام نمی‌شود و در گزارش ممیزی تغییرناپذیر می‌ماند."],
              ["تعلیق پیش از حذف", "مرکز اول معلق، بعد بایگانی و بعد با مهلت دست‌کم ۷ روز حذف می‌شود؛ حذف دائمی با تایپ نشانی مرکز."],
              ["حداقل یک مدیر", "آخرین مدیر Lexa را نمی‌توان کنار گذاشت و حساب مدیر معلق نمی‌شود."],
              ["کمینه‌سازی داده", "ایمیل‌ها در فهرست نیمه‌پنهان‌اند؛ دیدن پروندهٔ کامل یک کاربر هم ثبت می‌شود."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-2.5"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><span><b>{t}:</b> <span className="text-muted-foreground">{d}</span></span></li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
