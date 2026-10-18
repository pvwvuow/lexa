"use client";
/* Lexa platform console (phase A1 of docs/ADMIN_PLATFORM.md) — the full-screen operations console a
 * cloud admin sees instead of the learning shell. Sections live on #/admin/<section>; the frame, the
 * role-based home and the three module pages (centres, users, audit) are the A1 deliverable. */
import * as React from "react";
import {
  Activity, AlertTriangle, ArrowLeftRight, Building2, CalendarClock, GraduationCap, Inbox, KeyRound,
  LogIn, ScrollText, ShieldCheck, Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth-client";
import { navigate } from "@/lib/router";
import { consoleSectionFromHash, setWorkspacePref, useCloudSignedIn } from "@/lib/workspace";
import { adminReviewTeacher, adminTeacherRequests, adminOrgs, type TeacherRequest, type Org } from "@/lib/cloud-api/orgs";
import {
  actionLabel, adminError, adminHome, adminOrgLifecycle, faAgo, faDateTime, faHours, faNum,
  type AdminOrgRow,
} from "@/lib/cloud-api/admin-console";
import { orgError } from "@/lib/cloud-api/orgs";
import { useAal } from "@/lib/mfa";
import { MfaPanel } from "@/components/app/MfaPanel";
import {
  Badge, Btn, ConsoleFrame, EmptyState, KeyValues, Kpi, Notice, PageHeader, Panel, RefreshBtn,
  TrendChart, useLoad, type NavGroup,
} from "./ConsoleKit";
import { AdminCentresPage } from "./AdminCentresPage";
import { AdminUsersPage } from "./AdminUsersPage";
import { AdminAuditPage } from "./AdminAuditPage";

const ALERT_LABEL: Record<string, string> = {
  admins_no_mfa: "مدیری بدون ورود دومرحله‌ای",
  org_delete_due: "مهلت حذف مرکز سرآمده",
  org_expired: "اعتبار مرکز تمام‌شده",
  org_expiring: "اعتبار مرکز رو به پایان",
  org_students_full: "صندلی دانشجوی مرکز پرشده",
  org_teachers_full: "صندلی مدرس مرکز پرشده",
  connector_failed: "اجرای ناموفق کانکتور (۲۴ ساعت)",
  api_errors: "خطای بالای API (۲۴ ساعت)",
};

export function PlatformConsole() {
  const auth = useAuth();
  const cloud = useCloudSignedIn();
  const [section, setSection] = React.useState("overview");
  React.useEffect(() => {
    const read = () => setSection(consoleSectionFromHash("overview"));
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const go = (key: string) => { window.location.hash = key === "overview" ? "#/admin" : `#/admin/${key}`; };
  const toLearning = () => { setWorkspacePref("learning"); navigate({ view: "home" }); };

  if (!cloud || auth.user?.role !== "admin") {
    return (
      <div dir="rtl" className="grid min-h-screen place-items-center bg-background p-6">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-card">
          <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-bronze" />
          <h1 className="font-display text-lg font-extrabold">کنسول مدیریت Lexa</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            این کنسول با حساب ابری Lexa که نقش مدیر دارد باز می‌شود. اگر تازه مدیر شده‌اید یک‌بار خارج و دوباره وارد شوید.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Btn kind="primary" icon={LogIn} onClick={toLearning}>رفتن به محیط یادگیری</Btn>
          </div>
        </div>
      </div>
    );
  }

  const groups: NavGroup[] = [
    { label: "خانه", items: [
      { key: "overview", label: "نمای کلی", icon: Activity },
      { key: "requests", label: "درخواست‌ها", icon: Inbox },
    ] },
    { label: "مدیریت", items: [
      { key: "centres", label: "مراکز آموزشی", icon: Building2 },
      { key: "users", label: "کاربران و نقش‌ها", icon: Users },
      { key: "audit", label: "گزارش ممیزی", icon: ScrollText },
      { key: "security", label: "امنیت", icon: ShieldCheck },
    ] },
    { label: "تحلیل", items: [
      { key: "learning", label: "یادگیری", icon: GraduationCap },
    ] },
  ];

  return (
    <ConsoleFrame product="Lexa" workspace="کنسول مدیریت پلتفرم" groups={groups} active={section} onSelect={go}
      crumbs={["Lexa", "کنسول مدیریت", sectionTitle(section)]}
      footer={
        <div className="space-y-2">
          <button type="button" onClick={toLearning}
            className="flex w-full items-center gap-2.5 rounded-lg bg-white/[0.06] px-3 py-2 text-[12.5px] font-semibold text-white/80 transition-colors hover:bg-white/[0.1] hover:text-white">
            <GraduationCap className="h-4 w-4 text-bronze" /> محیط یادگیری
          </button>
          <p className="px-1 text-[10px] leading-relaxed text-white/35">فاز A1 طرح پنل مدیریت · هر تغییر حساس در گزارش ممیزی ثبت می‌شود</p>
        </div>
      }>
      {section === "overview" && <Overview onGo={go} />}
      {section === "requests" && <RequestsSection />}
      {section === "centres" && <AdminCentresPage />}
      {section === "users" && <AdminUsersPage />}
      {section === "audit" && <AdminAuditPage />}
      {section === "security" && <SecuritySection onGo={go} />}
      {section === "learning" && <LearningSection />}
      {!["overview", "requests", "centres", "users", "audit", "security", "learning"].includes(section) && (
        <EmptyState title="این بخش در فاز A1 نیست" text="بخش‌های موجود از منوی کنار صفحه انتخاب می‌شوند." action={<Btn kind="primary" onClick={() => go("overview")}>نمای کلی</Btn>} />
      )}
    </ConsoleFrame>
  );
}

function sectionTitle(s: string): string {
  const map: Record<string, string> = {
    overview: "نمای کلی", requests: "درخواست‌ها", centres: "مراکز آموزشی", users: "کاربران و نقش‌ها",
    audit: "گزارش ممیزی", security: "امنیت", learning: "یادگیری",
  };
  return map[s] ?? "نمای کلی";
}

// ─── overview ────────────────────────────────────────────────────────────────────────────────
function Overview({ onGo }: { onGo: (k: string) => void }) {
  const home = useLoad(() => adminHome(), []);
  const h = home.data;
  const aal = useAal();
  return (
    <>
      <PageHeader title="نمای کلی" description="وضعیت پلتفرم در یک نگاه: کاربران، یادگیری، مراکز، صف‌های کار و هشدارها."
        meta={h ? <>امروز {faDate_(h.today)} · محاسبه‌شده {faAgo(h.generated_at)}</> : undefined}
        actions={<RefreshBtn onClick={() => void home.reload()} busy={home.busy} at={home.at} />} />
      {home.error ? <div className="mb-4"><Notice tone="bad" title="داده‌های کنسول خوانده نشد">{adminError(home.error)}</Notice></div> : null}
      {h && !h.mfa && aal !== "aal2" && (
        <div className="mb-4"><Notice tone="warn" title="ورود دومرحله‌ای شما فعال نیست"
          action={<Btn size="sm" kind="primary" onClick={() => onGo("security")}>فعال‌سازی</Btn>}>
          برای بخش کاربران، گزارش ممیزی و هر تغییر حساسی به نشست دومرحله‌ای نیاز دارید.
        </Notice></div>
      )}
      {h && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="کاربران Lexa" value={faNum(h.kpis.users)} icon={Users}
              hint={<>+{faNum(h.kpis.users_new_7d)} در ۷ روز · ورودهای موفق هفته: {faNum(h.kpis.signins_7d)}</>}
              spark={h.series.map((p) => p.signups)} />
            <Kpi label="یادگیرندهٔ امروز" value={faNum(h.kpis.learners_1d)} icon={GraduationCap}
              hint={<>۷ روز: {faNum(h.kpis.learners_7d)} · ۳۰ روز: {faNum(h.kpis.learners_30d)}</>}
              spark={h.series.map((p) => p.learners)} />
            <Kpi label="مطالعهٔ ۷ روز" value={`${faHours(h.kpis.study_seconds_7d)} ساعت`} icon={CalendarClock}
              hint={<>۳۰ روز: {faHours(h.kpis.study_seconds_30d)} ساعت</>}
              spark={h.series.map((p) => p.seconds)} />
            <Kpi label="مراکز فعال" value={faNum(h.kpis.orgs_active)} icon={Building2}
              hint={<>{faNum(h.kpis.orgs_pending)} در انتظار · {faNum(h.kpis.orgs_expired)} تمام‌شده · {faNum(h.kpis.orgs_suspended)} معلق · {faNum(h.kpis.orgs_archived)} بایگانی</>} />
            <Kpi label="دانشجوی رسمی" value={faNum(h.kpis.official_students)} icon={GraduationCap}
              hint={<>{faNum(h.kpis.student_seats)} صندلی خریداری‌شده</>} />
            <Kpi label="کلاس‌های فعال" value={faNum(h.kpis.classes_active)} icon={ArrowLeftRight}
              hint={<>{faNum(h.kpis.exams_next_7d)} آزمون رسمی در ۷ روز آینده</>} />
            <Kpi label="مدیران Lexa" value={faNum(h.kpis.admins)} icon={ShieldCheck}
              tone={h.kpis.admins_no_mfa ? "warn" : "brand"}
              hint={h.kpis.admins_no_mfa ? <>{faNum(h.kpis.admins_no_mfa)} مدیر بدون ورود دومرحله‌ای</> : "همهٔ مدیرها دومرحله‌ای دارند"} />
            <Kpi label="کاربران معلق" value={faNum(h.kpis.suspended_users)} icon={AlertTriangle}
              tone={h.kpis.suspended_users ? "warn" : "brand"} hint="پس از تعلیق، ورود بلافاصله بسته می‌شود" />
          </div>
          <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Panel title="۳۰ روز گذشته" description="ثبت‌نام، یادگیرندهٔ فعال و ساعت مطالعه در یک نمودار">
              <TrendChart labels={h.series.map((p) => p.day.slice(5))} height={220}
                series={[
                  { name: "یادگیرندهٔ فعال", color: "#8a6a30", area: true, values: h.series.map((p) => p.learners) },
                  { name: "ثبت‌نام", color: "#3b82f6", values: h.series.map((p) => p.signups) },
                  { name: "ساعت مطالعه", color: "#10b981", values: h.series.map((p) => Math.round(p.seconds / 360) / 10) },
                ]} format={(v) => faNum(v)} />
            </Panel>
            <Panel title="هشدارها" description="نزدیک‌ترین کارهایی که به توجه ادمین نیاز دارند">
              {h.alerts.length === 0
                ? <EmptyState icon={ShieldCheck} title="هشداری نیست" text="همهٔ مراکز، کلیدها و کانکتورها در وضعیت سالم‌اند." />
                : (
                  <ul className="space-y-2">
                    {h.alerts.map((a, i) => (
                      <li key={`${a.kind}-${i}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-[12.5px]">
                        <Badge tone={a.rank <= 2 ? "bad" : a.rank <= 4 ? "warn" : "muted"} dot>{ALERT_LABEL[a.kind] ?? a.kind}</Badge>
                        {a.name && <b className="truncate">{a.name}</b>}
                        {a.used !== undefined && a.cap !== undefined && <span className="tabular-nums text-muted-foreground">{faNum(a.used)} از {faNum(a.cap)}</span>}
                        {a.count !== undefined && <span className="tabular-nums text-muted-foreground">تعداد: {faNum(a.count)}</span>}
                        {a.org_id && <button type="button" onClick={() => onGo("centres")} className="ms-auto text-[11.5px] font-bold text-bronze hover:underline">مشاهدهٔ مرکز</button>}
                      </li>
                    ))}
                  </ul>
                )}
            </Panel>
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <Panel title="صف‌های کار" description="کارهای در انتظار تصمیم ادمین">
              <KeyValues items={[
                ["درخواست حساب مدرس", <QueueLink key="t" count={h.queues.teacher_requests} oldest={h.queues.teacher_requests_oldest} onClick={() => onGo("requests")} />],
                ["درخواست ساخت مرکز", <QueueLink key="o" count={h.queues.org_requests} oldest={h.queues.org_requests_oldest} onClick={() => onGo("requests")} />],
                ["حذف‌های سرآمده", <QueueLink key="d" count={h.queues.orgs_delete_due} onClick={() => onGo("centres")} />],
                ["حذف‌های زمان‌بندی‌شده", <QueueLink key="s" count={h.queues.orgs_delete_scheduled} onClick={() => onGo("centres")} />],
              ]} />
              {(h.kpis.connector_failed_24h !== null || h.kpis.api_errors_24h !== null) && (
                <p className="mt-3 text-[11.5px] text-muted-foreground">
                  {h.kpis.connector_failed_24h !== null ? <>اجرای ناموفق کانکتور ۲۴ ساعت: {faNum(h.kpis.connector_failed_24h)} · </> : null}
                  {h.kpis.api_errors_24h !== null ? <>خطاهای API ۲۴ ساعت: {faNum(h.kpis.api_errors_24h)}</> : null}
                </p>
              )}
            </Panel>
            <Panel title="فعالیت اخیر" description="آخرین رویدادهای ممیزی — جزئیات کامل در «گزارش ممیزی»"
              actions={<Btn size="sm" kind="ghost" icon={ScrollText} onClick={() => onGo("audit")}>گزارش ممیزی</Btn>}>
              {h.recent.length === 0
                ? <EmptyState icon={ScrollText} title="رویدادی ثبت نشده است" />
                : (
                  <ul className="space-y-1.5 text-[12px]">
                    {h.recent.slice(0, 12).map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center gap-2 border-b border-border/50 pb-1.5 last:border-0">
                        <span className="tabular-nums text-muted-foreground">{faDateTime(r.at)}</span>
                        <b>{actionLabel(r.action)}</b>
                        {r.actor && <span dir="ltr" className="text-muted-foreground">@{r.actor}</span>}
                        {(r.org || r.target_name) && <span className="text-muted-foreground">· {r.org ?? r.target_name}</span>}
                      </li>
                    ))}
                  </ul>
                )}
            </Panel>
          </div>
        </>
      )}
    </>
  );
}

function QueueLink({ count, oldest, onClick }: { count: number; oldest?: string | null; onClick: () => void }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Badge tone={count > 0 ? "warn" : "muted"} dot={count > 0}>{faNum(count)} در صف</Badge>
      {count > 0 && oldest && <span className="text-[11px] text-muted-foreground">قدیمی‌ترین: {faAgo(oldest)}</span>}
      {count > 0 && <button type="button" onClick={onClick} className="ms-auto text-[11.5px] font-bold text-bronze hover:underline">بررسی</button>}
    </span>
  );
}

function faDate_(day: string): string {
  try { return new Date(`${day}T12:00:00Z`).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" }); }
  catch { return day; }
}

// ─── requests ────────────────────────────────────────────────────────────────────────────────
function RequestsSection() {
  const teachers = useLoad(() => adminTeacherRequests("pending"), []);
  const orgs = useLoad(() => adminOrgs(), []);
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState("");
  const orgRequests = (orgs.data ?? []).filter((o: Org) => o.status === "pending");
  const [confirm, setConfirm] = React.useState<{ uid: string; name: string } | null>(null);

  async function review(uid: string, approve: boolean, note = "") {
    setBusy(uid); setErr("");
    try { await adminReviewTeacher(uid, approve, note); void teachers.reload(); }
    catch (e) { setErr(orgError(e)); } finally { setBusy(""); }
  }
  async function activateOrg(o: AdminOrgRow | { id: string; name: string; slug: string }) {
    setBusy(o.id); setErr("");
    try { await adminOrgLifecycle(o.id, "activate"); void orgs.reload(); }
    catch (e) { setErr(adminError(e)); } finally { setBusy(""); }
  }

  return (
    <>
      <PageHeader title="درخواست‌ها" description="درخواست حساب مدرس و ساخت مرکز آموزشی. تأیید یا رد هر درخواست در گزارش ممیزی ثبت می‌شود." />
      {err && <div className="mb-4"><Notice tone="bad" title="کار انجام نشد">{err}</Notice></div>}
      <Panel className="mb-4" title="درخواست‌های حساب مدرس" icon={Users}
        description="تأیید یعنی نقش حساب به «مدرس» تغییر می‌کند؛ رد با دلیل برای متقاضی نمایش داده می‌شود."
        actions={<RefreshBtn onClick={() => void teachers.reload()} busy={teachers.busy} at={teachers.at} />}>
        {teachers.error ? <Notice tone="bad" title="فهرست خوانده نشد">{orgError(teachers.error)}</Notice>
          : (teachers.data ?? []).length === 0 ? <EmptyState icon={Inbox} title="درخواستی در صف نیست" />
          : (
            <ul className="space-y-2">
              {(teachers.data ?? []).map((r: TeacherRequest) => (
                <li key={r.userId} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="text-[13px]">{r.fullName}</b>
                    {r.user?.username && <span dir="ltr" className="text-[11px] text-muted-foreground">@{r.user.username}</span>}
                    <span className="text-[11px] text-muted-foreground">{faAgo(r.createdAt)}</span>
                    <span className="ms-auto flex gap-2">
                      <Btn size="sm" kind="primary" busy={busy === r.userId} onClick={() => void review(r.userId, true)}>تأیید</Btn>
                      <Btn size="sm" onClick={() => setConfirm({ uid: r.userId, name: r.fullName })}>رد…</Btn>
                    </span>
                  </div>
                  {r.credentials && <p className="mt-1.5 text-[11.5px]"><b>سوابق:</b> {r.credentials}</p>}
                  {r.bio && <p className="mt-1 text-[11.5px] text-muted-foreground">{r.bio}</p>}
                  {r.contact && <p className="mt-1 text-[11px] text-muted-foreground">تماس: {r.contact}</p>}
                </li>
              ))}
            </ul>
          )}
      </Panel>
      <Panel title="مراکز در انتظار فعال‌سازی" icon={Building2}
        description="پس از فعال‌سازی، صاحب مرکز می‌تواند مدرس دعوت کند و کلاس بسازد."
        actions={<RefreshBtn onClick={() => void orgs.reload()} busy={orgs.busy} at={orgs.at} />}>
        {orgs.error ? <Notice tone="bad" title="فهرست مراکز خوانده نشد">{adminError(orgs.error)}</Notice>
          : orgRequests.length === 0 ? <EmptyState icon={Inbox} title="مرکزی در صف فعال‌سازی نیست" />
          : (
            <ul className="space-y-2">
              {orgRequests.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
                  <b className="text-[13px]">{o.name}</b>
                  <span dir="ltr" className="text-[11px] text-muted-foreground">{o.slug}</span>
                  <Badge tone="info">در انتظار</Badge>
                  <span className="text-[11px] text-muted-foreground">{faAgo(o.createdAt)}</span>
                  <span className="ms-auto flex gap-2">
                    <Btn size="sm" kind="primary" busy={busy === o.id} onClick={() => void activateOrg(o)}>فعال‌سازی</Btn>
                    <Btn size="sm" onClick={() => { window.location.hash = "#/admin/centres"; }}>مراکز آموزشی</Btn>
                  </span>
                </li>
              ))}
            </ul>
          )}
      </Panel>
      <RejectTeacherDialog confirm={confirm} onClose={() => setConfirm(null)} onDone={(uid, reason) => void review(uid, false, reason)} busy={busy} />
    </>
  );
}

function RejectTeacherDialog({ confirm, onClose, onDone, busy }: {
  confirm: { uid: string; name: string } | null; onClose: () => void; onDone: (uid: string, reason: string) => void; busy: string;
}) {
  const [reason, setReason] = React.useState("");
  const [err, setErr] = React.useState("");
  React.useEffect(() => { setReason(""); setErr(""); }, [confirm]);
  if (!confirm) return null;
  const ok = reason.trim().length >= 3;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4" dir="rtl" role="alertdialog" aria-modal>
      <button type="button" aria-label="انصراف" className="absolute inset-0 bg-black/45" onClick={onClose} disabled={busy === confirm.uid} />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-2xl">
        <h3 className="text-[15px] font-extrabold">رد درخواست مدرس</h3>
        <p className="mt-2 text-[12.5px] text-muted-foreground">درخواست «{confirm.name}» رد می‌شود. دلیل برای متقاضی نمایش داده می‌شود.</p>
        <textarea rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)}
          className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-bronze"
          placeholder="مثلاً مدارک هویتی ناقص است — پس از تکمیل دوباره درخواست بدهید." />
        {err && <p role="alert" className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-[12px] text-red-700 dark:text-red-400">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Btn onClick={onClose} disabled={busy === confirm.uid}>انصراف</Btn>
          <Btn kind="danger" busy={busy === confirm.uid} disabled={!ok}
            onClick={() => { onDone(confirm.uid, reason.trim()); onClose(); }}>رد درخواست</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── security ────────────────────────────────────────────────────────────────────────────────
function SecuritySection({ onGo }: { onGo: (k: string) => void }) {
  const home = useLoad(() => adminHome(), []);
  const h = home.data;
  const aal = useAal();
  return (
    <>
      <PageHeader title="امنیت" description="ورود دومرحله‌ای خودتان، وضعیت مدیران و کارهای حساس محافظت‌شده."
        actions={<RefreshBtn onClick={() => void home.reload()} busy={home.busy} at={home.at} />} />
      {home.error ? <div className="mb-4"><Notice tone="bad" title="وضعیت امنیتی خوانده نشد">{adminError(home.error)}</Notice></div> : null}
      {h && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Kpi label="نشست دومرحله‌ای شما" value={aal === "aal2" ? "فعال" : "غیرفعال"} icon={KeyRound}
            tone={aal === "aal2" ? "ok" : "warn"} hint={h.mfa ? "عامل دومرحله‌ای ثبت شده است" : "هنوز عاملی ثبت نکرده‌اید"} />
          <Kpi label="مدیران بدون دومرحله‌ای" value={faNum(h.kpis.admins_no_mfa ?? 0)} icon={ShieldCheck}
            tone={h.kpis.admins_no_mfa ? "warn" : "ok"} hint="این مدیرها به بخش کاربران و ممیزی راه ندارند"
          />
          <Kpi label="کاربران معلق" value={faNum(h.kpis.suspended_users)} icon={AlertTriangle}
            tone={h.kpis.suspended_users ? "warn" : "muted"} hint="پرونده و رفع تعلیق در «کاربران و نقش‌ها»"
          />
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="ورود دومرحله‌ای من" icon={KeyRound} description="برنامهٔ احراز هویت (TOTP). برای بخش کاربران، گزارش ممیزی و همهٔ تغییرهای حساس لازم است.">
          <MfaPanel />
        </Panel>
        <Panel title="حفاظ‌های فاز A1" icon={ShieldCheck}>
          <ul className="space-y-2 text-[12.5px] leading-relaxed text-muted-foreground">
            <li>· تغییر نقش، تعلیق، خروج اجباری و بازنشانی دومرحله‌ای فقط با نشست دومرحله‌ای و با دلیل انجام می‌شود.</li>
            <li>· تعلیق مدیر یا خودتان پذیرفته نمی‌شود؛ آخرین مدیر Lexa هم قابل تنزل نیست.</li>
            <li>· حذف دائمی مرکز سه‌مرحله‌ای است: تعلیق ← بایگانی ← حذف زمان‌بندی‌شده (۳۰ روز) با امکان لغو.</li>
            <li>· همهٔ کارهای بالا در گزارش ممیزی با انجام‌دهنده، هدف، دلیل و مقدار قبل/بعد ثبت می‌شوند.</li>
          </ul>
          <div className="mt-3 flex gap-2">
            <Btn size="sm" icon={ScrollText} onClick={() => onGo("audit")}>گزارش ممیزی</Btn>
            <Btn size="sm" icon={Users} onClick={() => onGo("users")}>کاربران و نقش‌ها</Btn>
          </div>
        </Panel>
      </div>
    </>
  );
}

// ─── learning ────────────────────────────────────────────────────────────────────────────────
function LearningSection() {
  const home = useLoad(() => adminHome(), []);
  const h = home.data;
  return (
    <>
      <PageHeader title="یادگیری" description="روند یادگیری سراسری پلتفرم: یادگیرندهٔ فعال، ساعت مطالعه، کلاس‌ها و آزمون‌های رسمی."
        actions={<RefreshBtn onClick={() => void home.reload()} busy={home.busy} at={home.at} />} />
      {home.error ? <div className="mb-4"><Notice tone="bad" title="آمار یادگیری خوانده نشد">{adminError(home.error)}</Notice></div> : null}
      {h && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="یادگیرندهٔ امروز" value={faNum(h.kpis.learners_1d)} icon={GraduationCap} hint={<>دیروز تا امروز</>} spark={h.series.map((p) => p.learners)} />
            <Kpi label="یادگیرندهٔ ۷ روز" value={faNum(h.kpis.learners_7d)} icon={Users} hint={<>۳۰ روز: {faNum(h.kpis.learners_30d)}</>} />
            <Kpi label="ساعت مطالعهٔ ۷ روز" value={faHours(h.kpis.study_seconds_7d)} icon={CalendarClock} hint={<>۳۰ روز: {faHours(h.kpis.study_seconds_30d)} ساعت</>} spark={h.series.map((p) => p.seconds)} />
            <Kpi label="کلاس فعال" value={faNum(h.kpis.classes_active)} icon={ArrowLeftRight} hint={<>{faNum(h.kpis.exams_next_7d)} آزمون رسمی در ۷ روز آینده</>} />
          </div>
          <Panel title="۳۰ روز گذشته" description="یادگیرندهٔ فعال و ساعت مطالعه — جزئیات هر مرکز در «مراکز آموزشی»">
            <TrendChart labels={h.series.map((p) => p.day.slice(5))} height={230}
              series={[
                { name: "یادگیرندهٔ فعال", color: "#8a6a30", area: true, values: h.series.map((p) => p.learners) },
                { name: "ساعت مطالعه", color: "#10b981", values: h.series.map((p) => Math.round(p.seconds / 360) / 10) },
              ]} format={(v) => faNum(v)} />
          </Panel>
          <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
            ثبت زمان مطالعه فقط با صفحهٔ پیدار و فعالیت واقعی شمرده می‌شود (ضربان ۶۰ ثانیه‌ای، سقف ۱۲ ساعت در روز)؛ اعداد این نما با «آمار من» دانشجوها هم‌مبناست.
          </p>
        </>
      )}
    </>
  );
}
