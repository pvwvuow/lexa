import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const u = await db.user.findUnique({ where: { username: "qa_teacher24" }, select: { id: true } });
if (u) {
  await db.comment.deleteMany({ where: { userId: u.id } });
  await db.follow.deleteMany({ where: { OR: [{ followerId: u.id }, { followingId: u.id }] } }).catch(()=>null);
  await db.rating.deleteMany({ where: { userId: u.id } }).catch(()=>null);
  await db.session.deleteMany({ where: { userId: u.id } }).catch(()=>null);
  await db.notification.deleteMany({ where: { OR: [{ userId: u.id }, { actorId: u.id }] } }).catch(()=>null);
  await db.socialPost.deleteMany({ where: { authorId: u.id } }).catch(()=>null);
  try { await db.user.delete({ where: { id: u.id } }); console.log("deleted ok"); }
  catch (e) { console.log("still err:", e.message.split("\n").pop()?.slice(0, 150)); }
}
console.log("remaining qa users:", await db.user.count({ where: { username: { startsWith: "qa_" } } }));
await db.$disconnect();
