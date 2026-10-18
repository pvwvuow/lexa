"use client";
/* Centre console (phase A2 of docs/ADMIN_PLATFORM.md). The workspace of a centre's staff: centre home,
 * organisation tree, staff, roles and the permission matrix, centre audit; terms and calendar, course
 * catalogue, classes and cohorts (phase A3); plus the existing OrgView tabs passed in as sections. A
 * built-in section replaces a legacy section with the same key. Each section is shown only to people whose permissions allow it; the
 * server checks every call again. */
import * as React from "react";
import {
  Activity, BookOpen, Building2, CalendarDays, ClipboardList, KeyRound, LayoutDashboard, Network, GraduationCap, ShieldCheck, UsersRound,
} from "lucide-react";
import { MfaPanel } from "@/components/app/MfaPanel";
import {
  BASE_ROLE_LABEL, makeAccess, orgConsoleError, orgMyAccess, type Access, type PermKey,
} from "@/lib/cloud-api/org-console";
import { Notice, Panel, useLoad, type IconType, type NavGroup } from "./ConsoleKit";
import { CentreWorkspace, type CentreIdentity } from "./CentreWorkspace";
import { CentreHomePage } from "./CentreHomePage";
import { OrgStructurePage } from "./OrgStructurePage";
import { OrgStaffPage } from "./OrgStaffPage";
import { OrgRolesPage } from "./OrgRolesPage";
import { OrgAuditPage } from "./OrgAuditPage";
import { OrgTermsPage } from "./OrgTermsPage";
import { OrgCoursesPage } from "./OrgCoursesPage";
import { OrgClassesPage } from "./OrgClassesPage";
import { OrgCohortsPage } from "./OrgCohortsPage";

export type LegacyGroup = "people" | "teaching" | "insight" | "connect" | "settings";
/** an existing OrgView tab shown as a console section; recommended keys: students, classes, exams,
 * teachers, reports, compare, api, connector, profile, settings */
export interface LegacySection {
  key: string; label: string; icon: IconType; group: LegacyGroup; badge?: number | null;
  render: () => React.ReactNode;
}
const LEGACY_GROUP_LABEL: Record<LegacyGroup, string> = {
  people: "دانشجویان و اعضا", teaching: "آموزش", insight: "گزارش‌ها", connect: "اتصال‌ها", settings: "تنظیمات",
};
const ORDER: LegacyGroup[] = ["people", "teaching", "insight", "connect", "settings"];

const TEACH_NAV: { key: string; label: string; icon: IconType; perms: PermKey[] }[] = [
  { key: "terms", label: "ترم‌ها و تقویم", icon: CalendarDays, perms: ["org.terms.manage", "org.classes.manage", "org.enroll.manage"] },
  { key: "courses", label: "درس‌ها", icon: BookOpen, perms: ["org.classes.manage", "org.enroll.manage", "org.terms.manage"] },
  { key: "classes", label: "کلاس‌ها و ثبت‌نام", icon: ClipboardList, perms: ["org.classes.manage", "org.enroll.manage"] },
  { key: "cohorts", label: "گروه‌های ورودی", icon: GraduationCap, perms: ["org.students.manage", "org.enroll.manage"] },
];
const TEACH_PAGES: Record<string, React.ComponentType<CentrePageProps> | undefined> = {
  terms: OrgTermsPage, courses: OrgCoursesPage, classes: OrgClassesPage, cohorts: OrgCohortsPage,
};

export interface CentreNav { go: (section: string) => void; has: (section: string) => boolean }
export interface CentrePageProps { orgId: string; access: Access; nav: CentreNav }

export function CentreConsole({ orgId, centre, capacity, legacy = [], initialSection, onSectionChange, actions }: {
  orgId: string;
  centre: CentreIdentity;
  capacity?: { students: number; studentSeats: number; teachers: number; teacherSeats: number } | null;
  legacy?: LegacySection[];
  initialSection?: string;
  onSectionChange?: (key: string) => void;
  actions?: React.ReactNode;
}) {
  const acc = useLoad(() => orgMyAccess(orgId), [orgId]);
  const access = React.useMemo(() => (acc.data ? makeAccess(acc.data) : null), [acc.data]);
  const storeKey = `lexa-centre-section:${orgId}`;
  const [section, setSection] = React.useState<string>(() => {
    if (initialSection) return initialSection;
    try { return window.localStorage.getItem(storeKey) || ""; } catch { return ""; }
  });

  /** built-in teaching sections this person may open (they replace legacy sections with the same key) */
  const teachKeys = React.useMemo(() => {
    const out = new Set<string>();
    const a = access;
    if (!a) return out;
    for (const t of TEACH_NAV) if (t.perms.some((x) => a.canSomewhere(x))) out.add(t.key);
    return out;
  }, [access]);

  const groups: NavGroup[] = React.useMemo(() => {
    const out: NavGroup[] = [];
    const a = access;
    const overview = [] as NavGroup["items"];
    if (a?.canSomewhere("org.reports.read")) overview.push({ key: "home", label: "خانه‌ی مرکز", icon: LayoutDashboard });
    if (a?.can("org.audit.read")) overview.push({ key: "audit", label: "فعالیت و ممیزی", icon: Activity });
    if (overview.length) out.push({ label: "نمای کلی", items: overview });
    const org = [] as NavGroup["items"];
    if (a) org.push({ key: "structure", label: "ساختار سازمانی", icon: Network });
    if (a && (a.canSomewhere("org.members.manage") || a.canSomewhere("org.roles.manage"))) {
      org.push({ key: "staff", label: "استادها و کارکنان", icon: UsersRound });
      org.push({ key: "roles", label: "نقش‌ها و دسترسی", icon: ShieldCheck });
    }
    if (org.length) out.push({ label: "سازمان", items: org });
    const teach = TEACH_NAV.filter((t) => teachKeys.has(t.key));
    const builtIn = teachKeys;
    for (const g of ORDER) {
      const items: NavGroup["items"] = legacy.filter((l) => l.group === g && !builtIn.has(l.key))
        .map((l) => ({ key: l.key, label: l.label, icon: l.icon, badge: l.badge }));
      if (g === "teaching") items.unshift(...teach.map(({ key, label, icon }) => ({ key, label, icon })));
      if (items.length) out.push({ label: LEGACY_GROUP_LABEL[g], items });
    }
    out.push({ label: "حساب من", items: [{ key: "security", label: "امنیت من", icon: KeyRound }] });
    return out;
  }, [access, legacy, teachKeys]);

  const keys = React.useMemo(() => new Set(groups.flatMap((g) => g.items.map((i) => i.key))), [groups]);
  const active = keys.has(section) ? section : (groups[0]?.items[0]?.key ?? "security");
  const go = React.useCallback((k: string) => {
    if (!keys.has(k)) return;
    setSection(k);
    try { window.localStorage.setItem(storeKey, k); } catch { /* private mode */ }
    onSectionChange?.(k);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [keys, storeKey, onSectionChange]);
  const nav: CentreNav = React.useMemo(() => ({ go, has: (k: string) => keys.has(k) }), [go, keys]);

  const roleLabel = React.useMemo(() => {
    const r = acc.data;
    if (!r) return "…";
    const base = r.platform_admin && !r.base_role ? "مدیر Lexa" : r.base_role ? BASE_ROLE_LABEL[r.base_role] : "";
    const extra = [...new Set(r.grants.map((g) => g.role))];
    return [base, ...extra.slice(0, 2)].filter(Boolean).join(" · ") + (extra.length > 2 ? ` · +${(extra.length - 2).toLocaleString("fa-IR")}` : "");
  }, [acc.data]);

  let body: React.ReactNode;
  if (acc.error) {
    body = <Notice tone="bad" title="دسترسی خوانده نشد">{orgConsoleError(acc.error)}</Notice>;
  } else if (!access) {
    body = <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-muted/60" />)}</div>;
  } else {
    const p: CentrePageProps = { orgId, access, nav };
    const leg = teachKeys.has(active) ? undefined : legacy.find((l) => l.key === active);
    const teachPage = TEACH_PAGES[active];
    body = teachPage && teachKeys.has(active) ? React.createElement(teachPage, p)
      : leg ? leg.render()
      : active === "home" ? <CentreHomePage {...p} />
      : active === "structure" ? <OrgStructurePage {...p} />
      : active === "staff" ? <OrgStaffPage {...p} />
      : active === "roles" ? <OrgRolesPage {...p} />
      : active === "audit" ? <OrgAuditPage {...p} />
      : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="ورود دومرحله‌ای" icon={KeyRound} description="مالک، مدیران و کارکنان مرکز برای دیدن داده‌ی دانشجو و هر تغییر به آن نیاز دارند.">
            <MfaPanel />
          </Panel>
          <Panel title="دسترسی‌های شما در این مرکز" icon={Building2}>
            <MyAccessSummary access={access} />
          </Panel>
        </div>
      );
  }

  return (
    <CentreWorkspace centre={centre} roleLabel={roleLabel} groups={groups} active={active} onSelect={go} capacity={capacity} actions={actions}>
      {body}
    </CentreWorkspace>
  );
}

function MyAccessSummary({ access }: { access: Access }) {
  const a = access.raw;
  return (
    <div className="space-y-3 text-[12.5px]">
      <p>نقش پایه: <b>{a.base_role ? BASE_ROLE_LABEL[a.base_role] : a.platform_admin ? "مدیر Lexa" : "—"}</b>
        {" · "}{a.mfa ? "نشست دومرحله‌ای" : "نشست یک‌مرحله‌ای"}</p>
      {a.grants.length ? (
        <ul className="space-y-1.5">
          {a.grants.map((g, i) => (
            <li key={i} className="rounded-lg border border-border px-3 py-2">
              <b>{g.role}</b> <span className="text-muted-foreground">· {g.unit ?? "کل مرکز"}</span>
              {g.expires_at && <span className="text-muted-foreground"> · تا {new Date(g.expires_at).toLocaleDateString("fa-IR")}</span>}
            </li>
          ))}
        </ul>
      ) : <p className="text-muted-foreground">نقش افزوده‌ای ندارید.</p>}
      <p className="text-[11.5px] text-muted-foreground">{access.raw.perms.length.toLocaleString("fa-IR")} دسترسی در کل مرکز
        {access.raw.perms_any.length > access.raw.perms.length && ` و ${(access.raw.perms_any.length - access.raw.perms.length).toLocaleString("fa-IR")} دسترسی در بخشی از درخت`}.</p>
    </div>
  );
}
