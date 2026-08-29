import { PrismaClient } from "@prisma/client";
const p = new PrismaClient({ datasources: { db: { url: "file:/home/z/my-project/db/custom.db" } } });
const posts = await p.$queryRawUnsafe(`SELECT id, title, substr(coalesce(thumbnail,''),1,60) AS thumb, createdAt, authorId FROM Post ORDER BY createdAt DESC`);
console.log(JSON.stringify(posts, null, 2));
const users = await p.$queryRawUnsafe(`SELECT id, username, role, substr(coalesce(avatarUrl,''),1,50) AS avatar FROM User`);
console.log(JSON.stringify(users, null, 2));
await p.$disconnect();
