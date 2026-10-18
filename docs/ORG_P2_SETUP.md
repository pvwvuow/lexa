# Phase 2 - content visibility: setup, wiring and QA

Spec: `docs/ORG_LEARNING.md` (section «سطح دسترسی محتوا»). Needs phase 1 (006) in the database.

## 1. Database (once)
Run `supabase/007_content_visibility.sql` after 006 (safe to re-run). Every existing post and
course becomes `visibility = 'public'`, so nothing changes for current readers.

What it enforces (RLS, so every client and the web build get the same rules):
- `public` everyone; `users` signed-in; `org` official students with access right now
  (`lexa_org_official`), active teachers/managers of `org_id`, the author, Lexa admins;
  `draft` author + the centre's managers + Lexa admins.
- comments, ratings, rating/student counts and «add to library» follow the post/course.
- `lexa_org_course_previews(o, lim)` gives card data (no chapters) of `org` courses with
  `allow_preview = true`, for everyone.
- private bucket `lexa-org-media`: path `<org_id>/<user_id>/<file>`; upload by active centre
  members into their own folder; read by members + official students + admins (signed URLs).

## 2. Wiring for Z
1. **Cloud API handlers** (`src/lib/cloud-api/handlers.ts`): when creating / updating a post or
   teacher course, send `visibility` (and for courses `allow_preview`); keep `org_id` as today.
   In every course/post object returned to the UI add `_visibility`, `_orgId` (and `_orgName` if
   already embedded). A 0-row result for a hidden id must become the normal «not found» state.
2. **Studio editor** (`StudioWriteView.tsx`): render
   `<VisibilityPicker kind="post|course" value onChange orgId onOrgChange orgs={usePublishOrgs().orgs} allowPreview onAllowPreview />`
   and block saving when `visibilityProblem(v, orgId)` is not empty.
3. **Cards / headers** (course and post cards, `CourseView`, `PostView`): `<VisibilityBadge value={x._visibility} orgName={x._orgName} />`.
4. **Previews**: on the centre page (`OrgView`) and in the public library show `coursePreviews(org.id)`
   as locked cards with `previewLabel(orgName)`; opening one shows «این دوره مخصوص دانشجویان ... است»
   and, when signed out, the sign-in buttons (normal + «ورود با حساب مرکز»).
5. **Centre media**: when the item's visibility is `org`, upload images/files with
   `uploadOrgMedia(orgId, file, name)` (returns `lexa-org://...`) instead of the public bucket.
   Everywhere content media is rendered (LearnView, PostView, studio preview, thumbnails) resolve
   the src with `useMediaUrl(src)` (normal URLs pass through unchanged).
6. **Offline copies**: call `pruneLostAccess()` on app start and after every `onAuthChange`
   (signed out, suspended, graduated with «فقط محتوای عمومی», removed from centre → the cached
   org/users course disappears from this device). It never deletes on a failed check. Make sure
   cached course objects keep `_visibility` from item 1.
7. **Builds**: confirm no build step (web, APK, desktop, update feeds) fetches teacher/cloud content;
   only built-in Lexa content may be bundled.

New files: `supabase/007_content_visibility.sql`, `src/lib/cloud-api/visibility.ts`,
`src/components/app/VisibilityPicker.tsx` (exports `VisibilityPicker` and `VisibilityBadge`).

## 3. QA checklist
- Old posts/courses still show for guests on web, APK and desktop.
- Course set to «دانشجویان مرکز» of centre A: guest, free user and a manager of centre B see nothing
  (list, direct link, comments, ratings, add-to-library all refuse); an official student of A,
  a teacher of A and a Lexa admin see it.
- Same course with preview on: guest sees the locked card with «مخصوص دانشجویان A», never the lessons.
- Student of A set to graduated + «فقط محتوای عمومی» → course disappears (also the offline copy
  after the next start); set to «باز بماند» → visible again.
- Suspended student → no org content.
- «کاربران Lexa»: guest sees nothing, any signed-in user sees it.
- «پیش‌نویس» with centre A: author and A's managers see it, A's students do not.
- Saving «دانشجویان مرکز» without a centre is refused with a Persian message.
- An image uploaded to an org course opens for a student of A (signed URL) and fails for a free
  user; the raw storage URL without a signature does not open.
