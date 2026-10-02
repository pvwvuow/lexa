// بررسی پایگاه داده: دوره‌های استاد، حساب‌های تازه، کتابخانه و builtinHidden
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const tcs = await db.teacherCourse.findMany({
  select: { id: true, title: true, status: true, teacherId: true, updatedAt: true },
  orderBy: { updatedAt: "desc" },
  take: 15,
});
console.log("== TeacherCourse ==");
for (const t of tcs) console.log(`${t.id} | ${t.title} | ${t.status}`);

const users = await db.user.findMany({
  orderBy: { createdAt: "desc" },
  take: 8,
  select: { id: true, username: true, role: true, createdAt: true },
});
console.log("\n== Users (newest) ==");
for (const u of users) {
  const [lib, hid, blob] = await Promise.all([
    db.libraryEntry.count({ where: { userId: u.id } }),
    db.builtinHidden.count({ where: { userId: u.id } }),
    db.userBlob.findUnique({ where: { userId: u.id }, select: { builtinSeeded: true } }).catch(() => null),
  ]);
  console.log(`${u.username} | role=${u.role} | ${u.createdAt.toISOString()} | libEntries=${lib} | hiddenBuiltins=${hid} | seeded=${blob?.builtinSeeded}`);
}

console.log("\n== builtinHidden sample ==");
const bh = await db.builtinHidden.findMany({ take: 5, select: { userId: true, courseId: true } });
for (const h of bh) console.log(h.userId, h.courseId);

await db.$disconnect();
