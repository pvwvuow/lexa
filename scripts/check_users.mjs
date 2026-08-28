import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const u = await p.user.findMany({ select: { username: true, role: true, id: true } });
console.log(JSON.stringify(u, null, 1));
await p.$disconnect();
