"use client";
/* Centre panel layout (A1 look, full centre console in A2 of docs/ADMIN_PLATFORM.md). Replaces the
 * row of tabs on a centre page for its staff with a proper workspace: an identity header (logo,
 * status, plan, validity, capacity) and a grouped section menu beside the content. OrgView keeps
 * its existing tab contents; it only passes them in as sections. */
import * as React from "react";
import { Building2, CalendarClock } from "lucide-react";
import { Badge, cx, Meter, type NavGroup, type Tone } from "./ConsoleKit";

export interface CentreIdentity {
  name: string;
  slug: string;
  logoUrl?: string;
  kindLabel?: string;
  city?: string;
  status: string;
  planLabel?: string;
  expiresAt?: string | null;
}

function statusOf(c: CentreIdentity): { label: string; tone: Tone } {
  if (c.status === "active" && c.expiresAt && new Date(c.expiresAt).getTime() <= Date.now()) return { label: "اعتبار تمام‌شده", tone: "warn" };
  if (c.status === "active") return { label: "فعال", tone: "ok" };
  if (c.status === "pending") return { label: "در انتظار تأیید Lexa", tone: "info" };
  if (c.status === "suspended") return { label: "معلق", tone: "bad" };
  return { label: "بایگانی", tone: "muted" };
}

export function CentreWorkspace({ centre, roleLabel, groups, active, onSelect, capacity, actions, children }: {
  centre: CentreIdentity;
  /** e.g. «مالک» / «مدیر پنل» / «مدرس» */
  roleLabel: string;
  groups: NavGroup[];
  active: string;
  onSelect: (key: string) => void;
  capacity?: { students: number; studentSeats: number; teachers: number; teacherSeats: number } | null;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const st = statusOf(centre);
  const items = groups.flatMap((g) => g.items);
  const current = items.find((i) => i.key === active);
  return (
    <div dir="rtl" className="mx-auto w-full max-w-7xl px-4 pb-10 pt-2 sm:px-6">
      <header className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-bronze/80 via-primary/70 to-bronze/80" />
        <div className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
          {centre.logoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={centre.logoUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl border border-border object-cover" />
            : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Building2 className="h-6 w-6" /></span>}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-display text-xl font-extrabold tracking-tight">{centre.name}</h1>
              <Badge tone={st.tone} dot>{st.label}</Badge>
              {centre.planLabel && <Badge tone="brand">{centre.planLabel}</Badge>}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
              <span>{roleLabel}</span>
              {centre.kindLabel && <><span aria-hidden>·</span><span>{centre.kindLabel}</span></>}
              {centre.city && <><span aria-hidden>·</span><span>{centre.city}</span></>}
              <span aria-hidden>·</span><span dir="ltr">{centre.slug}</span>
              {centre.expiresAt && (
                <><span aria-hidden>·</span><span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />
                  اعتبار تا {new Date(centre.expiresAt).toLocaleDateString("fa-IR", { year: "numeric", month: "short", day: "numeric" })}</span></>
              )}
            </p>
          </div>
          {capacity && (
            <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2">
              <div className="min-w-[150px]"><p className="mb-1 text-[11px] font-semibold text-muted-foreground">حساب دانشجویی</p><Meter used={capacity.students} cap={capacity.studentSeats} /></div>
              <div className="min-w-[150px]"><p className="mb-1 text-[11px] font-semibold text-muted-foreground">صندلی مدرس</p><Meter used={capacity.teachers} cap={capacity.teacherSeats} /></div>
            </div>
          )}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      </header>

      {/* small screens: one scrollable row of sections */}
      <nav aria-label="بخش‌های پنل مرکز" className="-mx-1 mt-4 flex gap-1 overflow-x-auto px-1 pb-1 lg:hidden">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button key={it.key} type="button" onClick={() => onSelect(it.key)} aria-current={it.key === active ? "page" : undefined}
              className={cx("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-semibold",
                it.key === active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground")}>
              <Icon className="h-4 w-4" />{it.label}{!!it.badge && <span className="tabular-nums">({it.badge.toLocaleString("fa-IR")})</span>}
            </button>
          );
        })}
      </nav>

      <div className="mt-4 grid gap-5 lg:mt-5 lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <nav aria-label="بخش‌های پنل مرکز" className="sticky top-24 space-y-4 rounded-xl border border-border bg-card p-2.5 shadow-sm">
            {groups.map((g) => (
              <div key={g.label}>
                <p className="px-2.5 pb-1 text-[10.5px] font-bold text-muted-foreground/70">{g.label}</p>
                {g.items.map((it) => {
                  const on = it.key === active;
                  const Icon = it.icon;
                  return (
                    <button key={it.key} type="button" onClick={() => onSelect(it.key)} aria-current={on ? "page" : undefined}
                      className={cx("relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                        on ? "bg-primary/[0.08] font-bold text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                      {on && <span aria-hidden className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-bronze" />}
                      <Icon className={cx("h-4 w-4 shrink-0", on && "text-bronze")} />
                      <span className="min-w-0 flex-1 truncate text-start">{it.label}</span>
                      {!!it.badge && <span className="rounded-full bg-muted px-1.5 text-[10.5px] font-bold tabular-nums">{it.badge.toLocaleString("fa-IR")}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>
        <section className="min-w-0">
          {current && <h2 className="mb-4 font-display text-lg font-extrabold">{current.label}</h2>}
          {children}
        </section>
      </div>
    </div>
  );
}
