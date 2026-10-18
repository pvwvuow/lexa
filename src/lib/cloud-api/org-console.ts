"use client";
/* Centre console (phase A2 of docs/ADMIN_PLATFORM.md): typed client over supabase/014_centre_console.sql,
 * the permission catalogue with Persian labels, and error texts. */
import { HttpError, sbRpc } from "./rest";
import { actionLabel } from "./admin-console";

// --- permissions ---
export type PermKey =
  | "org.settings.manage" | "org.units.manage" | "org.roles.manage" | "org.members.manage"
  | "org.students.manage" | "org.terms.manage" | "org.classes.manage" | "org.enroll.manage"
  | "org.content.publish" | "org.exams.manage" | "org.grades.enter" | "org.grades.approve"
  | "org.grades.publish" | "org.grades.unlock" | "org.appeals.handle" | "org.reports.read"
  | "org.reports.export" | "org.announce" | "org.api.manage" | "org.audit.read" | "org.billing.read";

export interface PermInfo { key: PermKey; label: string; hint: string; sensitive?: boolean }
export interface PermGroup { key: string; label: string; perms: PermInfo[] }

export const PERM_GROUPS: PermGroup[] = [
  { key: "admin", label: "سازمان و دسترسی", perms: [
    { key: "org.settings.manage", label: "تنظیمات مرکز", hint: "نام، برند، امنیت و سیاست\u200cهای مرکز" },
    { key: "org.units.manage", label: "ساختار سازمانی", hint: "ساخت، جابه\u200cجایی و بایگانی واحدها؛ چیدن کلاس و دانشجو روی واحد" },
    { key: "org.roles.manage", label: "نقش\u200cها و اعطا", hint: "ساخت نقش و دادن آن به دیگران (هرگز بیشتر از دسترسی خود)", sensitive: true },
    { key: "org.members.manage", label: "استادها و کارکنان", hint: "دعوت، تغییر عنوان و واحد، حذف از مرکز" },
  ] },
  { key: "students", label: "دانشجو و ثبت\u200cنام", perms: [
    { key: "org.students.manage", label: "حساب دانشجو", hint: "ساخت، تعلیق و بازنشانی حساب\u200cهای رسمی" },
    { key: "org.enroll.manage", label: "ثبت\u200cنام", hint: "ثبت\u200cنام، حذف و اضافه، لیست انتظار" },
  ] },
  { key: "teaching", label: "آموزش", perms: [
    { key: "org.terms.manage", label: "ترم و تقویم", hint: "ترم، تقویم آموزشی و مهلت\u200cها" },
    { key: "org.classes.manage", label: "درس و کلاس", hint: "ساخت درس و کلاس، تعیین استاد و ظرفیت" },
    { key: "org.content.publish", label: "انتشار محتوا", hint: "انتشار برای کلاس یا کل مرکز" },
    { key: "org.exams.manage", label: "آزمون", hint: "ساخت آزمون، بانک سؤال و زمان\u200cبندی" },
  ] },
  { key: "grades", label: "نمره و اعتراض", perms: [
    { key: "org.grades.enter", label: "ورود نمره", hint: "وارد کردن و ارسال نمره" },
    { key: "org.grades.approve", label: "تأیید نمره", hint: "تأیید یا برگرداندن نمره\u200cی ارسال\u200cشده" },
    { key: "org.grades.publish", label: "انتشار نمره", hint: "نمایش نمره به دانشجو" },
    { key: "org.grades.unlock", label: "باز کردن قفل نمره", hint: "فقط با دلیل؛ در لاگ ثبت می\u200cشود", sensitive: true },
    { key: "org.appeals.handle", label: "رسیدگی به اعتراض", hint: "پاسخ به اعتراض دانشجو" },
  ] },
  { key: "insight", label: "گزارش و ارتباط", perms: [
    { key: "org.reports.read", label: "دیدن گزارش\u200cها", hint: "خانه\u200cی مرکز، مطالعه، نمره و مقایسه" },
    { key: "org.reports.export", label: "خروجی گزارش", hint: "دانلود CSV و Excel", sensitive: true },
    { key: "org.announce", label: "اطلاعیه", hint: "اطلاعیه برای مرکز، شاخه یا کلاس" },
  ] },
  { key: "system", label: "اتصال، ممیزی و پلن", perms: [
    { key: "org.api.manage", label: "API و اتصال", hint: "کلیدهای API و اتصال به سامانه\u200cی آموزشی", sensitive: true },
    { key: "org.audit.read", label: "لاگ ممیزی", hint: "دیدن همه\u200cی تغییرهای مرکز" },
    { key: "org.billing.read", label: "پلن و مصرف", hint: "پلن، صندلی و مصرف (فقط خواندنی)" },
  ] },
];
export const ALL_PERMS: PermKey[] = PERM_GROUPS.flatMap((g) => g.perms.map((p) => p.key));
export const PERM_LABEL: Record<string, string> = Object.fromEntries(PERM_GROUPS.flatMap((g) => g.perms.map((p) => [p.key, p.label])));

// --- access of the signed-in user ---
export type BaseRole = "owner" | "manager" | "teacher" | "staff";
export const BASE_ROLE_LABEL: Record<BaseRole, string> = { owner: "مالک", manager: "مدیر کل", teacher: "مدرس", staff: "کارمند" };
export interface MyGrant { role: string; role_key: string; unit_id: string | null; unit: string | null; perms: PermKey[]; expires_at: string | null }
export interface MyAccess {
  base_role: BaseRole | null; platform_admin: boolean; mfa: boolean;
  perms: PermKey[]; perms_any: PermKey[]; grants: MyGrant[];
}
export const orgMyAccess = (orgId: string) => sbRpc<MyAccess>("lexa_org_my_access", { o: orgId });

export interface Access {
  raw: MyAccess;
  /** centre-wide */
  can: (p: PermKey) => boolean;
  /** centre-wide or at least one unit */
  canSomewhere: (p: PermKey) => boolean;
  /** units where p is granted (when not centre-wide) */
  unitsFor: (p: PermKey) => { id: string; name: string }[];
  isOwner: boolean;
}
export function makeAccess(a: MyAccess): Access {
  const wide = new Set(a.perms);
  const any = new Set(a.perms_any);
  return {
    raw: a,
    can: (p) => wide.has(p),
    canSomewhere: (p) => any.has(p),
    unitsFor: (p) => {
      const seen = new Map<string, string>();
      for (const g of a.grants) if (g.unit_id && g.perms.includes(p)) seen.set(g.unit_id, g.unit ?? "");
      return [...seen].map(([id, name]) => ({ id, name }));
    },
    isOwner: a.base_role === "owner" || a.platform_admin,
  };
}

// --- organisation tree ---
export type UnitKind = "faculty" | "department" | "program" | "branch" | "track" | "section" | "other";
export const UNIT_KIND_LABEL: Record<UnitKind, string> = {
  faculty: "دانشکده", department: "گروه آموزشی", program: "رشته یا مقطع", branch: "شعبه",
  track: "دوره", section: "گروه کلاسی", other: "واحد",
};
export interface UnitRow {
  id: string; parent_id: string | null; kind: UnitKind; name: string; code: string; sort: number;
  status: "active" | "archived"; depth: number;
  classes: number; courses: number; students: number; staff: number; grants: number; created_at: string;
}
export const orgUnitTree = async (orgId: string) => (await sbRpc<UnitRow[]>("lexa_org_unit_tree", { o: orgId })) ?? [];
export const orgUnitSave = (orgId: string, f: { id?: string | null; parentId: string | null; kind: UnitKind; name: string; code?: string; sort?: number }) =>
  sbRpc<string>("lexa_org_unit_save", {
    o: orgId, u_id: f.id ?? null, p_parent: f.parentId, p_kind: f.kind, p_name: f.name, p_code: f.code ?? "", p_sort: f.sort ?? 0,
  });
export const orgUnitStatus = (unitId: string, archive: boolean, reason: string) =>
  sbRpc<string>("lexa_org_unit_status", { u: unitId, archive, reason });
export const orgUnitDelete = (unitId: string, reason: string) => sbRpc<string>("lexa_org_unit_delete", { u: unitId, reason });
export const orgUnitPreset = (orgId: string, preset: "university" | "institute") =>
  sbRpc<number>("lexa_org_unit_preset", { o: orgId, preset });

export type UnitItemKind = "class" | "course" | "student" | "member";
export interface UnitItem { id: string; title: string; sub: string | null; unit_id: string | null; status: string }
export const orgUnitItems = async (orgId: string, kind: UnitItemKind) =>
  (await sbRpc<UnitItem[]>("lexa_org_unit_items", { o: orgId, p_kind: kind })) ?? [];
export const orgUnitAssign = (orgId: string, kind: UnitItemKind, ids: string[], unitId: string | null) =>
  sbRpc<number>("lexa_org_unit_assign", { o: orgId, p_kind: kind, ids, u: unitId });

/** children map + helpers for a flat unit list */
export function unitIndex(rows: UnitRow[]) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const kids = new Map<string | null, UnitRow[]>();
  for (const r of rows) {
    const k = r.parent_id ?? null;
    const list = kids.get(k) ?? [];
    list.push(r);
    kids.set(k, list);
  }
  for (const list of kids.values()) list.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "fa"));
  const pathOf = (id: string | null): UnitRow[] => {
    const out: UnitRow[] = [];
    let cur = id ? byId.get(id) : undefined;
    let guard = 0;
    while (cur && guard++ < 10) { out.unshift(cur); cur = cur.parent_id ? byId.get(cur.parent_id) : undefined; }
    return out;
  };
  const subtree = (id: string): string[] => {
    const out: string[] = [id];
    for (let i = 0; i < out.length; i++) for (const c of kids.get(out[i]) ?? []) out.push(c.id);
    return out;
  };
  const total = (id: string, f: "classes" | "students" | "staff" | "courses") =>
    subtree(id).reduce((s, x) => s + (byId.get(x)?.[f] ?? 0), 0);
  return { byId, kids, pathOf, subtree, total };
}

// --- roles and grants ---
export interface RoleRow {
  id: string; key: string; name: string; description: string; perms: PermKey[];
  is_system: boolean; base: boolean; sort: number; holders: number; updated_at: string;
}
export const orgRoleList = async (orgId: string) => (await sbRpc<RoleRow[]>("lexa_org_role_list", { o: orgId })) ?? [];
export const orgRoleSave = (orgId: string, f: { id?: string | null; name: string; description: string; perms: PermKey[] }, reason: string) =>
  sbRpc<string>("lexa_org_role_save", {
    o: orgId, r_id: f.id ?? null, p_name: f.name, p_description: f.description, p_perms: f.perms, reason,
  });
export const orgRoleDelete = (orgId: string, roleId: string, reason: string) =>
  sbRpc<number>("lexa_org_role_delete", { o: orgId, r_id: roleId, reason });

export interface GrantRow {
  id: string; user_id: string; username: string; display_name: string; avatar_url: string | null;
  role_id: string; role_key: string; role_name: string; unit_id: string | null; unit_name: string | null;
  expires_at: string | null; expired: boolean; note: string; granted_by_name: string | null; granted_at: string;
}
export const orgGrantList = async (orgId: string) => (await sbRpc<GrantRow[]>("lexa_org_grant_list", { o: orgId })) ?? [];
export const orgGrant = (orgId: string, userId: string, roleId: string, unitId: string | null, expiresAt: string | null, note = "") =>
  sbRpc<string>("lexa_org_grant", { o: orgId, uid: userId, r_id: roleId, u: unitId, p_expires: expiresAt, p_note: note });
export const orgGrantRevoke = (grantId: string, reason: string) => sbRpc<string>("lexa_org_grant_revoke", { g: grantId, reason });

// --- staff ---
export interface StaffRow {
  user_id: string; username: string; display_name: string; avatar_url: string | null; base_role: BaseRole;
  status: "active" | "invited" | "requested"; title: string; unit_id: string | null; unit_name: string | null;
  since: string; last_sign_in_at: string | null; mfa: boolean; grants: number; classes: number;
}
export const orgStaff = async (orgId: string) => (await sbRpc<StaffRow[]>("lexa_org_staff", { o: orgId })) ?? [];
export const orgStaffInvite = (orgId: string, f: { userId: string; title: string; roleId: string | null; unitId: string | null; expiresAt: string | null }) =>
  sbRpc<string>("lexa_org_staff_invite", { o: orgId, uid: f.userId, p_title: f.title, r_id: f.roleId, u: f.unitId, p_expires: f.expiresAt });
export const orgStaffUpdate = (orgId: string, userId: string, title: string, unitId: string | null) =>
  sbRpc<string>("lexa_org_staff_update", { o: orgId, uid: userId, p_title: title, p_unit: unitId });
export const orgSetBaseRole = (orgId: string, userId: string, role: Exclude<BaseRole, "owner">, reason: string) =>
  sbRpc<string>("lexa_org_set_base_role", { o: orgId, uid: userId, p_role: role, reason });
export const orgStaffRemove = (orgId: string, userId: string, reason: string) =>
  sbRpc<string>("lexa_org_staff_remove", { o: orgId, uid: userId, reason });

export interface FoundUser { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string }
export async function findUserByUsername(username: string): Promise<FoundUser | null> {
  const rows = await sbRpc<FoundUser[]>("lexa_find_user", { uname: username.trim().replace(/^@/, "") });
  return rows?.[0] ?? null;
}

// --- centre home ---
export interface OrgHomeKpis {
  students: number; students_pending: number; student_seats: number; students_used: number;
  teachers: number; teacher_seats: number; teachers_used: number; staff: number;
  classes: number; classes_current: number; learners_7d: number;
  seconds_7d: number; seconds_prev_7d: number; seconds_30d: number;
  exams_open: number; exams_next_7d: number; grades_30d: number; avg_final: number | null;
  invites_pending: number; requests_pending: number; units: number;
}
export type TodoKind =
  | "classes_no_teacher" | "classes_no_students" | "classes_no_content" | "exams_no_questions"
  | "students_not_activated" | "term_ending" | "invites_stale" | "join_requests" | "staff_no_mfa"
  | "student_seats" | "teacher_seats" | "org_expiring";
export interface OrgTodo { kind: TodoKind; count: number; cap?: number; at?: string; items: { id: string; title: string }[] }
export interface OrgBreakdownRow { id: string; name: string; kind: UnitKind; students: number; classes: number; learners_7d: number; seconds_7d: number }
export interface OrgRecent { id: number; at: string; action: string; actor: string | null; target_name: string | null }
export interface OrgHome {
  kpis: OrgHomeKpis; series: { day: string; seconds: number; users: number }[];
  breakdown: OrgBreakdownRow[]; unassigned: { students: number; classes: number } | null;
  todo: OrgTodo[]; recent: OrgRecent[];
  scope: { unit_id: string; name: string; kind: UnitKind; path: string[] } | null; centre_wide: boolean;
  org: { id: string; name: string; status: string; expires_at: string | null };
  today: string; generated_at: string;
}
export const orgHome = (orgId: string, unitId: string | null) => sbRpc<OrgHome>("lexa_org_home", { o: orgId, u: unitId });

// --- centre audit ---
export interface OrgAuditRow {
  id: number; at: string; action: string; actor: string | null; actor_name: string | null;
  target: string | null; target_name: string | null; detail: Record<string, unknown>; total: number;
}
export async function orgAudit(orgId: string, p: { from?: string | null; to?: string | null; action?: string; actor?: string; limit?: number; offset?: number }) {
  const rows = (await sbRpc<OrgAuditRow[]>("lexa_org_audit_search", {
    o: orgId, p_from: p.from ?? null, p_to: p.to ?? null, p_action: p.action ?? "",
    p_actor: (p.actor ?? "").replace(/^@/, ""), lim: p.limit ?? 50, off: p.offset ?? 0,
  })) ?? [];
  return { rows, total: rows.length ? Number(rows[0].total) || 0 : 0 };
}

const ORG_ACTIONS: Record<string, string> = {
  "unit.create": "ساخت واحد", "unit.update": "ویرایش واحد", "unit.move": "جابه\u200cجایی واحد",
  "unit.archive": "بایگانی واحد", "unit.restore": "بازگردانی واحد", "unit.delete": "حذف واحد",
  "unit.preset": "ساخت درخت آماده", "unit.assign": "چیدن روی واحد",
  "role.create": "ساخت نقش", "role.update": "ویرایش نقش", "role.delete": "حذف نقش",
  "role.grant": "اعطای نقش", "role.revoke": "پس گرفتن نقش",
  "staff.invite": "دعوت کارمند", "staff.update": "ویرایش کارمند",
  "member.base_role": "تغییر نقش پایه", "member.remove": "حذف از مرکز",
};
export const orgActionLabel = (a: string) => ORG_ACTIONS[a] ?? actionLabel(a);
export const ORG_AUDIT_GROUPS: { key: string; label: string }[] = [
  { key: "", label: "همه\u200cی رویدادها" }, { key: "unit.", label: "ساختار سازمانی" }, { key: "role.", label: "نقش و دسترسی" },
  { key: "staff.", label: "کارکنان" }, { key: "member.", label: "عضویت" }, { key: "student.", label: "دانشجو" },
  { key: "class.", label: "کلاس" }, { key: "grade", label: "نمره" }, { key: "exam", label: "آزمون" },
  { key: "api", label: "API" }, { key: "integration", label: "اتصال" },
];

// --- errors ---
const ERRORS: [RegExp, string][] = [
  [/mfa required/i, "این بخش به ورود دومرحله\u200cای نیاز دارد. از بخش «امنیت من» کد برنامه\u200cی احراز هویت را تأیید کنید."],
  [/forbidden: ?org\.units/i, "اجازه\u200cی تغییر ساختار در این بخش از درخت را ندارید."],
  [/forbidden: ?org\.roles/i, "اجازه\u200cی مدیریت نقش\u200cها را در این دامنه ندارید."],
  [/forbidden: ?org\.members/i, "اجازه\u200cی مدیریت کارکنان را در این دامنه ندارید."],
  [/forbidden: ?org\.reports/i, "اجازه\u200cی دیدن گزارش این بخش را ندارید."],
  [/forbidden: ?org\.audit/i, "اجازه\u200cی دیدن لاگ ممیزی مرکز را ندارید."],
  [/forbidden/i, "اجازه\u200cی این کار را ندارید."],
  [/not_staff/i, "شما عضو فعال این مرکز نیستید."],
  [/cannot give permissions you do not have/i, "نمی\u200cتوانید دسترسی\u200cای بدهید که خودتان ندارید."],
  [/stronger than yours/i, "این نقش دسترسی\u200cهایی دارد که شما ندارید؛ فقط مالک می\u200cتواند آن را تغییر دهد."],
  [/system roles cannot be changed/i, "نقش\u200cهای پیش\u200cفرض قفل\u200cاند؛ از آن کپی بگیرید و کپی را ویرایش کنید."],
  [/base roles are set on the membership/i, "مالک، مدیر کل و مدرس نقش پایه\u200cاند و از ستون «نقش پایه» تعیین می\u200cشوند."],
  [/role name taken/i, "نقشی با همین نام وجود دارد."],
  [/too many roles/i, "حداکثر ۴۰ نقش سفارشی می\u200cتوانید داشته باشید."],
  [/bad role name/i, "نام نقش باید ۲ تا ۶۰ حرف باشد."],
  [/cannot grant yourself/i, "نمی\u200cتوانید به خودتان نقش بدهید."],
  [/owner already has every permission/i, "مالک همه\u200cی دسترسی\u200cها را دارد."],
  [/bad expiry/i, "تاریخ انقضا باید در آینده و حداکثر تا سه سال بعد باشد."],
  [/too many grants/i, "این شخص حداکثر ۳۰ نقش می\u200cتواند داشته باشد."],
  [/only the owner can change base roles/i, "فقط مالک مرکز نقش پایه را تغییر می\u200cدهد."],
  [/only the owner can remove a manager/i, "فقط مالک می\u200cتواند مدیر کل را حذف کند."],
  [/the owner cannot be (changed|removed)/i, "مالک مرکز را نمی\u200cتوان تغییر داد یا حذف کرد."],
  [/cannot remove yourself/i, "نمی\u200cتوانید خودتان را از اینجا حذف کنید."],
  [/no free seats/i, "صندلی مدرس آزاد نیست؛ برای افزایش با Lexa تماس بگیرید."],
  [/already a member/i, "این شخص همین حالا عضو مرکز است یا دعوت او در انتظار است."],
  [/too many staff/i, "حداکثر ۲۰۰ کارمند می\u200cتوان دعوت کرد."],
  [/organisation panel is not active/i, "پنل مرکز فعال نیست؛ دعوت ممکن نیست."],
  [/user not found/i, "کاربری با این نام کاربری پیدا نشد."],
  [/member not found/i, "این شخص عضو مرکز نیست."],
  [/unit code taken/i, "کد این واحد تکراری است."],
  [/bad unit code/i, "کد واحد فقط حروف کوچک انگلیسی، عدد، نقطه، خط تیره و زیرخط (تا ۳۰ حرف) است."],
  [/bad unit name/i, "نام واحد باید ۱ تا ۸۰ حرف باشد."],
  [/tree too deep/i, "درخت حداکثر شش سطح دارد."],
  [/cannot move under itself/i, "یک واحد را نمی\u200cتوان زیر خودش یا زیرشاخه\u200cاش برد."],
  [/unit has active sub-units/i, "اول زیرواحدهای فعال را بایگانی یا جابه\u200cجا کنید."],
  [/parent unit is archived/i, "واحد بالادستی بایگانی است؛ اول آن را بازگردانید."],
  [/unit not empty/i, "فقط واحد خالی حذف می\u200cشود؛ اول زیرواحدها، کلاس\u200cها، دانشجوها، کارکنان و نقش\u200cهای آن را جابه\u200cجا کنید. می\u200cتوانید بایگانی\u200cاش کنید."],
  [/tree not empty/i, "درخت آماده فقط برای مرکزی است که هنوز واحدی ندارد."],
  [/too many units/i, "حداکثر ۵۰۰ واحد می\u200cتوانید داشته باشید."],
  [/too many items/i, "در هر بار حداکثر ۵۰۰ مورد را جابه\u200cجا کنید."],
  [/(parent )?unit not found/i, "واحد پیدا نشد یا بایگانی است."],
  [/PGRST202|Could not find the function/i, "فایل 014_centre_console.sql هنوز روی پایگاه داده اجرا نشده است."],
  [/JWT expired|invalid JWT|not signed in|PGRST30[0-9]/i, "نشست ورود منقضی شده است؛ یک بار خارج و دوباره وارد شوید."],
];

export function orgConsoleError(e: unknown): string {
  const raw = e instanceof HttpError ? `${e.message} ${e.code}` : e instanceof Error ? e.message : String(e ?? "");
  for (const [re, msg] of ERRORS) if (re.test(raw)) return msg;
  if (e instanceof TypeError) return "اتصال به Lexa برقرار نشد؛ اینترنت را بررسی کنید.";
  const code = e instanceof HttpError ? e.code || String(e.status || "") : "";
  return code ? `درخواست انجام نشد (کد ${code}).` : "درخواست انجام نشد. دوباره تلاش کنید.";
}
export const isMfaError = (e: unknown) => /mfa required/i.test(e instanceof Error ? e.message : String(e ?? ""));
