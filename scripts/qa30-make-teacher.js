/* ساخت حساب استاد QA برای بستهٔ #30 — و پاک‌سازی کامل در پایان */
const { PrismaClient } = require("@prisma/client");
const { scrypt, randomBytes } = require("node:crypto");
const { promisify } = require("util");
const scryptAsync = promisify(scrypt);

const db = new PrismaClient();

async function hashPassword(password) {
  // فرمت s1 — دقیقاً مثل src/lib/auth.ts (پیشوند نسخه الزامی است)
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password.normalize("NFKC"), salt, 64));
  return `s1:${salt}:${derived.toString("hex")}`;
}

async function main() {
  const action = process.argv[2] || "create";
  const USERNAME = "qa30teacher";
  if (action === "create") {
    const exists = await db.user.findUnique({ where: { username: USERNAME } });
    if (exists) { console.log("already exists:", exists.id); return; }
    const u = await db.user.create({
      data: {
        username: USERNAME,
        passwordHash: await hashPassword("Qa30!TeacherPass"),
        role: "teacher",
        displayName: "استاد آزمون‌گری",
        bio: "حساب آزمون QA",
      },
    });
    console.log("created:", u.id);
  } else if (action === "cleanup") {
    const u = await db.user.findUnique({ where: { username: USERNAME } });
    if (!u) { console.log("no account"); return; }
    // ترتیب حذف: کامنت‌ها → پست → tcourse(کتابخانه/امتیاز) → کاربر
    const posts = await db.post.findMany({ where: { authorId: u.id }, select: { id: true } });
    for (const p of posts) {
      await db.comment.deleteMany({ where: { postId: p.id } });
      await db.post.delete({ where: { id: p.id } }).catch(() => {});
    }
    const tcs = await db.teacherCourse.findMany({ where: { teacherId: u.id }, select: { id: true } });
    for (const c of tcs) {
      await db.libraryEntry.deleteMany({ where: { courseId: c.id } });
      await db.rating.deleteMany({ where: { courseId: c.id } }).catch(() => {});
      await db.teacherCourse.delete({ where: { id: c.id } }).catch(() => {});
    }
    await db.session.deleteMany({ where: { userId: u.id } });
    await db.user.delete({ where: { id: u.id } }).catch(async () => {
      await db.userBlob.deleteMany({ where: { userId: u.id } });
      await db.user.delete({ where: { id: u.id } });
    });
    console.log("cleaned");
  }
}
main().finally(() => db.$disconnect());
