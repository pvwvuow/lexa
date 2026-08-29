// Audit DB read-only via Prisma client
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient({ datasources: { db: { url: "file:/home/z/my-project/db/custom.db" } } });
const m = prisma._dmmf ? null : null;
try {
  const models = Object.keys(prisma).filter(k => !k.startsWith("_") && typeof prisma[k] === "object" && prisma[k]?.findMany);
  console.log("MODELS:", models.join(", "));
  for (const name of ["post", "user", "course", "quizPack", "examPack"]) {
    if (!prisma[name]) continue;
    try {
      const caps = name.charAt(0).toUpperCase() + name.slice(1);
      const n = await prisma[name].count();
      console.log(`\n${caps}: ${n}`);
    } catch (e) { console.log(name, "count err:", e.message.split("\n")[0]); }
  }
  if (prisma.post) {
    const posts = await prisma.post.findMany({ orderBy: { createdAt: "desc" }, take: 15, select: { id: true, title: true, thumbnail: true, createdAt: true, status: true } }).catch(e => { console.log("post err", e.message.split("\n")[0]); return null; });
    if (posts) { console.log("\n--- POSTS (newest first) ---"); for (const p of posts) console.log(`${p.createdAt?.toISOString?.().slice(0, 16)} | thumb=${p.thumbnail ? "Y" : "n"} | ${p.status ?? "?"} | ${p.title?.slice(0, 55)}`); }
  }
  if (prisma.user) {
    const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 12 }).catch(e => { console.log("user err", e.message.split("\n")[0]); return null; });
    if (users) { console.log("\n--- USERS ---"); for (const u of users) console.log(`${u.role ?? "?"} | @${u.username} | ${u.displayName} | created ${u.createdAt?.toISOString?.().slice(0, 10)}`); }
  }
  if (prisma.course) {
    const courses = await prisma.course.findMany({ orderBy: { createdAt: "desc" }, take: 12, select: { id: true, title: true, createdAt: true, status: true } }).catch(e => { console.log("course err", e.message.split("\n")[0]); return null; });
    if (courses) { console.log("\n--- COURSES ---"); for (const c of courses) console.log(`${c.createdAt?.toISOString?.().slice(0, 16)} | ${c.status ?? "?"} | ${c.title?.slice(0, 55)}`); }
  }
} finally { await prisma.$disconnect(); }
