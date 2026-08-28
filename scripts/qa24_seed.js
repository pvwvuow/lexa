/* ساخت حساب استاد تستی + مطلب + دوره برای QA بستهٔ #24 */
const BASE = "http://localhost:3000";

async function jf(path, init) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path}: ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  // ۱) ثبت‌نام استاد تستی
  let cookie = "";
  try {
    const reg = await jf("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username: "qa_teacher24", password: "Qa!242424", displayName: "استاد QA ۲۴", role: "teacher" }),
    });
    console.log("registered:", reg.user?.id ?? reg.id ?? "ok");
  } catch (e) {
    console.log("register skipped:", e.message);
  }
  const login = await jf("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "qa_teacher24", password: "Qa!242424" }),
  });
  cookie = (login.setCookie ?? "") || "";
  // استخراج کوکی از هدر واقعی — login ممکن است کوکی را در هدر بدهد
  const loginRes = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "qa_teacher24", password: "Qa!242424" }),
  });
  const setCookie = loginRes.headers.getSetCookie?.() ?? [];
  cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  console.log("login ok, cookie len:", cookie.length);

  // ۲) ویرایش مطلب تستی با آزمون (PUT = ویرایش)
  const post = await jf(`/api/posts/cmtcoclzw00qml5oiumo4gip6`, {
    method: "PUT",
    headers: { cookie },
    body: JSON.stringify({
      title: "مطلب تستی ۲۴ — ضمان دروغ در معامله",
      summary: "خلاصهٔ مطلب تستی برای QA حالت آفلاین.",
      tags: "تستی, ضمان",
      category: "tejarat",
      blocks: [
        { id: "b1", type: "intro", title: "", body: "متن آزمایشی مقدمه برای مطالعهٔ آفلاین." },
        { id: "b2", type: "law", title: "ماده ۳۳۸", body: "بیع عبارت است از تملیک عین به عوض معلوم." },
      ],
      quiz: [
        {
          id: "q1", q: "بیع عبارت است از؟",
          options: ["تملیک عین به عوض معلوم", "اجارهٔ منفعت", "هدیهٔ ساده", "قرض"],
          answer: "a",
          explanation: "ماده ۳۳۸ ق.م",
        },
      ],
    }),
  });
  console.log("post updated:", post.ok, post.id);

  // ۳) ساخت دورهٔ تستی
  const course = await jf("/api/tcourses", {
    method: "POST",
    headers: { cookie },
    body: JSON.stringify({
      id: "cmtcocm0n00qol5oi48t64vvh",
      title: "دورهٔ تستی ۲۴ — خیارات",
      tagline: "دورهٔ آزمایشی QA",
      description: "دورهٔ تستی برای بررسی دانلود آفلاین.",
      icon: "scale",
      category: "tejarat",
      status: "published",
      chapters: [
        {
          title: "فصل ۱ — خیار مجلس",
          subtitle: "شروع",
          lessons: [
            {
              id: "l1", title: "جلسهٔ ۱: مفهوم خیار", minutes: 10, status: "ready",
              sections: [{ id: "s1", type: "concept", title: "", body: "خیار یعنی اختیار فسخ." }],
              quiz: [{ id: "cq1", q: "خیار یعنی؟", options: ["اختیار فسخ", "ثبت", "اجاره", "قفل"], answer: "a", explanation: "تعریف ساده" }],
            },
          ],
          quiz: [{ id: "chq1", q: "خیار مجلس چه زمانی است؟", options: ["هنگام مذاکره", "بعد از عقد", "هرگز", "فقط نکاح"], answer: "a", explanation: "—" }],
        },
      ],
    }),
  });
  console.log("course updated:", course.ok);

  console.log("COOKIE=" + cookie);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
