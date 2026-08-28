// تست grounding استاد — خودکفا (بدون import از TS پروژه)
const SECTIONS = [
  { title: "هدف جلسه", body: "چك پرکاربردترین سند تجاری زندگی ایرانی است؛ اما همین آشنایی ظاهری باعث خطاهای بزرگی در آزمون و عمل میشود. این جلسه تعریف دقیق چك، سه شرط ذاتی آن و تفکیک چهار نوع رسمی چك را کامل جا میاندازد." },
  { title: "چیستی چك", body: "چک نوشته‌ای است که صادرکننده به موجب آن از حساب خود نزد بانک، وجهی را به گیرنده یا حامل میپردازد. سه شرط «ذاتی»: ۱) وجود وجه قابل برداشت نزد بانک ۲) موجود بودن خود حساب ۳) اهلیت و اختیار کامل صادرکننده برای صدور. در ماده ۳۱۱ صریحاً چك فقط با امضا امکانپذیر است؛ برخلاف برات (ماده ۲۲۳) و سفته (ماده ۳۰۸)." },
  { title: "مستند قانونی", law: [
      { no: "۳۱۱", source: "قانون تجارت", text: "صدور چک تنها با امضای صادرکننده ممکن است؛ برخلاف برات و سفته، مهرِ تنها کافی نیست." },
      { no: "۳۱۲ به بعد", source: "قانون تجارت (نکته کاربردی)", text: "در مورد جنبه‌های چكهای بانکی توسط قانون خاص (قانون صدور چك مصوب ۱۳۵۵ و اصلاحات بعدی) تکلیف جداگانه تنظیم شده است." },
    ], body: "چهار نوع چك طبقهبندی مشهور: چك عادی، چك تأییدشده، چك تضمینشده، چك مسافرتی." },
  { title: "جمع‌بندی", bullets: ["سه شرط ذاتی چك: وجود وجه، موجودیت حساب، اختیار کامل صادرکننده.", "چك فقط با امضا؛ برات و سفته حتی با مهر تنها هم قابل صدورند (مواد ۲۲۳ و ۳۰۸).", "چكهای بانکی (تضمینشده و مسافرتی) جنبه کیفری ندارند."] },
];

const lawRegistry = [];
const parts = SECTIONS.map((s) => {
  const chunks = [`## ${s.title}`];
  if (s.body) chunks.push(s.body);
  if (s.bullets) chunks.push(s.bullets.map((b) => "- " + b).join("\n"));
  if (s.law) for (const l of s.law) {
    chunks.push(`📜 مادهٔ ${l.no} — ${l.source}: ${l.text}`);
    lawRegistry.push(`مادهٔ ${l.no} — ${l.source}`);
  }
  return chunks.join("\n");
});
const extra = parts.join("\n\n").slice(0, 6000);

async function ask(question, label) {
  const res = await fetch("http://localhost:3000/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      task: "free", mode: "QA", question,
      context: {
        courseTitle: "حقوق تجارت ۳", chapterTitle: "فصل ۲ — چك",
        lessonTitle: "چك؛ تعریف، شرایط اساسی و چهار نوع",
        seenSections: SECTIONS.map((s) => s.title),
        extra, lawRegistry,
      },
    }),
  });
  const json = await res.json();
  console.log(`\n===== ${label} =====\nQ: ${question}\nA: ${(json.text ?? JSON.stringify(json)).slice(0, 800)}\n`);
}

await ask("ماده ۲۴۴ قانون تجارت درباره چک دقیقاً چه می‌گوید؟", "تست ۱: مادهٔ ناموجود در جلسه — نباید جعل کند");
await ask("چرا چک با مهر تنها صادر نمی‌شود؟", "تست ۲: سؤال داخل جلسه — باید دقیق با مادهٔ ۳۱۱ پاسخ دهد");
