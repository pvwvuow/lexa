# Lexa security notes

Last review: 17 Oct 2026 (repo audit + audit of `supabase/002_cloud_social.sql`, then a
second pass over the cloud layer and the core/Electron code).

## Setup checklist (Supabase)

1. Run `supabase/002_cloud_social.sql`, then `supabase/003_security_fixes.sql`, then
   `supabase/004_usernames_and_directory.sql` (username picked at sign-up, admins listed
   as teachers). If 002 is ever re-run, re-run 003 and 004 after it (002 ends with a broad
   `grant execute on all functions` that 003 narrows).
2. Make the owner an admin in the SQL editor:
   `update public.lexa_profiles set role='admin' where id=(select id from auth.users where email='...');`
3. Supabase dashboard > Authentication: turn on email confirmation and leaked-password
   protection, set a minimum password length of 8+.
4. Never ship the service-role key. The publishable key in `src/lib/supabase-config.ts`
   is safe only because every table has RLS.

## Fixed

- **003 SQL:** `lexa_promote_member` and the guard/helper functions are no longer
  callable as `/rpc` (anyone could re-promote a demoted teacher); signed-in RPCs are
  closed to `anon`; org seat limits are enforced on join requests and approvals; ratings
  must target a real, visible post/course (no orphan-row spam); rating/student
  aggregates hide draft courses and cap the id list at 200.
- **Default admin password (`src/lib/auth.ts`):** the public `admin / lexa@1404` (and the
  old `hamyar@1404`) is never created or kept. Without a strong `ADMIN_PASSWORD` (8+
  chars) a random password is generated and written to `ADMIN-PASSWORD.txt` next to the
  SQLite file (desktop: the Electron userData folder). An existing admin still on a
  public default is rotated the same way. QA scripts that logged in with the old default
  must set `ADMIN_PASSWORD`.
- **Supabase endpoint override (`src/lib/supabase-config.ts`):** the
  `lexa-supabase-url` / `lexa-supabase-key` localStorage overrides (which would send the
  session token to any URL) only work in dev or with
  `NEXT_PUBLIC_ALLOW_SUPABASE_OVERRIDE=1`.
- **Review 2 (PR fix/review-2):**
  - Guest org page: `getOrg` (`src/lib/cloud-api/orgs.ts`) embeds `lexa_org_private`
    only for signed-in users, so the public org page no longer fails for guests.
  - Desktop: `/api/auth/cloud-bridge` is no longer answered by the cloud router
    (`install.ts`); it reaches the local server again.
  - `/api/feedback/chat` no longer returns raw error text to the client.
  - Teacher profile follow / add-to-library buttons check the server response instead
    of flipping the UI on errors.
  - Electron: `will-navigate` blocks every non-app URL (also `file:` / `data:`), only
    http(s) goes to the system browser; the splash window is closed once the main
    window is shown (it used to stay open behind it).

## Design notes

- On desktop, social features (follow, comments, ratings, org panel, teacher studio
  publishing) always talk to Supabase, so they need a cloud (email) account. The local
  SQLite account keeps working for study data and sync.
- Usernames (cloud): chosen at sign-up (`CloudAuth.tsx`, sent as user metadata and read
  by the 004 trigger; also applied after the first sign-in via `lexa_set_username`) and
  changeable from the cloud account menu. Rule: 3-20 chars, Persian/Latin letters,
  digits, `_` and `.`; the default `u` + 10 hex form is reserved.

## Open (ordered by risk)

1. **Unsigned desktop update feed** (`electron/app-updater.js`): file hashes are checked,
   the manifest is not authenticated. Sign the manifest with Ed25519, embed the public key
   in the bootstrap, refuse unsigned/older manifests. The private key stays with the
   release machine (Z), never in the repo.
2. **Mutable content URLs:** lesson content and the update feed fall back to `@main` on
   jsDelivr/raw GitHub. Pin to release tags or commit hashes.
3. **SSRF TOCTOU** (`src/lib/net-guard.ts`): `assertPublicUrl` resolves DNS, then
   `fetch` resolves again (DNS rebinding) and redirects are not re-checked. Affects
   `/api/import` and custom AI `baseUrl`. Fix: resolve once, connect to the checked IP
   (custom `lookup` / undici dispatcher), `redirect: "manual"` and re-check each hop.
4. **Sync deletes resurrect:** SQLite `/api/user/sync` never deletes notes/marks and
   `mergeServerSnapshot` unions them; the Supabase blob is last-writer-wins on client
   clocks. Needs per-item `deletedAt` tombstones + server revisions (conditional writes).
5. **Payload limits:** `/api/user/sync` has no body-size / item-count limits and
   `/api/tcourses` has no limits on nested lessons/blocks and no rate limit. Add a byte
   cap (e.g. 2 MB), per-collection counts, and a per-user limit.
6. **Uploads:** avatar upload trusts the client MIME type and the media route does not
   send `X-Content-Type-Options: nosniff`. Check magic bytes, add nosniff. In the cloud
   layer `kind=org` uploads (org logos) are allowed for any signed-in user; restrict to
   org managers (storage policy on the `org/` prefix).
7. **Exam history not in server sync:** `examAttempts` is missing from
   `buildSyncSnapshot()` and the Prisma schema.
8. **No CSP on static builds** (Pages/APK): add a reviewed meta CSP; reduce inline
   scripts in `layout.tsx`.
9. **Guest AI on the standalone server:** `/api/ai` accepts unauthenticated calls with an
   in-memory per-IP limit only. Decide: require a session, or add quotas.
10. **Supabase tokens and BYOK AI keys live in localStorage** (XSS impact). Keep the
    attack surface small (CSP), show a clear "stored on this device" note for AI keys.
11. **Electron hardening:** turn on `sandbox: true` for the main window (preload only
    uses `contextBridge`/`ipcRenderer`, so it should work; test the updater UI first).
12. **Weak RNG fallback:** the compat script polyfills `crypto.getRandomValues` with
    `Math.random` on old WebViews. Never use it for tokens/ids that must be secret; prefer
    failing loudly.
13. **Mixed content:** http:// thumbnails are accepted for posts/courses. Allow https only.
14. **Small UX bugs:** `PostView` leaves the page even when deleting a post fails;
    `StudioView` delete buttons keep spinning if the request throws; `DashboardView`
    "remove from library" toasts success on a failed request; cloud comments fill
    `username` with the display name (`handlers.ts`); `AppShell` sidebar shows
    "اتاق استاد" only for `role === "teacher"` (admins reach it from the account menu);
    Settings shows the username read-only (it is changed from the cloud account menu).
15. **In-memory rate limits** reset on restart and do not scale (fine for one server).
16. **Repo hygiene:** tracked junk at the root (`--full-page`, `.initial_snapshot.json`,
    `.zscripts/dev.pid`, screenshots, `upload/` PDF). Remove and extend `.gitignore`.
17. `next.config` ignores TypeScript errors: run `npx tsc --noEmit` before every release.
