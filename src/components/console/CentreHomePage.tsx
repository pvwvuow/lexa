"use client";
/* Centre home (phase A2 of docs/ADMIN_PLATFORM.md): KPIs against capacity, "to do" list with a jump to
 * the right section, 30-day study trend, breakdown by the units of the tree and recent activity.
 * A branch or department head sees the same page limited to their part of the tree. */
import * as React from "react";
import {
  AlarmClock, BookOpenCheck, CalendarClock, ClipboardList, Clock3, FileQuestion, GraduationCap, Network,
  ShieldAlert, UserPlus, Users, UsersRound,
} from "lucide-react";
import { faAgo, faDate, faHours, faNum } from "@/lib/cloud-api/admin-console";
import {
  orgActionLabel, orgConsoleError, orgHome, unitIndex, UNIT_KIND_LABEL,
  type OrgBreakdownRow, type OrgTodo, type TodoKind,
} from "@/lib/cloud-api/org-console";
import {
  Badge, Btn, DataTable, EmptyState, Kpi, Meter, Notice, Panel, RefreshBtn, TrendChart, useLoad, type IconType, type Tone,
} from "./ConsoleKit";
import { MfaGate, SectionIntro, UnitSelect, useUnits } from "./CentreBits";
import type { CentrePageProps } from "./CentreConsole";

const TODO: Record<TodoKind, { icon: IconType; tone: Tone; title: (t: OrgTodo) => string; text: string; go?: string; cta?: string }> = {
  classes_no_teacher: { icon: Users, tone: "bad", title: (t) => `${faNum(t.count)} کلاس بدون استاد`, text: "برای این کلاس‌ها هنوز استادی تعیین نشده است.", go: "classes", cta: "تعیین استاد" },
  classes_no_students: { icon: GraduationCap, tone: "warn", title: (t) => `${faNum(t.count)} کلاس بدون دانشجو`, text: "هیچ دانشجویی در این کلاس‌ها ثبت‌نام نشده است.", go: "classes", cta: "ثبت‌نام" },
  classes_no_content: { icon: BookOpenCheck, tone: "warn", title: (t) => `${faNum(t.count)} کلاس بدون محتوا`, text: "هنوز هیچ درس یا نوشته‌ای به این کلاس‌ها وصل نشده است.", go: "classes", cta: "دیدن کلاس‌ها" },
  exams_no_questions: { icon: FileQuestion, tone: "bad", title: (t) => `${faNum(t.count)} آزمون نزدیک بدون سؤال`, text: "آزمون‌هایی که تا هفت روز دیگر شروع می‌شوند و هنوز سؤالی ندارند.", go: "exams", cta: "دیدن آزمون‌ها" },
  students_not_activated: { icon: UserPlus, tone: "info", title: (t) => `${faNum(t.count)} دانشجوی فعال‌نشده`, text: "حساب ساخته شده ولی دانشجو هنوز وارد نشده یا شرایط مرکز را نپذیرفته است.", go: "students", cta: "دیدن دانشجوها" },
  term_ending: { icon: CalendarClock, tone: "info", title: () => "پایان ترم نزدیک است", text: "ترم جاری تا دو هفته‌ی دیگر تمام می‌شود؛ نمره‌ها و ترم بعد را آماده کنید.", go: "classes", cta: "ترم‌ها" },
  invites_stale: { icon: AlarmClock, tone: "warn", title: (t) => `${faNum(t.count)} دعوت بی‌پاسخ`, text: "بیش از یک هفته از این دعوت‌ها گذشته است.", go: "staff", cta: "پیگیری" },
  join_requests: { icon: UsersRound, tone: "info", title: (t) => `${faNum(t.count)} درخواست عضویت`, text: "استادهایی که خواسته‌اند به مرکز بپیوندند.", go: "teachers", cta: "بررسی" },
  staff_no_mfa: { icon: ShieldAlert, tone: "bad", title: (t) => `${faNum(t.count)} مدیر یا کارمند بدون ورود دومرحله‌ای`, text: "این افراد تا ورود دومرحله‌ای را فعال نکنند، به داده‌ی دانشجو دسترسی ندارند.", go: "staff", cta: "دیدن افراد" },
  student_seats: { icon: Users, tone: "warn", title: (t) => `ظرفیت دانشجو ${faNum(t.count)} از ${faNum(t.cap)}`, text: "ظرفیت حساب دانشجویی رو به اتمام است؛ برای افزایش با Lexa تماس بگیرید." },
  teacher_seats: { icon: Users, tone: "warn", title: (t) => `صندلی مدرس ${faNum(t.count)} از ${faNum(t.cap)}`, text: "صندلی مدرس رو به اتمام است؛ برای افزایش با Lexa تماس بگیرید." },
  org_expiring: { icon: CalendarClock, tone: "bad", title: (t) => `اعتبار پنل تا ${faDate(t.at)}`, text: "برای تمدید پیش از پایان اعتبار با Lexa تماس بگیرید." },
};
const TONE_ORDER: Record<Tone, number> = { bad: 0, warn: 1, info: 2, brand: 3, ok: 4, muted: 5 };

export function CentreHomePage(p: CentrePageProps) {
  return (
    <MfaGate why="خانه‌ی مرکز آمار دانشجوها را نشان می‌دهد و فقط از نشست دومرحله‌ای باز می‌شود.">
      <HomeInner {...p} />
    </MfaGate>
  );
}

function HomeInner({ orgId, access, nav }: CentrePageProps) {
  const units = useUnits(orgId);
  const wide = access.can("org.reports.read");
  const allowed = React.useMemo(() => {
    if (wide || !units.data) return undefined;
    const ix = unitIndex(units.data);
    return new Set(access.unitsFor("org.reports.read").flatMap((u) => ix.subtree(u.id)));
  }, [wide, units.data, access]);
  const [scope, setScope] = React.useState<string | null>(() => (wide ? null : access.unitsFor("org.reports.read")[0]?.id ?? null));
  const h = useLoad(() => orgHome(orgId, scope), [orgId, scope]);
  const d = h.data;
  const k = d?.kpis;
  const todo = React.useMemo(() => [...(d?.todo ?? [])].sort((a, b) => TONE_ORDER[TODO[a.kind]?.tone ?? "info"] - TONE_ORDER[TODO[b.kind]?.tone ?? "info"]), [d]);
  const labels = (d?.series ?? []).map((x) => new Date(x.day).toLocaleDateString("fa-IR", { month: "short", day: "numeric" }));
  const delta = k && k.seconds_prev_7d > 0 ? Math.round(((k.seconds_7d - k.seconds_prev_7d) / k.seconds_prev_7d) * 100) : null;

  return (
    <>
      <SectionIntro
        text={d?.scope ? <>نمای <b>{d.scope.path.join(" ‹ ")}</b> و همه‌ی زیرمجموعه‌هایش.</> : "وضعیت امروز مرکز: ظرفیت، آموزش، مطالعه و کارهای مانده."}
        meta={d && <>به‌روز تا {faAgo(d.generated_at)}</>}
        actions={<>
          {units.data && units.data.length > 0 && (
            <UnitSelect units={units.data} value={scope} onChange={setScope} label="دامنه‌ی گزارش" allowCentre={wide}
              centreLabel="کل مرکز" only={allowed} />
          )}
          <RefreshBtn onClick={() => void h.reload()} busy={h.busy} at={h.at} />
        </>} />

      {h.error && <div className="mb-4"><Notice tone="bad" title="خانه‌ی مرکز خوانده نشد">{orgConsoleError(h.error)}</Notice></div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="دانشجوی فعال" icon={GraduationCap} value={k ? faNum(k.students) : "…"}
          hint={k && (d?.centre_wide ? <Meter used={k.students_used} cap={k.student_seats} /> : `${faNum(k.students_pending)} فعال‌نشده`)}
          onClick={nav.has("students") ? () => nav.go("students") : undefined} />
        <Kpi label="مدرس" icon={Users} value={k ? faNum(k.teachers) : "…"}
          hint={k && (d?.centre_wide ? <Meter used={k.teachers_used} cap={k.teacher_seats} /> : "مدرس کلاس‌های این بخش")}
          onClick={nav.has("teachers") ? () => nav.go("teachers") : undefined} />
        <Kpi label="کلاس‌های ترم جاری" icon={ClipboardList} tone="info" value={k ? faNum(k.classes_current) : "…"}
          hint={k && `${faNum(k.classes)} کلاس فعال در همه‌ی ترم‌ها`} onClick={nav.has("classes") ? () => nav.go("classes") : undefined} />
        <Kpi label="کارکنان و مدیران" icon={UsersRound} tone="muted" value={k ? faNum(k.staff) : "…"}
          hint={k && (k.invites_pending ? `${faNum(k.invites_pending)} دعوت در انتظار` : "بدون دعوت معلق")}
          onClick={nav.has("staff") ? () => nav.go("staff") : undefined} />
        <Kpi label="مطالعه‌ی ۷ روز (ساعت)" icon={Clock3} tone="ok" value={k ? faHours(k.seconds_7d) : "…"}
          spark={d?.series.map((x) => x.seconds)}
          hint={delta === null ? "هفته‌ی قبل داده‌ای نبود" : <span className={delta >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}>
            {delta >= 0 ? "▲" : "▼"} {faNum(Math.abs(delta))}٪ نسبت به هفته‌ی قبل</span>} />
        <Kpi label="دانشجوی فعال در ۷ روز" icon={Users} tone="ok" value={k ? faNum(k.learners_7d) : "…"}
          hint={k && k.students > 0 ? `${faNum(Math.round((k.learners_7d / k.students) * 100))}٪ دانشجوهای فعال` : undefined} />
        <Kpi label="آزمون" icon={FileQuestion} tone="info" value={k ? faNum(k.exams_open) : "…"}
          hint={k && `${faNum(k.exams_open)} در جریان · ${faNum(k.exams_next_7d)} در ۷ روز آینده`}
          onClick={nav.has("exams") ? () => nav.go("exams") : undefined} />
        <Kpi label="میانگین نمره‌ی پایانی" icon={BookOpenCheck} tone="brand" value={k?.avg_final != null ? faNum(k.avg_final, 2) : "—"}
          hint={k && `از ۲۰ · ${faNum(k.grades_30d)} نمره در ۳۰ روز اخیر`} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title="روند مطالعه‌ی ۳۰ روز" icon={Clock3} description="فقط مطالعه‌ی دانشجوهای رسمی، از روز رسمی شدن تا روز خروج">
          {d ? (
            <TrendChart labels={labels} height={220} format={(v) => faNum(v, v < 10 ? 1 : 0)}
              series={[
                { name: "ساعت مطالعه", values: d.series.map((x) => Math.round((x.seconds / 3600) * 10) / 10), color: "#b08a46", area: true },
                { name: "دانشجوی فعال", values: d.series.map((x) => x.users), color: "#1f6f5c" },
              ]} />
          ) : <div className="h-[240px] animate-pulse rounded-lg bg-muted/50" />}
        </Panel>

        <Panel title="کارهای مانده" icon={ClipboardList} bodyClass="p-0"
          actions={todo.length ? <Badge tone={todo.some((t) => TODO[t.kind]?.tone === "bad") ? "bad" : "warn"}>{faNum(todo.length)}</Badge> : undefined}>
          {!d ? <div className="m-4 h-40 animate-pulse rounded-lg bg-muted/50" />
            : !todo.length ? <div className="p-4"><EmptyState icon={BookOpenCheck} title="کار مانده‌ای نیست" text="همه‌ی کلاس‌ها استاد و دانشجو دارند و هشداری ثبت نشده است." /></div>
            : (
              <ul className="divide-y divide-border">
                {todo.map((t) => {
                  const m = TODO[t.kind];
                  if (!m) return null;
                  const Icon = m.icon;
                  const target = m.go && nav.has(m.go) ? m.go : null;
                  return (
                    <li key={t.kind} className="flex gap-3 px-4 py-3">
                      <span className={m.tone === "bad" ? "text-red-600" : m.tone === "warn" ? "text-amber-600" : "text-sky-600"}><Icon className="mt-0.5 h-4 w-4" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-bold">{m.title(t)}</p>
                        <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{m.text}</p>
                        {t.items.length > 0 && (
                          <p className="mt-1 truncate text-[11px] text-muted-foreground">{t.items.map((i) => i.title).join("، ")}{t.count > t.items.length ? " …" : ""}</p>
                        )}
                      </div>
                      {target && <Btn size="sm" onClick={() => nav.go(target)}>{m.cta}</Btn>}
                    </li>
                  );
                })}
              </ul>
            )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title={d?.scope ? "زیرمجموعه‌ها" : "واحدهای سازمانی"} icon={Network} bodyClass="p-0"
          actions={nav.has("structure") ? <Btn size="sm" onClick={() => nav.go("structure")}>ساختار سازمانی</Btn> : undefined}>
          {d && !d.breakdown.length ? (
            <div className="p-4"><EmptyState icon={Network} title={d.scope ? "این واحد زیرمجموعه ندارد" : "هنوز درخت سازمانی نساخته‌اید"}
              text={d.scope ? undefined : "دانشکده، گروه و رشته (یا شعبه و دوره) را بسازید تا آمار هر بخش جدا دیده شود و مدیر هر بخش فقط بخش خودش را ببیند."}
              action={!d.scope && nav.has("structure") ? <Btn kind="primary" size="sm" onClick={() => nav.go("structure")}>ساخت درخت</Btn> : undefined} /></div>
          ) : (
            <div className="border-0 [&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none">
              <DataTable<OrgBreakdownRow>
                rows={d ? d.breakdown : null}
                rowKey={(r) => r.id}
                onRowClick={(r) => setScope(r.id)}
                columns={[
                  { key: "n", header: "واحد", cell: (r) => <span className="font-bold">{r.name} <span className="text-[11px] font-normal text-muted-foreground">· {UNIT_KIND_LABEL[r.kind]}</span></span> },
                  { key: "s", header: "دانشجو", cell: (r) => faNum(r.students), className: "tabular-nums" },
                  { key: "c", header: "کلاس", cell: (r) => faNum(r.classes), className: "tabular-nums" },
                  { key: "a", header: "فعال ۷ روز", cell: (r) => `${faNum(r.learners_7d)}${r.students ? ` (${faNum(Math.round((r.learners_7d / r.students) * 100))}٪)` : ""}`, className: "tabular-nums", hideBelow: "sm" },
                  { key: "h", header: "ساعت مطالعه ۷ روز", cell: (r) => faHours(r.seconds_7d), className: "tabular-nums", hideBelow: "md" },
                ]} />
              {d?.unassigned && (d.unassigned.students > 0 || d.unassigned.classes > 0) && (
                <p className="border-t border-border px-4 py-2.5 text-[11.5px] text-muted-foreground">
                  بدون واحد: {faNum(d.unassigned.students)} دانشجو و {faNum(d.unassigned.classes)} کلاس
                  {nav.has("structure") && <button type="button" onClick={() => nav.go("structure")} className="ms-2 font-bold text-bronze hover:underline">چیدن روی درخت</button>}
                </p>
              )}
              {d?.scope && (
                <p className="border-t border-border px-4 py-2.5 text-[11.5px]">
                  <button type="button" onClick={() => setScope(wide ? null : access.unitsFor("org.reports.read")[0]?.id ?? null)} className="font-bold text-bronze hover:underline">بازگشت به {wide ? "کل مرکز" : "دامنه‌ی من"}</button>
                </p>
              )}
            </div>
          )}
        </Panel>

        <Panel title="فعالیت اخیر" icon={ClipboardList} bodyClass="p-0"
          actions={nav.has("audit") ? <Btn size="sm" onClick={() => nav.go("audit")}>همه</Btn> : undefined}>
          {!d ? <div className="m-4 h-40 animate-pulse rounded-lg bg-muted/50" />
            : !d.recent.length ? <div className="p-4"><EmptyState title={access.can("org.audit.read") ? "هنوز رویدادی ثبت نشده" : "لاگ ممیزی برای نقش شما باز نیست"} /></div>
            : (
              <ul className="divide-y divide-border">
                {d.recent.map((r) => (
                  <li key={r.id} className="px-4 py-2.5">
                    <p className="text-[12.5px]"><b>{r.actor ?? "سیستم"}</b> · {orgActionLabel(r.action)}{r.target_name ? <> · <span className="text-muted-foreground">{r.target_name}</span></> : null}</p>
                    <p className="text-[11px] text-muted-foreground">{faAgo(r.at)}</p>
                  </li>
                ))}
              </ul>
            )}
        </Panel>
      </div>
    </>
  );
}
