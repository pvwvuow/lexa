// Raw SQL audit of posts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient({ datasources: { db: { url: "file:/home/z/my-project/db/custom.db" } } });
try {
  const posts = await prisma.$queryRawUnsafe(`SELECT id, title, thumbnail, createdAt, updatedAt, length(blocks) as blocksLen FROM Post ORDER BY createdAt DESC`);
  for (const p of posts) console.log(`${new Date(p.createdAt).toISOString().slice(0,16)} | thumb=${p.thumbnail ? p.thumbnail.slice(0,40) : "-"} | ${p.status ?? "-"} | blocks=${p.blocksLen} | ${p.id} | ${p.title.slice(0,55)}`);
} finally { await prisma.$disconnect(); }
