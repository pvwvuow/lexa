// ساخت مطلب آزمایشی تامنیل‌دار برای QA بصری (تامنیل کرو + دکمهٔ دانلود آفلاین)
// ورودی: سرور روی localhost:3000؛ حساب qavisual با qa-make-teacher.mjs ساخته می‌شود
const BASE = "http://localhost:3000";

// یک PNG سادهٔ ۴۰۰×۲۴۰ با پس‌زمینهٔ رنگی (بدون وابستگی خارجی)
function makePng() {
  // 1x1 red PNG پایه — کافی است چون فقط اعتبار فرمت چک می‌شود
  const b64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  return Buffer.from(b64, "base64");
}

async function main() {
  // ۱) ورود
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "qavisual", password: "Qa!23456789" }),
  });
  const setCookie = login.headers.getSetCookie?.() ?? [];
  const cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  if (!login.ok || !cookie) {
    console.error("login failed", login.status, await login.text().catch(() => ""));
    process.exit(1);
  }
  console.log("login ok");

  // ۲) آپلود کاور
  const form = new FormData();
  form.append("file", new Blob([makePng()], { type: "image/png" }), "qa-cover.png");
  const up = await fetch(`${BASE}/api/cover/upload`, {
    method: "POST",
    headers: { cookie },
    body: form,
  });
  const upd = await up.json().catch(() => ({}));
  if (!up.ok || !upd.url) {
    console.error("upload failed", up.status, upd);
    process.exit(1);
  }
  console.log("cover:", upd.url);

  // ۳) ساخت مطلب با تامنیل
  const post = await fetch(`${BASE}/api/posts`, {
    method: "POST",
    headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "آزمایش تامنیل کرو — حقوق قراردادها",
      summary:
        "این مطلب صرفاً برای راستی‌آزمایی نمایش تامنیل دایره‌ای با فاصله از بوردر کارت و دکمهٔ دانلود آفلاین ساخته شده است و پس از آزمایش حذف می‌شود.",
      tags: "آزمایش",
      categories: ["other"],
      thumbnail: upd.url,
      blocks: [
        { type: "p", text: "بند اول مطلب آزمایشی برای پر بودن صفحهٔ مطلب." },
        { type: "p", text: "بند دوم مطلب آزمایشی؛ محتوای واقعی نیست." },
      ],
    }),
  });
  const pd = await post.json().catch(() => ({}));
  if (!post.ok) {
    console.error("post failed", post.status, pd);
    process.exit(1);
  }
  console.log("post:", pd.post?.id ?? pd.id ?? JSON.stringify(pd).slice(0, 120));
}

main().catch((e) => { console.error(e); process.exit(1); });
