# Lexa security notes

Last review: 17 Oct 2026 (repo audit + audit of `supabase/002_cloud_social.sql`).

## Setup checklist (Supabase)

1. Run `supabase/002_cloud_social.sql`, then `supabase/003_security_fixes.sql`.
   If 002 is ever re-run, re-run 003 after it (002 ends with a broad
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

## Open (ordered by risk)

1. **Unsigned desktop update feed** (`electron/app-updater.js`): file hashes are checked,
   the manifest is not authenticated. Sign the manifest with Ed25519, embed the public key
   in the bootstrap, refuse unsigned/older manifests. The private key stays with the
   release machine (Z), never in the repo.
2. **Mutable content URLs:** lesson content and the update feed fall back to `@main` on
   jsDelivr/raw GitHub. Pin to release tags or commit hashes.
3. **Sync deletes resurrect:** SQLite `/api/user/sync` never deletes notes/marks and
   `mergeServerSnapshot` unions them; the Supabase blob is last-writer-wins on client
   clocks. Needs per-item `deletedAt` tombstones + server revisions (conditional writes).
4. **Exam history not in server sync:** `examAttempts` is missing from
   `buildSyncSnapshot()` and the Prisma schema.
5. **No CSP on static builds** (Pages/APK): add a reviewed meta CSP; reduce inline
   scripts in `layout.tsx`.
6. **Guest AI on the standalone server:** `/api/ai` accepts unauthenticated calls with an
   in-memory per-IP limit only. Decide: require a session, or add quotas.
7. **Supabase tokens and BYOK AI keys live in localStorage** (XSS impact). Keep the
   attack surface small (CSP), show a clear "stored on this device" note for AI keys.
8. **In-memory rate limits** reset on restart and do not scale (fine for one server).
9. **Repo hygiene:** tracked junk at the root (`--full-page`, `.initial_snapshot.json`,
   `.zscripts/dev.pid`, screenshots, `upload/` PDF). Remove and extend `.gitignore`.
10. `next.config` ignores TypeScript errors: run `npx tsc --noEmit` before every release.
