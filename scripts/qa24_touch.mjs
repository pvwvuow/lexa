const BASE = "http://localhost:3000";
const login = await fetch(BASE + "/api/auth/login", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "qa_teacher24", password: "Qa!242424" }),
});
const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
const res = await fetch(BASE + "/api/posts/cmtcoclzw00qml5oiumo4gip6", {
  method: "PUT", headers: { "Content-Type": "application/json", cookie },
  body: JSON.stringify({
    title: "مطلب تستی ۲۴ — ضمان دروغ در معامله",
    summary: "خلاصهٔ مطلب تستی برای QA حالت آفلاین (ویرایش دوم).",
    tags: "تستی, ضمان", category: "tejarat",
    blocks: [
      { id: "b1", type: "intro", title: "", body: "متن آزمایشی مقدمه برای مطالعهٔ آفلاین — نسخهٔ ویرایش دوم." },
      { id: "b2", type: "law", title: "ماده ۳۳۸", body: "بیع عبارت است از تملیک عین به عوض معلوم." },
    ],
    quiz: [{ id: "q1", q: "بیع عبارت است از؟", options: ["تملیک عین به عوض معلوم", "اجارهٔ منفعت", "هدیهٔ ساده", "قرض"], answer: "a", explanation: "ماده ۳۳۸ ق.م" }],
  }),
});
console.log("edited:", res.status);
