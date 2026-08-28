import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const ids = ["cmtcoclzw00qml5oiumo4gip6", "cmtcog1st00u6l5oizq6ytsg1"];
const dp = await db.post.deleteMany({ where: { id: { in: ids } } });
const dc = await db.teacherCourse.deleteMany({ where: { id: "cmtcocm0n00qol5oi48t64vvh" } });
const dl = await db.libraryEntry.deleteMany({ where: { courseId: "cmtcocm0n00qol5oi48t64vvh" } });
const u = await db.user.delete({ where: { username: "qa_teacher24" } }).catch(() => null);
console.log({ posts: dp.count, courses: dc.count, lib: dl.count, user: u?.username ?? null });
await db.$disconnect();
