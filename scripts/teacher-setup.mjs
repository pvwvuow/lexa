// ─── ساخت اکانت‌های استاد + دوره‌هایشان در DB اپ Lexa ─────────────────────────
// اکانت‌ها: ghayebi (مدنی ۷) و hassanzadeh (تجارت ۲) — role=teacher
// هش پسورد دقیقاً مطابق src/lib/auth.ts (s1:salt:scrypt-hex)
import { randomBytes, scrypt as _scrypt } from "node:crypto";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const scrypt = promisify(_scrypt);
const db = new PrismaClient();

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password.normalize("NFKC"), salt, 64);
  return `s1:${salt}:${derived.toString("hex")}`;
}

const T2 = (await import("./t2-lesson.mjs")).T2_COURSE;

// ── دورهٔ غایبی از پک موجود (همان محتوای جلسهٔ ۱ مدنی ۷) ──
const PACK_PATH = "updates/packs/course-tadris-madani7-ghayebi-03.json";
const pack = JSON.parse(readFileSync(PACK_PATH, "utf8")).payload;
const MD7 = {
  title: "تدریس مدنی ۷ — استاد غایبی",
  tagline: pack.tagline,
  description:
    (pack.description || "") +
    (pack.sourceLabel ? `\n\nمنبع: ${pack.sourceLabel}` : ""),
  icon: pack.icon || "BookOpen",
  accent: pack.accent || "green",
  categories: ["takhassosi"],
  chapters: pack.chapters,
};

const TEACHERS = [
  {
    username: "ghayebi",
    password: "Ghayebi1404",
    displayName: "استاد غایبی",
    bio: "استاد درس حقوق مدنی ۷ (عقود معیّن: عقود اذنی، وثیقه‌ای و مشارکتی). پیاده‌سازی کلاس‌های حضوری ایشان — ضبط کلاس با هوش مصنوعی به متن تبدیل، حاشیه‌های غیردرسی حذف و مطالب بازآرایی و ویرایش شده — در همین پروفایل منتشر می‌شود.",
    course: MD7,
  },
  {
    username: "hassanzadeh",
    password: "Hassanzadeh1404",
    displayName: "استاد حسن‌زاده",
    bio: "استاد درس حقوق تجارت ۲ (شرکت‌های تجاری). خلاصهٔ جلسات کلاس ایشان — پیاده‌سازی صوتی، بازآرایی و راستی‌آزمایی ماده‌به‌ماده با نصّ قانون — در همین پروفایل منتشر می‌شود.",
    course: T2,
  },
];

function coursePayload(c) {
  return {
    title: c.title,
    tagline: c.tagline,
    description: c.description,
    icon: c.icon,
    accent: c.accent,
    categories: c.categories,
    status: "published",
    chapters: c.chapters,
  };
}

async function main() {
  const report = [];
  for (const t of TEACHERS) {
    // اکانت استاد
    let user = await db.user.findUnique({ where: { username: t.username } });
    if (!user) {
      user = await db.user.create({
        data: {
          username: t.username,
          passwordHash: await hashPassword(t.password),
          role: "teacher",
          displayName: t.displayName,
          bio: t.bio,
        },
      });
      report.push(`+ اکانت ساخته شد: ${t.username} → «${t.displayName}»`);
    } else {
      await db.user.update({
        where: { id: user.id },
        data: { role: "teacher", displayName: t.displayName, bio: t.bio },
      });
      report.push(`= اکانت موجود به‌روز شد: ${t.username}`);
    }

    // دورهٔ استاد (بدون ساخت تکراری)
    const existing = await db.teacherCourse.findFirst({
      where: { teacherId: user.id, title: t.course.title },
      select: { id: true },
    });
    if (!existing) {
      const created = await db.teacherCourse.create({
        data: {
          teacherId: user.id,
          title: t.course.title,
          tagline: t.course.tagline,
          description: t.course.description,
          icon: t.course.icon,
          accent: t.course.accent,
          categories: JSON.stringify(t.course.categories),
          status: "published",
          chaptersJson: JSON.stringify(t.course.chapters),
          publishedAt: new Date(),
        },
      });
      const lessons = t.course.chapters.reduce((n, c) => n + (c.lessons?.length || 0), 0);
      report.push(`+ دورهٔ ساخته شد: «${t.course.title}» (id=${created.id}, ${t.course.chapters.length} فصل، ${lessons} جلسه)`);
    } else {
      report.push(`= دورهٔ موجود: «${t.course.title}» (id=${existing.id}) — دست نزدیم`);
    }
  }
  console.log(report.join("\n"));
}

main()
  .catch((e) => { console.error("ERROR:", e.message); process.exitCode = 1; })
  .finally(() => db.$disconnect());
