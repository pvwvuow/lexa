# Phase A2: centre console, organisation tree, roles and permissions (setup and wiring)

Plan: docs/ADMIN_PLATFORM.md, phase A2 (sections 5.1 to 5.3). Builds on A1 (PR #27: `ConsoleKit`,
`CentreWorkspace`, `admin-console.ts`), so merge A1 first. This PR adds new files only; OrgView is wired by
hand (section 3).

## 1. What it adds

| File | What |
|---|---|
| `supabase/014_centre_console.sql` | organisation tree, permission catalogue, role templates, custom roles, scoped grants with expiry, member kind `staff`, centre home and centre audit RPCs |
| `src/lib/cloud-api/org-console.ts` | typed client, permission catalogue with Persian labels and hints, `makeAccess`, tree helpers, Persian errors |
| `src/components/console/CentreConsole.tsx` | the centre workspace: builds the side menu from the caller's permissions, hosts the pages below plus the existing OrgView tabs (`legacy` sections) |
| `src/components/console/CentreHomePage.tsx` | centre home: 8 KPIs (with capacity meters), to-do list with jump buttons, 30-day study chart, breakdown by unit (click to drill down), recent activity; scope picker for unit heads |
| `src/components/console/OrgStructurePage.tsx` | tree + selected unit: totals with sub-units, add / edit / move / archive / restore / delete (empty only), what hangs on the unit, bulk add of classes / students / staff / subjects; ready trees for a university and a bar-exam institute |
| `src/components/console/OrgStaffPage.tsx` | staff list (base role, extra roles with scope, unit, 2FA, last sign-in), person drawer (title, unit, base role, grant / revoke with scope and expiry, remove), invite staff by username |
| `src/components/console/OrgRolesPage.tsx` | permission matrix (rows = permissions in 6 groups, columns = roles) with inline editing of custom roles and one save with a reason; role cards; editor; copy from a template; delete with impact |
| `src/components/console/OrgAuditPage.tsx` | centre audit search (range, kind, actor), detail drawer with readable fields, CSV |
| `src/components/console/CentreBits.tsx` | person cell, unit select, section intro, MFA gate, chips |

### Model

- **Tree** `lexa_org_units`: up to 6 levels, kinds faculty / department / program / branch / track / section / other,
  `path` = ids from the root, kept by trigger (moves re-compute the subtree, cycles refused). Classes, subjects,
  official students and members get a nullable `unit_id` (empty = whole centre).
- **Permissions**: the 21 keys of plan 5.3 (`org.settings.manage` … `org.billing.read`).
- **Roles** `lexa_org_roles`: system templates per centre (owner, manager, teacher, academic office, unit head,
  assistant, exam officer, advisor, finance and support, read-only auditor) re-synced from SQL, never editable;
  up to 40 custom roles per centre.
- **Grants** `lexa_org_role_grants`: user + role + scope (whole centre or one unit with everything under it)
  + optional expiry (max 3 years) + note. Only to active or invited members, never to the owner or yourself.
- **Effective permissions** `lexa_org_perms_at(o, unit)`: Lexa admin and owner = all; manager = template
  "manager" (all except `org.roles.manage`); plus every live grant at that unit or above it. Teacher / staff
  base roles add nothing centre-wide (a teacher keeps their own-class rights from 008 as before).
- **No escalation**: a role can only be created / edited with permissions the editor holds centre-wide; a grant
  only with permissions the granter holds at that scope; roles stronger than the editor are read-only for them.
- **Base role** (owner / manager / teacher / staff) stays on `lexa_org_members.role`. New `staff` takes no
  teacher seat and is not promoted to the global teacher role. Only the owner (or a Lexa admin) changes base
  roles, now with reason and audit (`lexa_org_set_base_role`).
- Every write needs aal2 and writes `lexa_audit_log` (`unit.*`, `role.*`, `staff.*`, `member.*`).

**Important:** the existing centre RPCs from 006 to 012 (roster, classes, exams, grades, API, connector) still
check `lexa_org_can_manage` (owner / manager). A custom role therefore opens the new A2 pages now, and the
old panels move to `lexa_org_can(...)` in A3 / A4 (one RPC at a time, same names). Until then, give people
who need the old panels the base role manager.

## 2. Database (owner)

1. A1 first: 012 (if not yet) and 013.
2. Run `supabase/014_centre_console.sql` in the SQL editor. Safe to re-run; it seeds the system roles for every
   existing centre and for each new centre by trigger.

Check:

```sql
select count(*) from pg_proc where proname like 'lexa_org_unit%' or proname like 'lexa_org_role%'
  or proname like 'lexa_org_grant%' or proname like 'lexa_org_staff%';          -- 21
select org_id, count(*) from public.lexa_org_roles group by 1;                   -- 10 per centre
select conname, pg_get_constraintdef(oid) from pg_constraint
where conrelid = 'public.lexa_org_members'::regclass and conname = 'lexa_org_members_role_chk';
```

## 3. Wiring (Z)

### 3.1 OrgView.tsx: CentreConsole instead of CentreWorkspace

Where A1 put `CentreWorkspace` around the staff tabs (A1 setup 3.3), use `CentreConsole` for **owners, managers
and staff** and for a Lexa admin opening a centre. Teachers keep the A1 `CentreWorkspace` with their own tabs
(their rights come from their classes, not from the permission matrix); a teacher who also has a grant may use
`CentreConsole` too, since the menu only shows what they may open.

```tsx
import { CentreConsole, type LegacySection } from "@/components/console/CentreConsole";
import { GraduationCap, ClipboardList, FileQuestion, Users, ArrowLeftRight, KeyRound, PlugZap, Settings, Globe, BarChart3 } from "lucide-react";

// existing tab bodies, unchanged; include only the ones OrgPage shows to this user today (canManage etc.)
const legacy: LegacySection[] = [
  { key: "students", label: "دانشجویان و حساب‌ها", icon: GraduationCap, group: "people", render: () => <OrgStudentsTab … /> },
  { key: "teachers", label: "مدرسان و درخواست‌ها", icon: Users, group: "people", badge: pendingRequests, render: () => <ManageTab … /> },
  { key: "classes", label: "ترم‌ها و کلاس‌ها", icon: ClipboardList, group: "teaching", render: () => <OrgClassesPanel … /> },
  { key: "exams", label: "آزمون‌های رسمی", icon: FileQuestion, group: "teaching", render: () => <OrgExamsPanel … /> },
  { key: "reports", label: "داشبورد مطالعه", icon: BarChart3, group: "insight", render: () => <OrgDashboardPanel … /> },
  { key: "compare", label: "گزارش مقایسه", icon: ArrowLeftRight, group: "insight", render: () => <ComparisonReportPanel … /> },
  { key: "api", label: "کلیدهای API", icon: KeyRound, group: "connect", render: () => <OrgApiPanel … /> },
  { key: "connector", label: "کانکتور", icon: PlugZap, group: "connect", render: () => <OrgConnectorPanel … /> },
  { key: "profile", label: "صفحهٔ عمومی", icon: Globe, group: "settings", render: () => <PublicTab … /> },
  { key: "settings", label: "تنظیمات پنل", icon: Settings, group: "settings", render: () => <SettingsTab … /> },
].filter((s) => allowedTabs.includes(s.key));

<CentreConsole
  orgId={org.id}
  centre={{ name: org.name, slug: org.slug, logoUrl: org.logoUrl, kindLabel: orgKindLabel(org.kind), city: org.city,
            status: org.status, planLabel: { trial: "آزمایشی", basic: "پایه", pro: "حرفه‌ای" }[org.plan], expiresAt: org.expiresAt }}
  capacity={capacity}
  legacy={legacy}
/>
```

Keys matter: the to-do list of the home page jumps to `classes`, `exams`, `students`, `teachers` and `staff`
when a section with that key exists. Use these keys (or rename them in `CentreHomePage.tsx`, `TODO`).
The A2 menu already has "خانه‌ی مرکز", so the old dashboard tab can stay as "داشبورد مطالعه" or be dropped.

### 3.2 Member role label

Wherever OrgView / ManageTab prints a member role (`owner` / `manager` / `teacher`), add `staff: "کارمند"`
(`BASE_ROLE_LABEL` in org-console.ts). `lexa_org_set_member` of 002 still allows only manager / teacher; the
new staff page uses `lexa_org_set_base_role`. The old "make manager" button may stay.

### 3.3 Nothing else

No change to AppShell, router or AdminView. `WorkspaceHome` (A1) already lands owners and managers on the
centre; staff land there too because they are active members (check `useManagedOrgs`: if it only returns
owner / manager centres, add `staff` there or staff use the centre link from their profile).

## 4. QA

1. Owner, aal2: menu shows Home, Audit, Structure, Staff, Roles, the old tabs, Security. Home KPIs match the old
   dashboard (students, seats, classes); to-do items jump to the right tab.
2. Structure on an empty centre: "university" preset makes 1 faculty, 3 departments, 2 programmes; "institute"
   makes 1 branch, 2 tracks, 2 groups. Rename, add a sub-unit, move a department under another faculty
   (subtree follows), try moving a unit under its own child (refused), archive with active children (refused),
   delete a unit with a class on it (refused, message explains).
3. Put 3 classes and 5 students on a department (add drawer, "only without unit"); home breakdown shows them;
   clicking the row drills down; "بدون واحد" counts drop.
4. Roles: matrix shows 10 system columns locked; copy "مدیر آموزش" -> edit in matrix -> save with reason ->
   audit `role.update` lists added / removed. Create a role with `org.units.manage` + `org.reports.read` +
   `org.roles.manage`.
5. Staff: invite user B as staff with that role scoped to one department; B accepts the invitation; B (aal2)
   sees Home limited to the department (scope picker without "کل مرکز"), Structure where only that subtree is
   editable, cannot give a role with a permission he lacks (message), cannot grant himself.
6. Expiry: grant with tomorrow's date shows "تا …"; after it passes the chip turns amber and the menu entry
   disappears for that person.
7. Base role: owner switches a teacher to staff (teacher seat freed) and back (seat check); a manager cannot
   change base roles; removing a member revokes all grants (`member.remove`, `grants: n`).
8. Without aal2: every A2 page shows the MFA panel; the server answers "mfa required" if called anyway.
9. Old panels still work for owner / manager exactly as before.
10. Mobile and dark theme: matrix scrolls both ways with the permission column and header sticky.

## 5. Notes

- `lexa_org_home` limits every number to the chosen unit and its subtree; teacher count in a unit = distinct
  teachers of its classes.
- `lexa_org_unit_items` / `lexa_org_unit_assign` cap at 3000 listed / 500 moved items per call.
- System role texts and permissions live in `lexa_org_role_templates()`; changing them in a later SQL file
  re-syncs every centre the next time its roles are listed.
- A3 / A4 replace `lexa_org_can_manage` in the old RPCs with `lexa_org_require(o, '<perm>', <unit>)`.
