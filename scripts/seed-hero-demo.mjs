// بذر ۳ مطلب نمایشی برای استاد دمو در DB محلی توسعه — فقط برای ارزیابی بصری هیرو
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient({ datasources: { db: { url: "file:/home/z/my-project/db/custom.db" } } });

const blocks = (text) => [
  { type: "text", md: text },
  { type: "qa", q: "منظور از «اصاله اللزوم» چیست؟", a: "هر جا اشتغال ذهنی به چیزی بدون دلیل باشد، اصل بر الزام آن است." },
];

try {
  let teacher = await prisma.user.findUnique({ where: { username: "demo-ostad" } });
  if (!teacher) {
    teacher = await prisma.user.create({
      data: { username: "demo-ostad", passwordHash: "-", role: "teacher", displayName: "استاد محمدی" },
    });
  }
  const existing = await prisma.post.count({ where: { authorId: teacher.id } });
  if (existing > 0) { console.log("seed already:", existing); process.exit(0); }

  await prisma.post.createMany({
    data: [
      { authorId: teacher.id, title: "اصاله اللزوم و اشتغال ذهنی؛ دو قاعدهٔ کلیدی در فقه معاملات", summary: "در این مطلب با مثال‌های ساده دید می‌کنیم که اصل در معاملات، لزوم است نه فساد؛ و چطور اشتغال ذهنی اثبات را جابه‌جا می‌کند. برای آزمون وکالت این دو قاعده را با هم تمرین می‌کنیم.", category: "tejarat", categories: JSON.stringify(["tejarat"]), blocks: blocks("متن درس آزمایشی دربارهٔ اصاله اللزوم و اشتغال ذهنی با چند مثال کاربردی برای فهم بهتر قواعد فقه معاملات."), commentsCount: undefined },
      { authorId: teacher.id, title: "روش مطالعهٔ آیین دادرسی مدنی در سی روز", summary: "برنامهٔ روزشمار مطالعهٔ دادرسی مدنی با تاکید بر مواد پرتکرار آزمون و تمرین کیس‌های واقعی دادگاه.", category: "ayin-dadresi", categories: JSON.stringify(["ayin-dadresi"]), blocks: blocks("برنامهٔ مطالعهٔ سی‌روزهٔ دادرسی مدنی.") },
      { authorId: teacher.id, title: "ده اشتباه رایج داوطلبان آزمون وکالت", summary: "از مدیریت زمان تا تحلیل سوالات؛ رایج‌ترین خطاهایی که نمرهٔ داوطلبان را می‌سوزاند و راه سادهٔ اصلاح هرکدام.", category: "azmoon-vekalat", categories: JSON.stringify(["azmoon-vekalat"]), blocks: blocks("اشتباهات رایج آزمون وکالت.") },
    ],
  });
  console.log("seeded 3 posts");
} finally { await prisma.$disconnect(); }
