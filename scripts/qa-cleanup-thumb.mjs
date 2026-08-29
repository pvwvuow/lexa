// پاک‌سازی کامل ردپای QA تامنیل: مطلب آزمایشی + فایل‌های کاور آزمایشی qavisual
import { PrismaClient } from "@prisma/client";
import { readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
const prisma = new PrismaClient({ datasources: { db: { url: "file:/home/z/my-project/db/custom.db" } } });
try {
  const u = await prisma.user.findUnique({ where: { username: "qavisual" } });
  if (!u) { console.log("no qavisual"); process.exit(0); }
  const posts = await prisma.post.findMany({ where: { authorId: u.id }, select: { id: true, title: true } });
  for (const p of posts) {
    await prisma.post.delete({ where: { id: p.id } });
    console.log("deleted post:", p.id, p.title.slice(0, 40));
  }
  const dir = "/home/z/my-project/data/uploads/covers";
  let n = 0;
  for (const f of readdirSync(dir)) {
    if (f.startsWith(u.id + "-")) { unlinkSync(join(dir, f)); n++; }
  }
  console.log("deleted cover files:", n);
  await prisma.comment.deleteMany({ where: { userId: u.id } });
  console.log("qa cleanup done");
} finally { await prisma.$disconnect(); }
