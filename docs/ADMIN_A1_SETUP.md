# Phase A1: role-based home + platform console (setup and wiring)

Plan: docs/ADMIN_PLATFORM.md, phase A1. This PR adds new files only; the big existing files are wired
by hand (section 3).

## 1. What it adds

| File | What |
|---|---|
| `supabase/013_admin_console.sql` | centre lifecycle (adds `archived`, `status_reason`, `status_changed_at`, `delete_after`), `lexa_user_flags`, console RPCs, audit search |
| `supabase/functions/admin-users/index.ts` | suspend / unsuspend / sign out everywhere / reset two-factor, through the auth admin API |
| `src/lib/cloud-api/admin-console.ts` | typed client, Persian errors and labels, CSV helpers |
| `src/lib/workspace.ts` | role-based home: workspace preference, `usePlatformConsoleActive`, `#/admin/<section>` |
| `src/components/console/ConsoleKit.tsx` | console UI kit: frame with grouped side menu + top bar, page header, panel, KPI, sparkline, trend chart, meter, badge, buttons, search, segmented filter, data table, pager, drawer, confirm dialog with reason / type-to-confirm, `useLoad` |
| `src/components/console/PlatformConsole.tsx` | full-screen Lexa console: overview, requests, learning analytics, security; hosts the three pages below |
| `src/components/console/AdminCentresPage.tsx` | centres directory + side panel (plan, seats, student seats, sign-in code, expiry, internal note, lifecycle, purge) |
| `src/components/console/AdminUsersPage.tsx` | users and roles: search, filters, record, role with reason, suspend, sign out, reset 2FA |
| `src/components/console/AdminAuditPage.tsx` | audit log search, detail, CSV |
| `src/components/console/WorkspaceHome.tsx` | what `#/` shows: centre panel for owners / managers, learning dashboard otherwise, workspace bar when someone has more than one |
| `src/components/console/CentreWorkspace.tsx` | professional layout for a centre's staff: identity header + grouped section menu (wired into OrgView, 3.3) |

## 2. Database and function (owner)

1. Run `supabase/012_connector.sql` first if it was not run yet, then `supabase/013_admin_console.sql`
   in the SQL editor. 013 is safe to re-run and skips the API / connector parts if 010 / 012 are missing.
2. Deploy the function: `supabase functions deploy admin-users --no-verify-jwt`.
   Secrets: the same `LEXA_SERVICE_KEY` and `LEXA_PUBLISHABLE_KEY` as org-api (fallbacks:
   `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`).
3. Every admin enables two-factor sign-in (console > امنیت). Without an aal2 session the console shows
   the overview and centres only; users, audit and every change need aal2.

Check after running 013 (SQL editor):

```sql
select proname from pg_proc where proname like 'lexa_admin_%' order by 1;  -- includes lexa_admin_home … lexa_admin_audit
select conname, pg_get_constraintdef(oid) from pg_constraint
where conrelid = 'public.lexa_orgs'::regclass and conname = 'lexa_orgs_status_chk';
```

## 3. Wiring (Z)

### 3.1 AppShell.tsx

```tsx
import { PlatformConsole } from "@/components/console/PlatformConsole";
import { WorkspaceHome } from "@/components/console/WorkspaceHome";
import { usePlatformConsoleActive } from "@/lib/workspace";
```

Right after `const auth = useAuth();` (hooks must stay above the early returns):

```tsx
const consoleOn = usePlatformConsoleActive(route.view, auth.user?.role);
```

Right after the `if (!mounted) { ... }` block:

```tsx
if (consoleOn) {
  return (
    <>
      <PlatformConsole />
      <OrgFirstLoginGate />
      <UpdateBanner />
      <ApkUpdateBanner />
    </>
  );
}
```

Replace `{route.view === "home" && <DashboardView />}` with:

```tsx
{route.view === "home" && <WorkspaceHome learningHome={<DashboardView />} />}
```

Nothing else changes: the "پنل مدیریت" menu item still opens `#/admin`, which now shows the console for a
cloud admin. Sections are `#/admin/overview|requests|centres|users|audit|learning|security`; the router
already maps `#/admin/<anything>` to `{ view: "admin" }`, so `router.ts` needs no change. The desktop app
signed in with the local server admin (no cloud session) keeps `ServerAdminView` as before.
"محیط یادگیری" in the console stores the choice on the device and shows the learning dashboard with the
workspace bar; the bar switches back.

### 3.2 AdminView.tsx

No change needed. `CloudAdminView` is no longer reached by cloud admins (the console takes `#/admin`);
keep it for now as a fallback, remove it in A6.

### 3.3 OrgView.tsx: CentreWorkspace for staff

For an active member of the centre (owner, manager or teacher) replace the row of tabs of `OrgPage` with
`CentreWorkspace`; visitors keep the current public page and tabs. Keep every tab's content as is and keep
the existing visibility rules (`canManage` etc.). Suggested groups (only the items the user may see):

```tsx
import { CentreWorkspace } from "@/components/console/CentreWorkspace";
import { LayoutDashboard, GraduationCap, BookOpen, Users, UserCog, ArrowLeftRight, KeyRound, PlugZap, Settings, Globe } from "lucide-react";

const groups = [
  { label: "پیشخوان", items: [{ key: "dashboard", label: "داشبورد", icon: LayoutDashboard }] },
  { label: "آموزش", items: [
    { key: "classes", label: "ترم‌ها و کلاس‌ها", icon: GraduationCap },
    { key: "content", label: "دوره‌ها و مطالب", icon: BookOpen },
  ] },
  { label: "افراد", items: [
    { key: "students", label: "دانشجویان و حساب‌ها", icon: Users },          // canManage
    { key: "manage", label: "مدرسان و مدیران", icon: UserCog },              // canManage
    { key: "teachers", label: "صفحهٔ عمومی مدرسان", icon: Globe },
  ] },
  { label: "گزارش‌ها", items: [{ key: "compare", label: "گزارش مقایسه", icon: ArrowLeftRight }] },   // canManage
  { label: "اتصال سامانه", items: [
    { key: "api", label: "کلیدهای API", icon: KeyRound },                    // canManage
    { key: "connect", label: "کانکتور", icon: PlugZap },                     // canManage
  ] },
  { label: "تنظیمات", items: [{ key: "settings", label: "تنظیمات پنل", icon: Settings }] },          // canManage
].map((g) => ({ ...g, items: g.items.filter((i) => allowedTabs.includes(i.key)) })).filter((g) => g.items.length);

<CentreWorkspace
  centre={{ name: org.name, slug: org.slug, logoUrl: org.logoUrl, kindLabel: orgKindLabel(org.kind), city: org.city,
            status: org.status, planLabel: { trial: "آزمایشی", basic: "پایه", pro: "حرفه‌ای" }[org.plan], expiresAt: org.expiresAt }}
  roleLabel={myRole === "owner" ? "مالک مرکز" : myRole === "manager" ? "مدیر پنل" : "مدرس"}
  groups={groups}
  active={tab}
  onSelect={(k) => setTab(k as typeof tab)}
  capacity={capacity /* from lexa_org_capacity when canManage, else null */}
>
  {/* the existing tab bodies, unchanged */}
</CentreWorkspace>
```

`allowedTabs` is whatever list OrgPage already uses to decide which tabs to show. The workspace has its
own section title, so remove a duplicate big heading inside a tab body if one looks doubled.

### 3.4 Types (optional)

`OrgStatus` in `src/lib/cloud-api/orgs.ts` may be widened to `"pending" | "active" | "suspended" | "archived"`.
The old AdminConsole status select shows an empty value for an archived centre; it is not used by cloud
admins any more.

## 4. QA

1. Admin (cloud) opens the app: `#/` shows the console overview full-screen; KPIs, 30-day chart, queues,
   health, alerts. No student dashboard behind it.
2. Without aal2: amber notice + "ورود دومرحله‌ای" button; users and audit show the MFA panel; centre
   actions answer "این کار به ورود دومرحله‌ای نیاز دارد".
3. With aal2, centres: filter counts match; open a centre, change plan / seats / expiry / note, save ->
   audit shows `admin.org.update` with before / after. Suspend (reason required) -> archive -> schedule
   deletion -> cancel; activate from pending.
4. Users: search by part of an e-mail; open a record (audited as `admin.user.view`); change role with a
   reason; suspend a test user (cannot sign in, sessions ended), unsuspend; reset 2FA of a test user.
   Suspending an admin or yourself is refused; the last admin cannot be demoted.
5. Audit: filters by group, centre, actor and dates; detail drawer; CSV opens in Excel with Persian text.
6. "محیط یادگیری" -> learning dashboard with the workspace bar; "کنسول مدیریت Lexa" returns to the console.
7. Centre owner (not admin): `#/` lands on the centre panel inside CentreWorkspace; a plain student still
   sees the learning dashboard; a teacher member sees the workspace with his sections only.
8. Mobile (APK width): console menu opens from the top-bar button; tables scroll sideways; drawers full width.
9. Dark theme: frame, tables, badges and charts readable.

## 5. Notes

- A suspended user's current access token stays valid until it expires (at most one hour); refresh is
  refused at once because the auth ban is set and sessions are deleted.
- The audit entry of a user action is written twice: `stage: authorized` (by the admin, before the auth
  call) and `stage: done` or `stage: failed` (by the function).
- Purge deletes the centre row; all centre tables cascade. Only the audit entries remain.
