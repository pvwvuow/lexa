# Phase 1 — official centre accounts: setup, wiring and QA

Spec: `docs/ORG_LEARNING.md`. This PR adds the server side and the UI pieces; three small
hooks in existing screens are left for Z (listed below) because those files are large.

## 1. Database (user, once)
Run `supabase/006_org_accounts.sql` in the Supabase SQL editor (after 002–005; safe to re-run).
Every existing centre gets `code = slug` when the slug fits `^[a-z0-9][a-z0-9-]{1,23}$`, and
50 student seats. A Lexa admin changes them with `lexa_admin_set_org_accounts(o, code, seats)`.

## 2. Edge Function (user or Z, once)
```
supabase functions deploy org-auth --no-verify-jwt
```
(or Dashboard → Edge Functions → New function "org-auth", paste `supabase/functions/org-auth/index.ts`,
and turn **off** "Enforce JWT verification"; the function checks tokens itself).
Secrets (Dashboard → Edge Functions → Secrets), only needed when the project uses the new API keys:
- `LEXA_SERVICE_KEY` = the **secret** key (`sb_secret_…`); never put it in the app or the repo
- `LEXA_PUBLISHABLE_KEY` = the publishable key (`sb_publishable_…`)
- optional `LEXA_INTERNAL_EMAIL_DOMAIN` (default `accounts.lexa.invalid`). If Auth rejects that
  domain, use a domain you own **that has no mail server** (never a domain someone else owns:
  a password-reset e-mail to it would hand over the account).

Auth settings: keep **MFA → TOTP enabled** (default on Supabase).

## 3. Wiring for Z (three hooks)
1. **App shell** (`AppShell.tsx`): render `<OrgFirstLoginGate />` once (next to the other global dialogs).
2. **Cloud sign-in** (`CloudAuth.tsx`): add a third mode/tab «ورود با حساب مرکز» that renders
   `<OrgSignInForm onDone={...} />`. On done, run the same post-sign-in steps as the e-mail sign-in
   (pull cloud state, forget cached "me"). Hide e-mails for which `isInternalEmail(email)` is true
   wherever the account e-mail is shown.
3. **Centre panel** (`OrgView.tsx`): for owners / managers (and Lexa admins) add a tab
   «دانشجویان و حساب‌ها» rendering `<OrgStudentsPanel orgId={org.id} orgName={org.name} />`
   (it shows `MfaPanel` first when the session is not two-factor).
   **Settings** (`SettingsView.tsx`): add `<RedeemOrgCode />` and `<MfaPanel />` (account section).
   **Admin console** (`AdminView.tsx`, centres list): two fields «کد مرکز» and «ظرفیت دانشجو»
   saved with `adminSetOrgAccounts(org.id, code, seats)`.
   Optional now, needed in phase 2: profile badges with `orgBadges()` + `badgeLabel()`.

New files: `src/lib/cloud-api/org-accounts.ts`, `src/lib/mfa.ts`, `src/components/app/{OrgSignInForm,
OrgFirstLoginGate,OrgStudentsPanel,MfaPanel,RedeemOrgCode}.tsx`. `src/lib/supabase.ts` only gained
`sbAdoptSession()` and `sbAal()`.

## 4. QA checklist
- Manager without MFA opens the students tab → MFA panel; enrol with an authenticator app → roster loads.
- Manager signs out/in → aal1 → panel asks for the 6-digit code again.
- Add one student (no existing account) → password shown once; card print + CSV work; CSV opens in
  Excel with Persian intact and a cell like `=1+1` stays text.
- Sign in on another device with «ورود با حساب مرکز» (code + username + password) → forced to change
  the password (weak ones refused) and accept terms → app usable; `lexa_org_students.terms_accepted_at` set.
- Wrong password 5× → «تلاش‌های ناموفق زیاد بود…»; a wrong username gives the same message.
- Add a student with «حساب قبلی» → activation code; a normal Lexa user enters it in Settings → terms dialog → linked.
  A second try with the same code → «کد … نادرست» ; 5 wrong codes → one-hour block.
- Import a CSV of 150 rows (Persian digits in numbers OK) → preview, bad/duplicate rows highlighted, no
  account made while any row is bad; after fixing → 150 created in two calls; same file again → «اطلاعات به‌روز شد».
- Capacity: set student seats to 2 (admin) and add a 3rd → «ظرفیت … تکمیل است».
- Suspend a centre-made student → their open session stops working within the token lifetime and they
  cannot sign in; set back to active → can sign in. Suspend a linked (own) account → still signs in normally.
- Graduated + «فقط محتوای عمومی» / «باز تا تاریخ» saved and shown in the list.
- «رمز تازه» only appears for centre-made accounts.
- Audit tab lists every action above; nobody (not even SQL as authenticated) can update/delete audit rows.
- A free user / another centre's manager calling `lexa_org_roster` or selecting `lexa_org_students`
  gets nothing / an error.
