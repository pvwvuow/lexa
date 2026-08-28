import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const u = await db.user.findUnique({ where: { username: "qa_teacher24" }, select: { id: true } });
if (u) {
  await db.comment.deleteMany({ where: { userId: u.id } });
  await db.follow.deleteMany({ where: { OR: [{ studentId: u.id }, { teacherId: u.id }] } });
  await db.rating.deleteMany({ where: { userId: u.id } });
  await db.session.deleteMany({ where: { userId: u.id } });
  try { await db.user.delete({ where: { id: u.id } }); console.log("deleted ok"); }
  catch (e) { console.log("still err:", e.message.split("\n").slice(-3).join(" ").slice(0, 200)); }
} else console.log("already gone");
console.log("remaining qa users:", await db.user.count({ where: { username: { startsWith: "qa_" } } }));
await db.$disconnect();
