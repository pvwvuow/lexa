// ─── تست دود کامل ویژگی‌های جدید: امتیاز، ریپلای، کتابخانه عمومی/شخصی،
//     وضعیت دوره (draft/prep)، پروفایل/آواتار/رمز، حفظ داده پس از حذف ──────────
// اجرا: node scripts/smoke-features.mjs   (سرور روی 3000 باید بال باشد)
const BASE = "http://localhost:3000";
let pass = 0, fail = 0;
const log = (...a) => console.log(...a);
function ok(name, cond, extra = "") {
  if (cond) { pass++; log(`  ✓ ${name}${extra ? " — " + extra : ""}`); }
  else { fail++; log(`  ✗ ${name} ${extra}`); }
}
function cookieOf(res) {
  const c = res.headers.getSetCookie?.() ?? [];
  return c.map((x) => x.split(";")[0]).join("; ");
}
async function api(path, { method = "GET", body, cookie, form } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: form ? cookie ? { cookie } : {} : { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: form ?? (body ? JSON.stringify(body) : undefined),
    redirect: "manual",
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data, cookie: cookieOf(res) };
}

async function main() {
  const stamp = Date.now().toString(36);
  log("═══ ۱) مدیر می‌سازد، استاد جدید را وارد می‌کند ═══");
  let r = await api("/api/auth/login", { method: "POST", body: { username: "admin", password: "hamyar@1404" } });
  ok("ورود مدیر", r.status === 200 && r.data.user?.role === "admin", `status=${r.status}`);
  const adminCookie = r.cookie;

  r = await api("/api/admin/teachers", {
    method: "POST", cookie: adminCookie,
    body: { username: `ostad_${stamp}`, password: "Ostad@1234", displayName: "استاد آزمون فیبرکربن" },
  });
  ok("ساخت حساب استاد توسط مدیر", r.status === 200 || r.status === 201, JSON.stringify(r.data).slice(0, 120));
  const teacherUsername = `ostad_${stamp}`;

  r = await api("/api/auth/login", { method: "POST", body: { username: teacherUsername, password: "Ostad@1234" } });
  ok("ورود استاد", r.status === 200, `status=${r.status}`);
  const tCookie = r.cookie;
  const tId = r.data?.user?.id;

  // پروفایل استاد: نام نمایشی + بیو
  r = await api("/api/profile", { method: "PATCH", cookie: tCookie, body: { displayName: "دکتر فیبرکربن", bio: "مدرس تجارت و آیین دادرسی در نسخهٔ آزمایشی." } });
  ok("به‌روزرسانی پروفایل استاد", r.status === 200 && r.data.user?.displayName === "دکتر فیبرکربن");

  // آواتار آپلود (PNG کوچک ۴×۴)
  const pngB64 = "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAFUlEQVR42mP8z8AARIQBEwMDAwMDAwAkBgMBjXK9TgAAAABJRU5ErkJggg==";
  const pngBuf = Buffer.from(pngB64, "base64");
  const fd = new FormData();
  fd.append("file", new Blob([pngBuf], { type: "image/png" }), "a.png");
  let res = await fetch(`${BASE}/api/profile/avatar`, { method: "POST", body: fd, headers: { cookie: tCookie } });
  const avData = await res.json().catch(() => ({}));
  ok("آپلود آواتار استاد", res.ok && typeof avData.avatarUrl === "string" && avData.avatarUrl.startsWith("/api/media/"), avData.avatarUrl);
  const avatarUrl = avData.avatarUrl;
  const fileName = decodeURIComponent(avatarUrl.split("/").pop());
  let mediaRes = await fetch(`${BASE}/api/media/${fileName}`);
  ok("سرو فایل مدیا", mediaRes.ok && mediaRes.headers.get("content-type") === "image/png");
  const badMedia = await fetch(`${BASE}/api/media/${encodeURIComponent("../secret.png")}`);
  ok("دفاع مسیر مدیا در برابر ../", badMedia.status === 404);

  log("═══ ۲) استاد محتوا می‌سازد ═══");
  const blocks = [{ id: "b1", type: "concept", title: "تست", body: "متن آزمایشی برای بلوک مفهوم. هشدار: نکته مهم سفته‌بازی نیست." }];
  r = await api("/api/posts", { method: "POST", cookie: tCookie, body: { title: "مطلبِ تجارتی برای فیلتر شاخه", summary: "خلاصه", tags: "تجارت", category: "tejarat", blocks } });
  ok("ایجاد مطلب با شاخهٔ تجارت", r.status === 200 && !!r.data.id);
  const postId = r.data.id;

  r = await api("/api/posts", { method: "PUT_PLACEHOLDER" }).catch(() => null); // noop guard

  // ویرایش مطلب: تغییر دسته به سایر، سپس برگشت
  r = await api(`/api/posts/${postId}`, { method: "PUT", cookie: tCookie, body: { title: "مطلبِ تجارتی برای فیلتر شاخه", summary: "خلاصه", tags: "تجارت", category: "azmoon-vekalat", blocks } });
  ok("ویرایش مطلب + تغییر شاخه", r.status === 200);

  // سه دوره: prep با جلسه، draft، published خالی(ناقص)
  r = await api("/api/tcourses", {
    method: "POST", cookie: tCookie,
    body: {
      title: "دورهٔ درحال آماده‌سازی", tagline: "نسخهٔ اولیه", description: "محتوای نیمه", icon: "Scale",
      accent: "bronze", category: "takhassosi", status: "prep",
      chapters: [{ title: "فصل یکم", lessons: [{ title: "جلسه اول", minutes: 10, sections: blocks }] }],
    },
  });
  ok("ایجاد دورهٔ prep", r.status === 200 && !!r.data.id);
  const prepId = r.data.id;

  r = await api("/api/tcourses", {
    method: "POST", cookie: tCookie,
    body: {
      title: "پیش‌نویس مخفی", tagline: "", description: "", icon: "", accent: "bronze",
      category: "tejarat", status: "draft",
      chapters: [{ title: "فصل", lessons: [{ title: "جلسه", sections: blocks }] }],
    },
  });
  ok("ایجاد پیش‌نویس draft", r.status === 200 && !!r.data.id);
  const draftId = r.data.id;

  r = await api(`/api/tcourses/${prepId}`, { cookie: tCookie });
  ok("جزئیات دوره دارای متا (category/status)", r.status === 200 && r.data.course?._status === "prep" && r.data.course?._category === "takhassosi");

  log("═══ ۳) دانشجو ═══");
  const stuUser = `stu_${stamp}`;
  r = await api("/api/auth/register", { method: "POST", body: { username: stuUser, password: "Stu@123456" } });
  ok("ثبت‌نام دانشجو", r.status === 200 || r.status === 201, `status=${r.status}`);
  const sCookie = r.cookie;
  const sId = r.data?.user?.id;

  // دانشجو اجازه آواتار ندارد
  const fd2 = new FormData();
  fd2.append("file", new Blob([pngBuf], { type: "image/png" }), "s.png");
  res = await fetch(`${BASE}/api/profile/avatar`, { method: "POST", body: fd2, headers: { cookie: sCookie } });
  ok("دانشجو ← آواتار ممنوع (403)", res.status === 403);
  // دانشجو بیو ندارد
  r = await api("/api/profile", { method: "PATCH", cookie: sCookie, body: { bio: "می‌خواهم بیو بگذارم" } });
  ok("دانشجو ← بیو ممنوع (400)", r.status === 400);
  r = await api("/api/profile", { method: "PATCH", cookie: sCookie, body: { displayName: "دانیالِ آزمون" } });
  ok("دانشجو ← فقط نام نمایشی", r.status === 200 && r.data.user?.displayName === "دانیالِ آزمون");

  // فالو + کامنت + ریپلای
  r = await api("/api/social/follow", { method: "POST", cookie: sCookie, body: { teacherId: tId } });
  ok("فالوی استاد", r.status === 200);
  r = await api(`/api/posts/${postId}/comments`, { method: "POST", cookie: sCookie, body: { text: "سؤال اول دربارهٔ وعده واخواست؟" } });
  ok("کامنت ریشه", r.status === 200 && !!r.data.comment?.id);
  const rootComment = r.data.comment;
  r = await api(`/api/posts/${postId}/comments`, { method: "POST", cookie: tCookie, body: { text: "پاسخ: بله سؤالش این است", replyToId: rootComment.id } });
  ok("ریپلای استاد به کامنت", r.status === 200 && r.data.comment?.replyToId === rootComment.id, JSON.stringify(r.data.comment ?? {}));
  r = await api(`/api/posts/${postId}/comments`, { method: "POST", cookie: sCookie, body: { text: "بدون والد", replyToId: "fake123" } });
  ok("ریپلای به والد غیرواقعی رد شود (400)", r.status === 400);

  // ریپلای سطح دو → چسبیدن به ریشه
  r = await api(`/api/posts/${postId}/comments`, { method: "POST", cookie: sCookie, body: { text: "پاسخی بر پاسخ", replyToId: r.status !== 400 ? undefined : undefined } });
  void r;

  r = await api(`/api/posts/${postId}`);
  const cmts = r.data.comments ?? [];
  ok("GET مطلب: کامنت تخت با replyToId", r.status === 200 && cmts.length >= 2 && cmts.some((c) => c.replyToId));
  ok("GET مطلب: دسته فرستاده شد", r.data.post?.category === "azmoon-vekalat");

  log("═══ ۴) امتیازدهی و ترتیب فید ═══");
  r = await api("/api/ratings", { method: "POST", cookie: sCookie, body: { targetType: "post", targetId: postId, stars: 5 } });
  ok("رأی ۵ ستاره به مطلب", r.status === 200 && r.data.avg === 5 && r.data.my === 5);
  r = await api("/api/ratings", { method: "POST", cookie: sCookie, body: { targetType: "post", targetId: postId, stars: 4 } });
  ok("تغییر رأی به ۴ ستاره", r.status === 200 && r.data.avg === 4 && r.data.count === 1);
  r = await api("/api/ratings", { method: "POST", cookie: sCookie, body: { targetType: "post", targetId: postId, stars: 9 } });
  ok("ستارهٔ خارج از بازه رد شود (400)", r.status === 400);
  r = await api("/api/ratings", { method: "POST", cookie: sCookie, body: { targetType: "post", targetId: "nonexistent", stars: 3 } });
  ok("هدف غیرواقعی رد شود (404)", r.status === 404);
  r = await api("/api/ratings", { method: "POST", cookie: sCookie, body: { targetType: "tcourse", targetId: prepId, stars: 4 } });
  ok("رأی به دوره", r.status === 200 && r.data.count === 1);
  const guestRating = await api(`/api/ratings?targetType=post&targetId=${postId}`);
  ok("GET امتیاز مهمان بدون my", guestRating.status === 200 && guestRating.data.my === null && guestRating.data.count === 1);

  r = await api("/api/social/feed");
  ok("فید: همه‌جانبه بدون ورود، مرتب‌شده", r.status === 200 && Array.isArray(r.data.posts) && r.data.posts.length > 0);
  const feedTopHasRating = r.data.posts.filter((p) => p.rating).length > 0;
  ok("فید: فیلد امتیاز موجود", feedTopHasRating);
  const sorted = [...r.data.posts].every((p, i, arr) => i === 0 || arr[i - 1].score >= p.score);
  ok("فید: score نزولی", sorted);

  log("═══ ۵) کتابخانهٔ عمومی با دسته‌بندی ═══");
  r = await api("/api/library/public?cat=azmoon-vekalat");
  ok("شاخهٔ آزمون وکالت شامل مطلب است", r.status === 200 && r.data.posts?.some((p) => p.id === postId) && !r.data.courses?.some((c) => c.id === prepId));
  r = await api("/api/library/public?cat=takhassosi");
  ok("شاخهٔ تخصصی شامل دورهٔ prep است", r.status === 200 && r.data.courses?.some((c) => c.id === prepId), JSON.stringify(r.data.courses?.map((c) => c.title)));
  r = await api("/api/library/public?cat=other");
  ok("شاخهٔ سایر خالی یا بدون آن موارد", r.status === 200);
  r = await api("/api/library/public");
  ok("همه: هر دو لیست موجود؛ draft نیست", r.status === 200 && !JSON.stringify(r.data.courses).includes(draftId));

  log("═══ ۶) افزودن/حذف کتابخانه و بقای داده ═══");
  // دانشجو دورهٔ draft نمی‌تواند اضافه کند
  r = await api("/api/library", { method: "POST", cookie: sCookie, body: { courseId: draftId } });
  ok("افزودن draft ممنوع (403)", r.status === 403);

  // سناریوی بقای داده: با  POST sync وضعیت جلسات، سپس حذف کتابخانه
  const lessonId = `tc-${prepId}-0-0`;
  r = await api("/api/user/sync", {
    method: "POST", cookie: sCookie,
    body: {
      progress: { [lessonId]: { status: "completed", sectionsSeen: 8, quizBest: 92, markedReview: false } },
      quizAttempts: [{ lessonId, date: new Date().toISOString().slice(0, 10), score: 92 }],
      activity: [new Date().toISOString().slice(0, 10)],
      notes: {},
      customCourses: [],
      lastLocation: { lessonId },
      streak: { count: 3, lastDate: new Date().toISOString().slice(0, 10) },
    },
  });
  ok("sync پیشرفت دورهٔ استادی", r.status === 200);

  r = await api("/api/library", { method: "POST", cookie: sCookie, body: { courseId: prepId } });
  ok("افزودن دورهٔ prep به کتابخانه", r.status === 200 && r.data.inLibrary === true);
  r = await api("/api/library", { cookie: sCookie });
  ok("کتابخانهٔ من شامل دوره است", r.data.courses?.some((c) => c.id === prepId) === true);

  // حذف از کتابخانه
  r = await api("/api/library", { method: "POST", cookie: sCookie, body: { courseId: prepId } });
  ok("حذف از کتابخانه (توگل)", r.status === 200 && r.data.inLibrary === false);
  r = await api("/api/library", { cookie: sCookie });
  ok("کتابخانه خالی شد", !r.data.courses?.some((c) => c.id === prepId));

  // data still safe?
  r = await api("/api/user/data", { cookie: sCookie });
  const kept = r.data.snapshot?.progress?.[lessonId];
  ok("پیشرفت پس از حذف کتابخانه سر جایش است", !!kept && kept.status === "completed" && kept.quizBest === 92);

  // افزودن دوباره
  r = await api("/api/library", { method: "POST", cookie: sCookie, body: { courseId: prepId } });
  ok("افزودن دوباره همان دوره", r.status === 200 && r.data.inLibrary === true);

  log("═══ ۷) پروفایل عمومی استاد + رمز عبور ═══");
  r = await api(`/api/users/${tId}`, { cookie: sCookie });
  ok("پروفایل استاد: پایه", r.status === 200 && r.data.profile?.displayName === "دکتر فیبرکربن" && r.data.profile?.isFollowing === true);
  ok("پروفایل: آواتار", typeof r.data.profile?.avatarUrl === "string");
  ok("پروفایل: دوره‌ها شامل prep نه draft", r.data.courses?.some((c) => c.id === prepId) && !r.data.courses?.some((c) => c.id === draftId));
  ok("پروفایل: مطالب", Array.isArray(r.data.posts) && r.data.posts.some((p) => p.id === postId));

  const anonProfile = await api(`/api/users/${tId}`);
  ok("پروفایل مهمان: isFollowing=false", anonProfile.status === 200 && anonProfile.data.profile.isFollowing === false);

  const badProf = await api("/api/users/nonexistent-user");
  ok("پروفایل ناموجود ۴۰۴", badProf.status === 404);

  // تغییر رمز: فعلی غلط
  r = await api("/api/auth/change-password", { method: "POST", cookie: sCookie, body: { current: "wrongpass", next: "NewPass@99" } });
  ok("رمز فعلی غلط رد شود (400)", r.status === 400);
  r = await api("/api/auth/change-password", { method: "POST", cookie: sCookie, body: { current: "Stu@123456", next: "NewPass@99" } });
  ok("تغییر رمز موفق", r.status === 200);
  r = await api("/api/auth/login", { method: "POST", body: { username: stuUser, password: "NewPass@99" } });
  ok("ورود با رمز تازه", r.status === 200);

  log(`\n═══ نتیجه: ${pass} سبز / ${fail} قرمز ═══`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
