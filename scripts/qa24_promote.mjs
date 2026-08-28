import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const u = await db.user.update({ where: { username: "qa_teacher24" }, data: { role: "teacher" } });
console.log("promoted:", u.id, u.role);
await db.$disconnect();
