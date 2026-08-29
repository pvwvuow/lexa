// پاک‌سازی حساب‌های آزمایشی توسعه — تحویل تمیز (اپ خودش هیچ مسیر حذفی ندارد)
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const TEST_USERS = ["ostad_e2e", "student_e2e", "daneshju_brow"];

async function main() {
  for (const username of TEST_USERS) {
    const u = await db.user.findUnique({ where: { username } });
    if (!u) {
      console.log(`skip ${username} (نیست)`);
      continue;
    }
    // رکوردهای وابسته با Cascade پاک می‌شوند؛ نشست‌ها اول (بدون Cascade)
    await db.session.deleteMany({ where: { userId: u.id } });
    await db.user.delete({ where: { username } });
    console.log(`deleted ${username}`);
  }
  const remain = await db.user.findMany({ select: { username: true, role: true } });
  console.log("remaining users:", remain);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
