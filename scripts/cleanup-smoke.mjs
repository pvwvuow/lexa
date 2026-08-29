// پاک‌سازی حساب‌های آزمایشی smoke (ostad_* / stu_* امروز) + فایل آواتارشان
import { PrismaClient } from "@prisma/client";
import { readdir, unlink } from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();
const AV_DIR = path.join(process.cwd(), "data", "uploads", "avatars");
const since = new Date(Date.now() - 2 * 60 * 60 * 1000);

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [{ username: { startsWith: "ostad_" } }, { username: { startsWith: "stu_" } }],
      createdAt: { gte: since },
    },
    select: { id: true, username: true },
  });
  console.log("کاربران آزمایشی:", users.map((u) => u.username));
  let removedFiles = 0;
  for (const u of users) {
    await prisma.session.deleteMany({ where: { userId: u.id } });
    await prisma.user.delete({ where: { id: u.id } }).catch((e) => console.log("skip", u.username, e.message.slice(0, 80)));
    try {
      const files = await readdir(AV_DIR);
      for (const f of files)
        if (f.startsWith(u.id)) { await unlink(path.join(AV_DIR, f)); removedFiles++; }
    } catch {}
  }
  console.log("آواتارهای حذف‌شده:", removedFiles);
}

main().finally(() => prisma.$disconnect());
