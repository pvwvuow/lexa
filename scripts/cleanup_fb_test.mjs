import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const u = await p.user.findUnique({ where: { username: "zz_test_pak" } });
if (u) {
  const fb = await p.lessonFeedback.deleteMany({ where: { userId: u.id } });
  const s = await p.session.deleteMany({ where: { userId: u.id } });
  const ls = await p.lessonState.deleteMany({ where: { userId: u.id } });
  await p.user.delete({ where: { id: u.id } });
  console.log(`cleaned: feedback=${fb.count} sessions=${s.count} states=${ls.count} user deleted`);
} else console.log("no test user found");
const left = await p.user.findMany({ select: { username: true, role: true } });
const fbs = await p.lessonFeedback.count();
console.log("users now:", JSON.stringify(left), "feedback rows:", fbs);
await p.$disconnect();
