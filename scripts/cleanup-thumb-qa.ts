// پاک‌سازی داده‌های QA تامنیل — مطلب، فایل جلد، نشست و حساب آزمایشی
import { PrismaClient } from "@prisma/client";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

const db = new PrismaClient();
const USERNAMES = ["qa_thumb_probe", "qa_thumb_t31", "qa_thumb_probe"];

async function main() {
  for (const username of USERNAMES) {
    const u = await db.user.findUnique({ where: { username } });
    if (!u) { console.log(`skip ${username}`); continue; }
    // مطالب استاد آزمایشی
    const posts = await db.post.findMany({ where: { authorId: u.id }, select: { id: true, thumbnail: true } });
    for (const p of posts) {
      await db.comment.deleteMany({ where: { postId: p.id } });
      await db.rating.deleteMany({ where: { targetType: "post", targetId: p.id } }).catch(() => {});
      await db.post.delete({ where: { id: p.id } });
      console.log(`deleted post ${p.id}`);
      if (p.thumbnail && p.thumbnail.startsWith("/api/cover/")) {
        const f = resolve("public", p.thumbnail.replace("/api/cover/", "covers/").replace("/covers/", "covers/"));
        // ساختار واقعی: /api/cover/<name> → public/covers/<name>
        const real = resolve("public/covers", p.thumbnail.split("/").pop() ?? "");
        for (const cand of [real, f]) {
          try { rmSync(cand); console.log("deleted file", cand); break; } catch { /* next */ }
        }
      }
    }
    await db.session.deleteMany({ where: { userId: u.id } });
    await db.builtinHidden.deleteMany({ where: { userId: u.id } }).catch(() => {});
    await db.userBlob.deleteMany({ where: { userId: u.id } }).catch(() => {});
    await db.user.delete({ where: { username } });
    console.log(`deleted user ${username}`);
  }
  const remain = await db.user.findMany({ select: { username: true, role: true } });
  console.log("remaining users:", remain.map(r => `${r.username}(${r.role})`).join(", "));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
