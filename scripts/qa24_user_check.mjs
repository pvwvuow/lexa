import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
try {
  const u = await db.user.delete({ where: { username: "qa_teacher24" } });
  console.log("deleted:", u.username);
} catch (e) {
  console.log("err:", e.message.slice(0, 120));
}
const cnt = await db.user.count({ where: { username: { startsWith: "qa_" } } });
console.log("remaining qa users:", cnt);
await db.$disconnect();
