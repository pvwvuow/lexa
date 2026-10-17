"use client";

/* === دانشگاه‌ها و موسسه‌ها — پنل سازمانی Lexa ===
 * #/org        → هاب: دعوت‌های من، سازمان‌های من، فهرست سازمان‌ها، درخواست حساب
 *                استادی، درخواست پنل سازمانی، و کنسول مدیر Lexa
 * #/org/<slug> → صفحهٔ سازمان: اساتید، دوره‌ها و مطالب؛ برای مدیران پنل:
 *                دعوت/تأیید اساتید، اعضا، تنظیمات
 * یک استاد می‌تواند عضو چند سازمان باشد؛ سازمان استاد را «دعوت» می‌کند و خود
 * استاد می‌پذیرد (یا استاد درخواست عضویت می‌دهد و مدیر پنل تأیید می‌کند).
 * داده و دسترسی‌ها: supabase/002_cloud_social.sql
 * --- */
import * as React from "react";
import {
  Building2, Loader2, Search, Plus, Check, X, Users, GraduationCap, Settings2, ShieldCheck,
  MailPlus, Mail, Globe, MapPin, CalendarClock, BadgeCheck, UserPlus, LogIn, Newspaper,
  Crown, Trash2, Upload, ArrowLeft, Send, Clock3, Sparkles,
} from "lucide-react";
import { navigate } from "@/lib/router";
import { fa } from "@/lib/fa";
import { useAuth } from "@/lib/auth-client";
import { sbUser } from "@/lib/supabase";
import { requestAuthPrompt } from "@/lib/auth-prompt";
import {
  ORG_KINDS, ORG_PLANS, orgKindLabel, orgError, isOrgLive,
  listActiveOrgs, getOrg, orgMembers, seatsUsed, findUser, searchTeachers,
  createOrg, updateOrg, inviteToOrg, requestJoinOrg, respondInvite, reviewJoinRequest,
  setOrgMember, unlinkFromOrg, uploadOrgLogo, myTeacherRequest, requestTeacherAccount,
  adminTeacherRequests, adminReviewTeacher, adminSetRole, adminOrgs, adminSetOrg,
  useMyMemberships, useManagedOrgs, usePublishOrgs,
  type Org, type OrgMember, type MiniUser, type TeacherRequest, type OrgKind, type OrgStatus, type OrgPlan,
} from "@/lib/cloud-api/orgs";
import type { TCourseCard, FeedPost } from "@/lib/social-client";
import { UserAvatar, CourseIcon } from "./common";
import { inputCls, labelCls } from "./StudioView";

const card = "rounded-2xl border border-border bg-card p-5 shadow-card";
const btnPrimary = "inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[12.5px] font-bold text-primary-foreground shadow-card transition-all hover:brightness-110 disabled:opacity-45";
const btnGhost = "inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-[12px] font-bold text-muted-foreground transition-colors hover:border-bronze/60 hover:text-foreground disabled:opacity-45";

function faDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" }); } catch { return ""; }
}

function useCloudSignedIn(): boolean {
  const { user } = useAuth();
  return !!user && !!sbUser() && sbUser()!.id === user.id;
}

function SignInNote({ what }: { what: string }) {
  return (
    <div className={`${card} flex flex-wrap items-center gap-3 border-dashed`}>
      <LogIn className="h-5 w-5 shrink-0 text-bronze" />
      <p className="min-w-0 flex-1 text-sm leading-relaxed text-muted-foreground">{what} با حساب Lexa (ایمیل) وارد شو.</p>
      <button className={btnPrimary} onClick={() => requestAuthPrompt(what)}>ورود / ثبت‌نام</button>
    </div>
  );
}

function ErrLine({ msg }: { msg: string }) {
  if (!msg) return null;
  return <p className="rounded-xl bg-destructive/10 px-4 py-2.5 text-[12.5px] text-destructive">{msg}</p>;
}

function OkLine({ msg }: { msg: string }) {
  if (!msg) return null;
  return <p className="rounded-xl bg-success/10 px-4 py-2.5 text-[12.5px] font-semibold text-success">{msg}</p>;
}

function OrgLogo({ org, size = 44 }: { org: Pick<Org, "logoUrl" | "name">; size?: number }) {
  return org.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={org.logoUrl} alt="" width={size} height={size} className="shrink-0 rounded-xl border border-border bg-background object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-xl bg-bronze/15 text-bronze" style={{ width: size, height: size }}>
      <Building2 className="h-5 w-5" />
    </span>
  );
}

function StatusPill({ org }: { org: Pick<Org, "status" | "expiresAt"> }) {
  if (isOrgLive(org)) return <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-[10px] font-bold text-success">فعال</span>;
  if (org.status === "pending") return <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">در انتظار فعال‌سازی</span>;
  if (org.status === "suspended") return <span className="rounded-full bg-destructive/15 px-2.5 py-0.5 text-[10px] font-bold text-destructive">معلق</span>;
  return <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground">منقضی</span>;
}

const ROLE_LABEL: Record<string, string> = { owner: "مالک پنل", manager: "مدیر پنل", teacher: "استاد" };

/* === ورودی === */
export function OrgView({ id }: { id?: string }) {
  return id ? <OrgPage key={id} idOrSlug={id} /> : <OrgHub />;
}

/* === هاب === */
function OrgHub() {
  const auth = useAuth();
  const signed = useCloudSignedIn();
  const mem = useMyMemberships();
  const invites = mem.items.filter((m) => m.status === "invited");
  const mine = mem.items.filter((m) => m.status === "active" || m.status === "requested");

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-28 pt-6 sm:px-6">
      <header>
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><Building2 className="h-6 w-6" /></span>
          دانشگاه‌ها و موسسه‌ها
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          هر دانشگاه یا موسسه می‌تواند پنل Lexa داشته باشد: اساتیدش را دعوت و مدیریت کند و دوره‌ها و مطالب
          آن‌ها زیر نام سازمان دیده شود. یک استاد می‌تواند هم‌زمان عضو چند سازمان باشد.
        </p>
      </header>

      {!signed && <SignInNote what="برای دیدن دعوت‌ها، عضویت در سازمان یا ثبت پنل" />}

      {signed && invites.length > 0 && <InvitesCard items={invites} onDone={() => void mem.reload()} />}

      {signed && mine.length > 0 && (
        <section className={card}>
          <h2 className="mb-3 flex items-center gap-2 text-[14px] font-extrabold"><BadgeCheck className="h-4.5 w-4.5 text-bronze" /> سازمان‌های من</h2>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {mine.map((m) => (
              <button key={m.org.id} onClick={() => navigate({ view: "org", id: m.org.slug })} className="flex items-center gap-3 rounded-xl border border-border p-3 text-start transition-colors hover:border-bronze/50">
                <OrgLogo org={m.org} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-bold">{m.org.name}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-muted-foreground">
                    {m.status === "requested" ? "درخواست عضویت در انتظار تأیید" : ROLE_LABEL[m.role]}
                    {m.title ? ` · ${m.title}` : ""}
                  </span>
                </span>
                <StatusPill org={m.org} />
              </button>
            ))}
          </div>
        </section>
      )}

      {signed && auth.user?.role === "user" && <TeacherRequestCard />}

      <OrgDirectory />

      {signed && <CreateOrgCard onCreated={() => void mem.reload()} />}

      {signed && auth.user?.role === "admin" && <AdminConsole />}
    </div>
  );
}

function InvitesCard({ items, onDone }: { items: ReturnType<typeof useMyMemberships>["items"]; onDone: () => void }) {
  const auth = useAuth();
  const [busy, setBusy] = React.useState("");
  const [err, setErr] = React.useState("");
  async function answer(orgId: string, accept: boolean) {
    setBusy(orgId + accept); setErr("");
    try {
      await respondInvite(orgId, accept);
      if (accept) await auth.refreshMe(); // پذیرش دعوت، حساب ساده را استادی می‌کند
      onDone();
    } catch (e) {
      setErr(orgError(e));
    } finally {
      setBusy("");
    }
  }
  return (
    <section className={`${card} border-bronze/50 bg-gradient-to-l from-bronze/[0.07] to-card`}>
      <h2 className="mb-1 flex items-center gap-2 text-[14px] font-extrabold"><Mail className="h-4.5 w-4.5 text-bronze" /> دعوت‌نامه‌های سازمانی ({fa(items.length)})</h2>
      <p className="mb-3 text-[11.5px] leading-relaxed text-muted-foreground">با پذیرش، نامت در صفحهٔ اساتید آن سازمان می‌آید و می‌توانی دوره و مطلب را به نام آن منتشر کنی. اگر هنوز حساب استادی نداری، با پذیرش دعوت فعال می‌شود.</p>
      <ErrLine msg={err} />
      <div className="mt-2 space-y-2.5">
        {items.map((m) => (
          <div key={m.org.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
            <OrgLogo org={m.org} size={40} />
            <div className="min-w-0 flex-1">
              <button onClick={() => navigate({ view: "org", id: m.org.slug })} className="block truncate text-start text-[13.5px] font-bold hover:text-bronze">{m.org.name}</button>
              <p className="text-[11px] text-muted-foreground">{orgKindLabel(m.org.kind)}{m.org.city ? ` · ${m.org.city}` : ""}{m.title ? ` · سمت: ${m.title}` : ""}</p>
              {m.message && <p className="mt-1 text-[11.5px] leading-relaxed text-foreground/80">«{m.message}»</p>}
            </div>
            <div className="flex gap-2">
              <button className={btnPrimary} disabled={!!busy} onClick={() => void answer(m.org.id, true)}>
                {busy === m.org.id + "true" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} پذیرش
              </button>
              <button className={btnGhost} disabled={!!busy} onClick={() => void answer(m.org.id, false)}>
                {busy === m.org.id + "false" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} رد
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TeacherRequestCard() {
  const [req, setReq] = React.useState<TeacherRequest | null | undefined>(undefined);
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ fullName: "", bio: "", credentials: "", contact: "" });
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  React.useEffect(() => {
    myTeacherRequest().then(setReq).catch(() => setReq(null));
  }, []);
  async function send() {
    if (f.fullName.trim().length < 2) { setErr("نام و نام خانوادگی را کامل بنویس."); return; }
    setBusy(true); setErr("");
    try {
      await requestTeacherAccount(f);
      setReq(await myTeacherRequest());
      setOpen(false);
    } catch (e) {
      setErr(orgError(e));
    } finally {
      setBusy(false);
    }
  }
  if (req === undefined) return null;
  return (
    <section className={card}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-bronze/15 text-bronze"><GraduationCap className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-extrabold">استاد هستی؟</h2>
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            {req?.status === "pending"
              ? `درخواست حساب استادی‌ات (${faDate(req.createdAt)}) در صف بررسی مدیر Lexa است.`
              : req?.status === "rejected"
                ? `درخواست قبلی تأیید نشد${req.adminNote ? `: ${req.adminNote}` : ""}. می‌توانی با اطلاعات کامل‌تر دوباره بفرستی.`
                : "با حساب استادی دوره و مطلب منتشر می‌کنی؛ دانشگاه‌ها هم می‌توانند دعوتت کنند (با پذیرش دعوت، حساب استادی خودکار فعال می‌شود)."}
          </p>
        </div>
        {req?.status !== "pending" && !open && (
          <button className={btnPrimary} onClick={() => { setOpen(true); if (req) setF({ fullName: req.fullName, bio: req.bio, credentials: req.credentials, contact: req.contact }); }}>
            <Send className="h-4 w-4" /> درخواست حساب استادی
          </button>
        )}
      </div>
      {open && (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={labelCls}>نام و نام خانوادگی *</label><input className={inputCls} value={f.fullName} maxLength={80} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></div>
            <div><label className={labelCls}>راه تماس (ایمیل، تلگرام یا تلفن)</label><input className={inputCls} value={f.contact} maxLength={120} onChange={(e) => setF({ ...f, contact: e.target.value })} /></div>
          </div>
          <div><label className={labelCls}>سوابق تدریس / مدرک / محل تدریس</label><textarea className={`${inputCls} resize-y`} rows={3} maxLength={600} value={f.credentials} onChange={(e) => setF({ ...f, credentials: e.target.value })} placeholder="مثلاً: دکتری حقوق خصوصی، مدرس مدنی ۴ در دانشگاه …" /></div>
          <div><label className={labelCls}>معرفی کوتاه برای پروفایل</label><textarea className={`${inputCls} resize-y`} rows={2} maxLength={600} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></div>
          <ErrLine msg={err} />
          <div className="flex gap-2">
            <button className={btnPrimary} disabled={busy} onClick={() => void send()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} ارسال برای بررسی</button>
            <button className={btnGhost} onClick={() => setOpen(false)}>انصراف</button>
          </div>
        </div>
      )}
    </section>
  );
}

function OrgDirectory() {
  const [orgs, setOrgs] = React.useState<Org[] | null>(null);
  const [q, setQ] = React.useState("");
  const [err, setErr] = React.useState("");
  React.useEffect(() => {
    listActiveOrgs().then(setOrgs).catch((e) => { setOrgs([]); setErr(orgError(e)); });
  }, []);
  const shown = (orgs ?? []).filter((o) => !q.trim() || `${o.name} ${o.city}`.includes(q.trim()));
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Building2 className="h-5 w-5 text-bronze" /> سازمان‌های فعال در Lexa</h2>
        <label className="relative ms-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جست‌وجوی نام یا شهر…" className={`${inputCls} ps-9`} />
        </label>
      </div>
      <ErrLine msg={err} />
      {orgs === null ? (
        <p className="flex items-center gap-2 py-6 text-sm text-bronze"><Loader2 className="h-4 w-4 animate-spin" /> در حال دریافت…</p>
      ) : shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground shadow-card">
          {orgs.length ? "سازمانی با این نام پیدا نشد." : "هنوز سازمانی پنل فعال ندارد — اولین باش!"}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((o) => (
            <button key={o.id} onClick={() => navigate({ view: "org", id: o.slug })} className={`${card} flex items-start gap-3 p-4 text-start transition-colors hover:border-bronze/50`}>
              <OrgLogo org={o} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{o.name}</span>
                <span className="block text-[11px] text-muted-foreground">{orgKindLabel(o.kind)}{o.city ? ` · ${o.city}` : ""}</span>
                {o.description && <span className="mt-1 line-clamp-2 block text-[11px] leading-relaxed text-muted-foreground/90">{o.description}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

function CreateOrgCard({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ name: "", slug: "", kind: "university" as OrgKind, city: "", description: "", website: "", contact: "" });
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [done, setDone] = React.useState("");
  async function submit() {
    const slug = slugify(f.slug);
    if (f.name.trim().length < 2) { setErr("نام سازمان را بنویس."); return; }
    if (slug.length < 3) { setErr("شناسهٔ لاتین دست‌کم ۳ حرف لاتین/رقم لازم دارد (مثلاً ut-law)."); return; }
    if (!f.contact.trim()) { setErr("یک راه تماس برای هماهنگی فعال‌سازی بنویس."); return; }
    setBusy(true); setErr("");
    try {
      await createOrg({ ...f, slug });
      setDone("درخواست پنل ثبت شد. پس از هماهنگی و فعال‌سازی توسط Lexa، از «سازمان‌های من» مدیریتش می‌کنی.");
      setOpen(false);
      onCreated();
    } catch (e) {
      setErr(orgError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={`${card} border-dashed`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Sparkles className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-extrabold">پنل Lexa برای دانشگاه یا موسسه‌ات</h2>
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">درخواست بده؛ بعد از هماهنگی خرید، پنل با ظرفیت اساتید و مدت اعتبار مشخص فعال می‌شود و خودت اساتید را دعوت و مدیریت می‌کنی.</p>
        </div>
        {!open && <button className={btnPrimary} onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> درخواست پنل</button>}
      </div>
      <div className="mt-3"><OkLine msg={done} /></div>
      {open && (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={labelCls}>نام سازمان *</label><input className={inputCls} value={f.name} maxLength={100} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="دانشکدهٔ حقوق دانشگاه …" /></div>
            <div>
              <label className={labelCls}>شناسهٔ لاتین (آدرس صفحه) *</label>
              <input className={inputCls} dir="ltr" value={f.slug} maxLength={40} onChange={(e) => setF({ ...f, slug: e.target.value })} placeholder="ut-law" />
              <p className="mt-1 text-[10.5px] text-muted-foreground" dir="ltr">#/org/{slugify(f.slug) || "…"}</p>
            </div>
            <div>
              <label className={labelCls}>نوع</label>
              <select className={inputCls} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as OrgKind })}>
                {ORG_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>شهر</label><input className={inputCls} value={f.city} maxLength={60} onChange={(e) => setF({ ...f, city: e.target.value })} /></div>
            <div><label className={labelCls}>وب‌سایت</label><input className={inputCls} dir="ltr" value={f.website} maxLength={200} onChange={(e) => setF({ ...f, website: e.target.value })} placeholder="https://" /></div>
            <div><label className={labelCls}>راه تماس برای فعال‌سازی *</label><input className={inputCls} value={f.contact} maxLength={160} onChange={(e) => setF({ ...f, contact: e.target.value })} placeholder="تلفن، ایمیل یا آیدی تلگرام" /></div>
          </div>
          <div><label className={labelCls}>معرفی کوتاه</label><textarea className={`${inputCls} resize-y`} rows={3} maxLength={1200} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <ErrLine msg={err} />
          <div className="flex gap-2">
            <button className={btnPrimary} disabled={busy} onClick={() => void submit()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} ثبت درخواست</button>
            <button className={btnGhost} onClick={() => setOpen(false)}>انصراف</button>
          </div>
        </div>
      )}
    </section>
  );
}

/* === کنسول مدیر Lexa === */
export function AdminConsole() {
  return (
    <section className={`${card} space-y-6 border-primary/40`}>
      <h2 className="flex items-center gap-2 text-[15px] font-extrabold"><ShieldCheck className="h-5 w-5 text-primary" /> کنسول مدیر Lexa</h2>
      <AdminTeacherRequests />
      <AdminOrgs />
      <AdminRoleTool />
    </section>
  );
}

function AdminTeacherRequests() {
  const [rows, setRows] = React.useState<TeacherRequest[] | null>(null);
  const [busy, setBusy] = React.useState("");
  const [err, setErr] = React.useState("");
  const load = React.useCallback(() => {
    adminTeacherRequests("pending").then(setRows).catch((e) => { setRows([]); setErr(orgError(e)); });
  }, []);
  React.useEffect(load, [load]);
  async function review(uid: string, approve: boolean) {
    const note = approve ? "" : (window.prompt("دلیل (برای خود متقاضی نمایش داده می‌شود):") ?? "");
    setBusy(uid); setErr("");
    try { await adminReviewTeacher(uid, approve, note); load(); } catch (e) { setErr(orgError(e)); } finally { setBusy(""); }
  }
  return (
    <div>
      <h3 className="mb-2 text-[13px] font-extrabold text-bronze">درخواست‌های حساب استادی</h3>
      <ErrLine msg={err} />
      {rows === null ? <Loader2 className="h-4 w-4 animate-spin text-bronze" /> : rows.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">درخواستی در صف نیست.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.userId} className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <UserAvatar src={r.user?.avatarUrl} name={r.fullName} size="xs" />
                <span className="text-[13px] font-bold">{r.fullName}</span>
                <span dir="ltr" className="text-[11px] text-muted-foreground">@{r.user?.username}</span>
                <span className="text-[10.5px] text-muted-foreground">{faDate(r.createdAt)}</span>
                <span className="ms-auto flex gap-2">
                  <button className={btnPrimary} disabled={busy === r.userId} onClick={() => void review(r.userId, true)}><Check className="h-4 w-4" /> تأیید</button>
                  <button className={btnGhost} disabled={busy === r.userId} onClick={() => void review(r.userId, false)}><X className="h-4 w-4" /> رد</button>
                </span>
              </div>
              {r.credentials && <p className="mt-2 text-[11.5px] leading-relaxed"><b>سوابق:</b> {r.credentials}</p>}
              {r.bio && <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{r.bio}</p>}
              {r.contact && <p className="mt-1 text-[11px] text-muted-foreground">تماس: {r.contact}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminOrgRow({ o, onSaved }: { o: Org & { creator: MiniUser }; onSaved: () => void }) {
  const [f, setF] = React.useState({
    status: o.status as OrgStatus, plan: o.plan as OrgPlan, seats: o.seats,
    expires: o.expiresAt ? o.expiresAt.slice(0, 10) : "", note: o.adminNote,
  });
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  async function save() {
    setBusy(true); setMsg("");
    try {
      await adminSetOrg(o.id, {
        status: f.status, plan: f.plan, seats: Math.max(1, Math.min(2000, Number(f.seats) || 1)),
        expiresAt: f.expires ? new Date(`${f.expires}T23:59:59`).toISOString() : null, note: f.note,
      });
      setMsg("ذخیره شد");
      onSaved();
    } catch (e) {
      setMsg(orgError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <OrgLogo org={o} size={32} />
        <button onClick={() => navigate({ view: "org", id: o.slug })} className="text-[13px] font-bold hover:text-bronze">{o.name}</button>
        <StatusPill org={o} />
        <span className="text-[10.5px] text-muted-foreground">درخواست‌دهنده: {o.creator.displayName} · {faDate(o.createdAt)}</span>
      </div>
      {o.contact && <p className="mb-2 text-[11px] text-muted-foreground">تماس: {o.contact}</p>}
      <div className="grid gap-2 sm:grid-cols-5">
        <select className={inputCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as OrgStatus })} aria-label="وضعیت">
          <option value="pending">در انتظار</option><option value="active">فعال</option><option value="suspended">معلق</option>
        </select>
        <select className={inputCls} value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value as OrgPlan })} aria-label="طرح">
          {ORG_PLANS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <input className={inputCls} type="number" min={1} max={2000} dir="ltr" value={f.seats} onChange={(e) => setF({ ...f, seats: Number(e.target.value) })} aria-label="ظرفیت اساتید" title="ظرفیت اساتید" />
        <input className={inputCls} type="date" dir="ltr" value={f.expires} onChange={(e) => setF({ ...f, expires: e.target.value })} aria-label="پایان اعتبار" title="پایان اعتبار (خالی = بدون انقضا)" />
        <button className={btnPrimary} disabled={busy} onClick={() => void save()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "ذخیره"}</button>
      </div>
      <input className={`${inputCls} mt-2`} value={f.note} maxLength={600} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="یادداشت مدیر (مثلاً شمارهٔ فاکتور)" />
      {msg && <p className="mt-1.5 text-[11px] text-muted-foreground">{msg}</p>}
    </div>
  );
}

function AdminOrgs() {
  const [rows, setRows] = React.useState<(Org & { creator: MiniUser })[] | null>(null);
  const [err, setErr] = React.useState("");
  const load = React.useCallback(() => {
    adminOrgs().then(setRows).catch((e) => { setRows([]); setErr(orgError(e)); });
  }, []);
  React.useEffect(load, [load]);
  return (
    <div>
      <h3 className="mb-2 text-[13px] font-extrabold text-bronze">پنل‌های سازمانی</h3>
      <ErrLine msg={err} />
      {rows === null ? <Loader2 className="h-4 w-4 animate-spin text-bronze" /> : rows.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">هنوز درخواستی ثبت نشده.</p>
      ) : (
        <div className="space-y-2">{rows.map((o) => <AdminOrgRow key={o.id} o={o} onSaved={load} />)}</div>
      )}
    </div>
  );
}

function AdminRoleTool() {
  const [uname, setUname] = React.useState("");
  const [found, setFound] = React.useState<MiniUser | null>(null);
  const [msg, setMsg] = React.useState("");
  async function look() {
    setMsg("");
    try { const u = await findUser(uname); setFound(u); if (!u) setMsg("کاربری با این نام کاربری نیست."); } catch (e) { setMsg(orgError(e)); }
  }
  async function setRole(role: "user" | "teacher" | "admin") {
    if (!found) return;
    try { await adminSetRole(found.id, role); setFound({ ...found, role }); setMsg("نقش به‌روز شد."); } catch (e) { setMsg(orgError(e)); }
  }
  return (
    <div>
      <h3 className="mb-2 text-[13px] font-extrabold text-bronze">تغییر نقش کاربر</h3>
      <div className="flex flex-wrap gap-2">
        <input className={`${inputCls} max-w-xs`} dir="ltr" value={uname} onChange={(e) => setUname(e.target.value)} placeholder="username" />
        <button className={btnGhost} onClick={() => void look()}><Search className="h-4 w-4" /> پیدا کن</button>
      </div>
      {found && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-border p-3">
          <UserAvatar src={found.avatarUrl} name={found.displayName} size="xs" />
          <span className="text-[13px] font-bold">{found.displayName}</span>
          <span className="text-[11px] text-muted-foreground">نقش فعلی: {found.role}</span>
          <span className="ms-auto flex gap-1.5">
            {(["user", "teacher", "admin"] as const).map((r) => (
              <button key={r} className={found.role === r ? btnPrimary : btnGhost} onClick={() => void setRole(r)}>{r === "user" ? "کاربر" : r === "teacher" ? "استاد" : "مدیر"}</button>
            ))}
          </span>
        </div>
      )}
      {msg && <p className="mt-1.5 text-[11px] text-muted-foreground">{msg}</p>}
    </div>
  );
}

/* === صفحهٔ سازمان === */
type OrgTab = "teachers" | "content" | "manage" | "settings";

function OrgPage({ idOrSlug }: { idOrSlug: string }) {
  const auth = useAuth();
  const signed = useCloudSignedIn();
  const [org, setOrg] = React.useState<Org | null | undefined>(undefined);
  const [members, setMembers] = React.useState<OrgMember[]>([]);
  const [tab, setTab] = React.useState<OrgTab>("teachers");
  const [err, setErr] = React.useState("");

  const load = React.useCallback(async () => {
    try {
      const o = await getOrg(idOrSlug);
      setOrg(o);
      if (o) setMembers(await orgMembers(o.id).catch(() => []));
    } catch (e) {
      setErr(orgError(e));
      setOrg(null);
    }
  }, [idOrSlug]);
  React.useEffect(() => { void load(); }, [load, auth.user?.id]);

  const me = auth.user ? members.find((m) => m.userId === auth.user!.id) : undefined;
  const canManage = signed && (auth.user?.role === "admin" || (!!me && me.status === "active" && (me.role === "owner" || me.role === "manager")));
  const isOwner = signed && (auth.user?.role === "admin" || (!!me && me.status === "active" && me.role === "owner"));

  if (org === undefined) {
    return <div className="flex justify-center py-24 text-bronze"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!org) {
    return (
      <div className="mx-auto max-w-md pt-20 text-center">
        <p className="rounded-2xl border border-dashed border-border bg-card p-8 text-sm text-muted-foreground shadow-card">{err || "این سازمان پیدا نشد یا هنوز فعال نشده است."}</p>
        <button onClick={() => navigate({ view: "org" })} className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-bronze hover:underline">همهٔ سازمان‌ها <ArrowLeft className="h-4 w-4" /></button>
      </div>
    );
  }

  const active = members.filter((m) => m.status === "active");
  const tabs: { key: OrgTab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "teachers", label: `اساتید (${fa(active.length)})`, Icon: Users },
    { key: "content", label: "دوره‌ها و مطالب", Icon: Newspaper },
    ...(canManage ? [
      { key: "manage" as OrgTab, label: "مدیریت اساتید", Icon: UserPlus },
      { key: "settings" as OrgTab, label: "تنظیمات پنل", Icon: Settings2 },
    ] : []),
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-28 pt-6 sm:px-6">
      <button onClick={() => navigate({ view: "org" })} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-bronze">
        <ArrowLeft className="h-3.5 w-3.5 rotate-180" /> دانشگاه‌ها و موسسه‌ها
      </button>

      <header className={`${card} relative overflow-hidden p-6 sm:p-8`}>
        <div aria-hidden className="pointer-events-none absolute -end-10 -top-10 h-40 w-40 rotate-45 rounded-[40px] bg-gradient-to-bl from-bronze/10 to-transparent" />
        <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <OrgLogo org={org} size={76} />
          <div className="min-w-0 flex-1 space-y-1.5">
            <h1 className="text-2xl font-extrabold tracking-tight">{org.name}</h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{orgKindLabel(org.kind)}</span>
              {org.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{org.city}</span>}
              {org.website && /^https?:\/\//i.test(org.website) && (
                <a href={org.website} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 hover:text-bronze"><Globe className="h-3.5 w-3.5" />وب‌سایت</a>
              )}
            </p>
            {org.description && <p className="max-w-2xl pt-1 text-sm leading-relaxed text-muted-foreground">{org.description}</p>}
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
            <StatusPill org={org} />
            <JoinButton org={org} me={me} onChanged={() => void load()} />
          </div>
        </div>
        {canManage && (
          <div className="relative mt-5 flex flex-wrap gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 font-semibold"><Crown className="h-3.5 w-3.5 text-bronze" />طرح {ORG_PLANS.find((p) => p.key === org.plan)?.label}</span>
            <SeatsChip org={org} members={members} />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 font-semibold"><CalendarClock className="h-3.5 w-3.5 text-bronze" />{org.expiresAt ? `اعتبار تا ${faDate(org.expiresAt)}` : "بدون تاریخ انقضا"}</span>
          </div>
        )}
        {canManage && !isOrgLive(org) && (
          <p className="relative mt-4 rounded-xl bg-amber-400/15 px-4 py-2.5 text-[12px] leading-relaxed text-amber-800 dark:text-amber-300">
            {org.status === "pending" ? "پنل در انتظار فعال‌سازی است — بعد از هماهنگی با پشتیبانی Lexa فعال می‌شود و تا آن زمان دعوت استاد ممکن نیست." : "پنل فعال نیست (معلق یا منقضی). برای تمدید با پشتیبانی Lexa تماس بگیر."}
            {org.adminNote ? ` یادداشت Lexa: ${org.adminNote}` : ""}
          </p>
        )}
      </header>

      <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="بخش‌های سازمان">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} aria-pressed={tab === t.key}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold transition-all ${
              tab === t.key ? "border-bronze bg-gradient-to-l from-bronze/[0.14] to-transparent text-bronze shadow-card" : "border-border bg-card text-muted-foreground hover:border-bronze/40 hover:text-foreground"}`}>
            <t.Icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </nav>

      {tab === "teachers" && <OrgTeachersTab members={active} />}
      {tab === "content" && <OrgContentTab org={org} canManage={canManage} />}
      {tab === "manage" && canManage && <OrgManageTab org={org} members={members} isOwner={isOwner} onChanged={() => void load()} />}
      {tab === "settings" && canManage && <OrgSettingsTab org={org} onSaved={(o) => setOrg(o)} />}
    </div>
  );
}

function SeatsChip({ org, members }: { org: Org; members: OrgMember[] }) {
  const [used, setUsed] = React.useState<number | null>(null);
  React.useEffect(() => { seatsUsed(org.id).then(setUsed).catch(() => setUsed(null)); }, [org.id, members.length]);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 font-semibold">
      <Users className="h-3.5 w-3.5 text-bronze" />ظرفیت اساتید {used === null ? "…" : fa(used)} از {fa(org.seats)}
    </span>
  );
}

function JoinButton({ org, me, onChanged }: { org: Org; me?: OrgMember; onChanged: () => void }) {
  const auth = useAuth();
  const signed = useCloudSignedIn();
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  if (!isOrgLive(org)) return null;
  if (me?.status === "active") return <span className="rounded-full bg-success/10 px-3 py-1 text-[11px] font-bold text-success">{ROLE_LABEL[me.role]}{me.title ? ` · ${me.title}` : ""}</span>;
  if (me?.status === "requested") return <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-[11px] font-bold text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> درخواست عضویت در انتظار</span>;
  if (me?.status === "invited") {
    return <button className={btnPrimary} onClick={() => navigate({ view: "org" })}><Mail className="h-4 w-4" /> دعوت داری — پاسخ بده</button>;
  }
  if (!signed || (auth.user?.role !== "teacher" && auth.user?.role !== "admin")) return null;
  async function ask() {
    const m = window.prompt("پیام کوتاه برای مدیر پنل (دلخواه):") ?? null;
    if (m === null) return;
    setBusy(true); setMsg("");
    try { await requestJoinOrg(org.id, m); onChanged(); } catch (e) { setMsg(orgError(e)); } finally { setBusy(false); }
  }
  return (
    <span className="flex flex-col items-end gap-1">
      <button className={btnGhost} disabled={busy} onClick={() => void ask()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} درخواست عضویت به‌عنوان استاد</button>
      {msg && <span className="text-[10.5px] text-destructive">{msg}</span>}
    </span>
  );
}

function OrgTeachersTab({ members }: { members: OrgMember[] }) {
  const list = [...members].sort((a, b) => (a.role === "teacher" ? 1 : 0) - (b.role === "teacher" ? 1 : 0));
  if (!list.length) {
    return <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground shadow-card">هنوز استادی در این پنل عضو نشده است.</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((m) => {
        const isT = m.user.role === "teacher" || m.user.role === "admin";
        return (
          <button key={m.userId} disabled={!isT} onClick={() => isT && navigate({ view: "teacher", id: m.userId })}
            className={`${card} flex items-center gap-3 p-4 text-start transition-colors ${isT ? "hover:border-bronze/50" : "cursor-default"}`}>
            <UserAvatar src={m.user.avatarUrl} name={m.user.displayName} size="xs" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-bold">{m.user.displayName}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{m.title || ROLE_LABEL[m.role]}</span>
            </span>
            {m.role !== "teacher" && <span className="shrink-0 rounded-full bg-bronze/10 px-2 py-0.5 text-[9.5px] font-bold text-bronze">{ROLE_LABEL[m.role]}</span>}
          </button>
        );
      })}
    </div>
  );
}

function OrgContentTab({ org, canManage }: { org: Org; canManage: boolean }) {
  const [data, setData] = React.useState<{ courses: TCourseCard[]; posts: FeedPost[] } | null>(null);
  const [err, setErr] = React.useState("");
  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/library/public?org=${encodeURIComponent(org.id)}`);
      const j = (await res.json()) as { courses?: TCourseCard[]; posts?: FeedPost[]; error?: string };
      if (!res.ok) throw new Error(j.error ?? "");
      setData({ courses: Array.isArray(j.courses) ? j.courses : [], posts: Array.isArray(j.posts) ? j.posts : [] });
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : "دریافت محتوا ناموفق بود.");
      setData({ courses: [], posts: [] });
    }
  }, [org.id]);
  React.useEffect(() => { void load(); }, [load]);
  async function unlink(kind: "post" | "tcourse", id: string) {
    if (!window.confirm("از صفحهٔ سازمان برداشته شود؟ (در صفحهٔ خود استاد می‌ماند)")) return;
    try { await unlinkFromOrg(org.id, kind, id); void load(); } catch (e) { setErr(orgError(e)); }
  }
  if (!data) return <p className="flex items-center gap-2 py-6 text-sm text-bronze"><Loader2 className="h-4 w-4 animate-spin" /> در حال دریافت…</p>;
  return (
    <div className="space-y-6">
      <ErrLine msg={err} />
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold"><GraduationCap className="h-5 w-5 text-bronze" /> دوره‌ها ({fa(data.courses.length)})</h2>
        {data.courses.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-6 text-center text-sm text-muted-foreground shadow-card">هنوز دوره‌ای به نام این سازمان منتشر نشده است.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.courses.map((c) => (
              <div key={c.id} className={`${card} flex items-center gap-3 p-4`}>
                <button onClick={() => navigate({ view: "course", id: c.id })} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-bronze/10 text-bronze"><CourseIcon icon={c.icon} /></button>
                <button onClick={() => navigate({ view: "course", id: c.id })} className="min-w-0 flex-1 text-start">
                  <span className="block truncate font-bold hover:text-bronze">{c.title}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{c.teacher.displayName} · {fa(c.lessonsCount)} جلسه · {fa(c.studentsCount)} دانشجو</span>
                </button>
                {canManage && <button className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="برداشتن از صفحهٔ سازمان" aria-label="برداشتن از صفحهٔ سازمان" onClick={() => void unlink("tcourse", c.id)}><Trash2 className="h-4 w-4" /></button>}
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Newspaper className="h-5 w-5 text-bronze" /> مطالب ({fa(data.posts.length)})</h2>
        {data.posts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-6 text-center text-sm text-muted-foreground shadow-card">هنوز مطلبی به نام این سازمان منتشر نشده است.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.posts.map((p) => (
              <div key={p.id} className={`${card} flex items-center gap-3 p-4`}>
                <button onClick={() => navigate({ view: "post", id: p.id })} className="min-w-0 flex-1 text-start">
                  <span className="line-clamp-1 block font-display text-[14.5px] font-bold hover:text-bronze">{p.title}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{p.author.displayName} · {fa(p.commentsCount)} نظر</span>
                </button>
                {canManage && <button className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="برداشتن از صفحهٔ سازمان" aria-label="برداشتن از صفحهٔ سازمان" onClick={() => void unlink("post", p.id)}><Trash2 className="h-4 w-4" /></button>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function OrgManageTab({ org, members, isOwner, onChanged }: { org: Org; members: OrgMember[]; isOwner: boolean; onChanged: () => void }) {
  const auth = useAuth();
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<MiniUser[] | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [target, setTarget] = React.useState<MiniUser | null>(null);
  const [title, setTitle] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState("");
  const [err, setErr] = React.useState("");
  const [okMsg, setOkMsg] = React.useState("");
  const live = isOrgLive(org);

  const byStatus = (s: string) => members.filter((m) => m.status === s);
  const requested = byStatus("requested");
  const invited = byStatus("invited");
  const active = byStatus("active");

  async function search() {
    const v = q.trim();
    if (!v) return;
    setSearching(true); setErr(""); setResults(null);
    try {
      const list = await searchTeachers(v);
      // نام کاربری دقیق — برای دعوت کسی که هنوز حساب استادی ندارد
      const exact = await findUser(v).catch(() => null);
      const merged = exact && !list.some((x) => x.id === exact.id) ? [exact, ...list] : list;
      setResults(merged);
    } catch (e) {
      setErr(orgError(e));
    } finally {
      setSearching(false);
    }
  }
  async function invite() {
    if (!target) return;
    setBusy("invite"); setErr(""); setOkMsg("");
    try {
      const r = await inviteToOrg(org.id, target.id, title.trim(), note.trim());
      setOkMsg(r === "active" ? `${target.displayName} به اساتید پنل اضافه شد.` : `دعوت برای ${target.displayName} فرستاده شد؛ بعد از پذیرش او عضو می‌شود.`);
      setTarget(null); setTitle(""); setNote(""); setResults(null); setQ("");
      onChanged();
    } catch (e) {
      setErr(orgError(e));
    } finally {
      setBusy("");
    }
  }
  async function act(key: string, fn: () => Promise<unknown>) {
    setBusy(key); setErr(""); setOkMsg("");
    try { await fn(); onChanged(); } catch (e) { setErr(orgError(e)); } finally { setBusy(""); }
  }

  return (
    <div className="space-y-5">
      <ErrLine msg={err} />
      <OkLine msg={okMsg} />

      {/* دعوت استاد */}
      <section className={card}>
        <h2 className="mb-1 flex items-center gap-2 text-[14px] font-extrabold"><MailPlus className="h-4.5 w-4.5 text-bronze" /> دعوت استاد به پنل</h2>
        <p className="mb-3 text-[11.5px] leading-relaxed text-muted-foreground">نام استاد را جست‌وجو کن یا نام کاربری دقیق کسی را که هنوز حساب استادی ندارد بنویس. دعوت به پروفایلش می‌رود و با پذیرش او عضو می‌شود.</p>
        {!live && <p className="mb-3 rounded-xl bg-amber-400/15 px-4 py-2 text-[11.5px] text-amber-800 dark:text-amber-300">تا فعال شدن پنل، دعوت ممکن نیست.</p>}
        <div className="flex flex-wrap gap-2">
          <input className={`${inputCls} min-w-0 flex-1`} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void search()} placeholder="نام استاد یا @نام‌کاربری" disabled={!live} />
          <button className={btnGhost} onClick={() => void search()} disabled={!live || searching}>{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} جست‌وجو</button>
        </div>
        {results && (
          <div className="mt-3 space-y-1.5">
            {results.length === 0 && <p className="text-[12px] text-muted-foreground">کسی پیدا نشد.</p>}
            {results.map((u) => {
              const m = members.find((x) => x.userId === u.id);
              return (
                <button key={u.id} disabled={m?.status === "active"} onClick={() => setTarget(u)}
                  className={`flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-start transition-colors ${target?.id === u.id ? "border-bronze bg-bronze/[0.06]" : "border-border hover:border-bronze/50"} disabled:opacity-50`}>
                  <UserAvatar src={u.avatarUrl} name={u.displayName} size="xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold">{u.displayName}</span>
                    <span dir="ltr" className="block truncate text-start text-[10.5px] text-muted-foreground">@{u.username}</span>
                  </span>
                  <span className="shrink-0 text-[10.5px] text-muted-foreground">{m ? (m.status === "active" ? "عضو است" : m.status === "invited" ? "دعوت شده" : m.status === "requested" ? "درخواست داده" : "") : u.role === "teacher" || u.role === "admin" ? "استاد" : "هنوز استاد نیست"}</span>
                </button>
              );
            })}
          </div>
        )}
        {target && (
          <div className="mt-3 space-y-2 rounded-xl border border-bronze/40 p-3">
            <p className="text-[12.5px] font-bold">دعوت از {target.displayName}</p>
            <input className={inputCls} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="سمت در سازمان (مثلاً: استادیار گروه حقوق خصوصی)" />
            <input className={inputCls} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="پیام کوتاه همراه دعوت (دلخواه)" />
            <div className="flex gap-2">
              <button className={btnPrimary} disabled={busy === "invite"} onClick={() => void invite()}>{busy === "invite" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} ارسال دعوت</button>
              <button className={btnGhost} onClick={() => setTarget(null)}>انصراف</button>
            </div>
          </div>
        )}
      </section>

      {/* درخواست‌های عضویت */}
      {requested.length > 0 && (
        <section className={card}>
          <h2 className="mb-3 flex items-center gap-2 text-[14px] font-extrabold"><UserPlus className="h-4.5 w-4.5 text-bronze" /> درخواست‌های عضویت ({fa(requested.length)})</h2>
          <div className="space-y-2">
            {requested.map((m) => (
              <div key={m.userId} className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border p-2.5">
                <UserAvatar src={m.user.avatarUrl} name={m.user.displayName} size="xs" />
                <button onClick={() => navigate({ view: "teacher", id: m.userId })} className="min-w-0 flex-1 text-start">
                  <span className="block truncate text-[13px] font-bold hover:text-bronze">{m.user.displayName}</span>
                  {m.message && <span className="block truncate text-[11px] text-muted-foreground">«{m.message}»</span>}
                </button>
                <button className={btnPrimary} disabled={!!busy} onClick={() => void act("ok" + m.userId, () => reviewJoinRequest(org.id, m.userId, true))}><Check className="h-4 w-4" /> تأیید</button>
                <button className={btnGhost} disabled={!!busy} onClick={() => void act("no" + m.userId, () => reviewJoinRequest(org.id, m.userId, false))}><X className="h-4 w-4" /> رد</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* دعوت‌های در انتظار */}
      {invited.length > 0 && (
        <section className={card}>
          <h2 className="mb-3 flex items-center gap-2 text-[14px] font-extrabold"><Clock3 className="h-4.5 w-4.5 text-bronze" /> دعوت‌های در انتظار پاسخ ({fa(invited.length)})</h2>
          <div className="space-y-2">
            {invited.map((m) => (
              <div key={m.userId} className="flex flex-wrap items-center gap-2.5 rounded-xl border border-dashed border-border p-2.5">
                <UserAvatar src={m.user.avatarUrl} name={m.user.displayName} size="xs" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold">{m.user.displayName}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{m.title || "بدون سمت"} · {faDate(m.createdAt)}</span>
                </span>
                <button className={btnGhost} disabled={!!busy} onClick={() => void act("rm" + m.userId, () => setOrgMember(org.id, m.userId, { remove: true }))}><X className="h-4 w-4" /> لغو دعوت</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* اعضا */}
      <section className={card}>
        <h2 className="mb-3 flex items-center gap-2 text-[14px] font-extrabold"><Users className="h-4.5 w-4.5 text-bronze" /> اعضای پنل ({fa(active.length)})</h2>
        <div className="space-y-2">
          {active.map((m) => (
            <MemberRow key={m.userId} org={org} m={m} isOwner={isOwner} isMe={m.userId === auth.user?.id} busy={busy} act={act} />
          ))}
        </div>
      </section>
    </div>
  );
}

function MemberRow({ org, m, isOwner, isMe, busy, act }: {
  org: Org; m: OrgMember; isOwner: boolean; isMe: boolean; busy: string;
  act: (key: string, fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [title, setTitle] = React.useState(m.title);
  React.useEffect(() => setTitle(m.title), [m.title]);
  const owner = m.role === "owner";
  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border p-2.5">
      <UserAvatar src={m.user.avatarUrl} name={m.user.displayName} size="xs" />
      <span className="min-w-0 basis-40 flex-1">
        <span className="block truncate text-[13px] font-bold">{m.user.displayName}{isMe ? " (تو)" : ""}</span>
        <span className="block truncate text-[10.5px] text-muted-foreground">{ROLE_LABEL[m.role]}</span>
      </span>
      <input className={`${inputCls} basis-48 flex-1 py-1.5 text-[12px]`} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="سمت" aria-label="سمت" />
      {title !== m.title && (
        <button className={btnGhost} disabled={!!busy} onClick={() => void act("t" + m.userId, () => setOrgMember(org.id, m.userId, { title }))}><Check className="h-4 w-4" /> ثبت</button>
      )}
      {isOwner && !owner && (
        <button className={btnGhost} disabled={!!busy} onClick={() => void act("r" + m.userId, () => setOrgMember(org.id, m.userId, { role: m.role === "manager" ? "teacher" : "manager", title }))}>
          <ShieldCheck className="h-4 w-4" /> {m.role === "manager" ? "برداشتن مدیریت" : "مدیر پنل شود"}
        </button>
      )}
      {!owner && (
        <button className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40" disabled={!!busy}
          title={isMe ? "ترک پنل" : "حذف از پنل"} aria-label={isMe ? "ترک پنل" : "حذف از پنل"}
          onClick={() => { if (window.confirm(isMe ? "از این پنل خارج می‌شوی؟" : `«${m.user.displayName}» از پنل حذف شود؟ (دوره‌ها و مطالبش از صفحهٔ سازمان برداشته می‌شود)`)) void act("x" + m.userId, () => setOrgMember(org.id, m.userId, { remove: true })); }}>
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function OrgSettingsTab({ org, onSaved }: { org: Org; onSaved: (o: Org) => void }) {
  const [f, setF] = React.useState({ name: org.name, kind: org.kind, city: org.city, description: org.description, website: org.website, contact: org.contact, logoUrl: org.logoUrl });
  const [busy, setBusy] = React.useState(false);
  const [up, setUp] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [okMsg, setOkMsg] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);
  async function onFile(file?: File) {
    if (!file) return;
    setUp(true); setErr("");
    try { const url = await uploadOrgLogo(file); setF((x) => ({ ...x, logoUrl: url })); } catch (e) { setErr(e instanceof Error ? e.message : "آپلود ناموفق بود."); } finally { setUp(false); }
  }
  async function save() {
    setBusy(true); setErr(""); setOkMsg("");
    try {
      const o = await updateOrg(org.id, f);
      if (o) onSaved(o);
      setOkMsg("ذخیره شد.");
    } catch (e) {
      setErr(orgError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={`${card} space-y-3`}>
      <div className="flex items-center gap-3">
        <OrgLogo org={{ logoUrl: f.logoUrl, name: f.name }} size={56} />
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        <button className={btnGhost} disabled={up} onClick={() => fileRef.current?.click()}>{up ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} لوگو</button>
        {f.logoUrl && <button className={btnGhost} onClick={() => setF({ ...f, logoUrl: "" })}><X className="h-4 w-4" /> حذف لوگو</button>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={labelCls}>نام سازمان</label><input className={inputCls} value={f.name} maxLength={100} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div>
          <label className={labelCls}>نوع</label>
          <select className={inputCls} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as OrgKind })}>
            {ORG_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
        </div>
        <div><label className={labelCls}>شهر</label><input className={inputCls} value={f.city} maxLength={60} onChange={(e) => setF({ ...f, city: e.target.value })} /></div>
        <div><label className={labelCls}>وب‌سایت</label><input className={inputCls} dir="ltr" value={f.website} maxLength={200} onChange={(e) => setF({ ...f, website: e.target.value })} /></div>
        <div className="sm:col-span-2"><label className={labelCls}>راه تماس (فقط مدیران و Lexa می‌بینند)</label><input className={inputCls} value={f.contact} maxLength={160} onChange={(e) => setF({ ...f, contact: e.target.value })} /></div>
      </div>
      <div><label className={labelCls}>معرفی</label><textarea className={`${inputCls} resize-y`} rows={4} maxLength={1200} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      <p className="text-[10.5px] text-muted-foreground" dir="ltr">#/org/{org.slug}</p>
      <ErrLine msg={err} />
      <OkLine msg={okMsg} />
      <button className={btnPrimary} disabled={busy || f.name.trim().length < 2} onClick={() => void save()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} ذخیرهٔ تنظیمات</button>
    </section>
  );
}

/* === قطعه‌های قابل‌استفاده در صفحه‌های دیگر === */

/** نشان سازمان‌های یک استاد (پروفایل استاد) */
export function OrgBadges({ orgs }: { orgs?: { id: string; name: string; slug: string; logoUrl: string | null; title?: string; role?: string }[] }) {
  if (!orgs?.length) return null;
  return (
    <p className="flex flex-wrap gap-1.5 pt-1">
      {orgs.map((o) => (
        <button key={o.id} onClick={() => navigate({ view: "org", id: o.slug })}
          className="inline-flex items-center gap-1.5 rounded-full border border-bronze/40 bg-bronze/[0.06] px-2.5 py-1 text-[11px] font-bold text-bronze transition-colors hover:bg-bronze/15">
          <Building2 className="h-3.5 w-3.5" /> {o.name}{o.title ? ` · ${o.title}` : ""}
        </button>
      ))}
    </p>
  );
}

/** دکمهٔ «دعوت به سازمان» روی پروفایل استاد — فقط برای مدیران پنل‌های فعال */
export function OrgInviteButton({ userId, name }: { userId: string; name: string }) {
  const auth = useAuth();
  const { orgs } = useManagedOrgs();
  const live = orgs.filter((o) => isOrgLive(o));
  const [open, setOpen] = React.useState(false);
  const [orgId, setOrgId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  if (!live.length || auth.user?.id === userId) return null;
  async function send() {
    const target = orgId || live[0].id;
    setBusy(true); setMsg("");
    try {
      const r = await inviteToOrg(target, userId, title.trim(), "");
      setMsg(r === "active" ? "عضو پنل شد." : "دعوت فرستاده شد.");
      setOpen(false);
    } catch (e) {
      setMsg(orgError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="relative flex flex-col items-start gap-1">
      <button onClick={() => setOpen((v) => !v)} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-bronze/50 bg-bronze/10 px-4 py-2.5 text-sm font-bold text-bronze transition-colors hover:bg-bronze/20">
        <MailPlus className="h-4 w-4" /> دعوت به سازمان
      </button>
      {msg && <span className="text-[10.5px] text-muted-foreground">{msg}</span>}
      {open && (
        <span className="absolute end-0 top-full z-30 mt-2 w-72 space-y-2 rounded-2xl border border-border bg-card p-3 shadow-card">
          <span className="block text-[12px] font-bold">دعوت {name} به:</span>
          <select className={inputCls} value={orgId || live[0].id} onChange={(e) => setOrgId(e.target.value)}>
            {live.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <input className={inputCls} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="سمت (دلخواه)" />
          <span className="flex gap-2">
            <button className={btnPrimary} disabled={busy} onClick={() => void send()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} ارسال</button>
            <button className={btnGhost} onClick={() => setOpen(false)}>بستن</button>
          </span>
        </span>
      )}
    </span>
  );
}

/** انتخاب «انتشار به نام» در اتاق استاد: شخصی یا یکی از سازمان‌هایی که عضو فعالش هستم */
export function OrgPublishPicker({ value, onChange }: { value: string; onChange: (orgId: string) => void }) {
  const { orgs, loading } = usePublishOrgs();
  if (loading || (!orgs.length && !value)) return null;
  return (
    <div>
      <label className={labelCls}>انتشار به نام</label>
      <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">فقط خودم (بدون سازمان)</option>
        {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        {value && !orgs.some((o) => o.id === value) && <option value={value}>سازمان فعلی (دیگر عضو فعال نیستی)</option>}
      </select>
      <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">با انتخاب سازمان، این مورد در صفحهٔ آن سازمان هم دیده می‌شود.</p>
    </div>
  );
}

/** شمار دعوت‌های در انتظار — برای نشانِ منو */
export function useOrgInviteCount(): number {
  const { items } = useMyMemberships();
  return items.filter((m) => m.status === "invited").length;
}
