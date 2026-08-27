// حذف حساب آزمایشی miguser77 — فقط برای پاکسازی پس از تست مرورگری
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const u = await db.user.findUnique({ where: { username: "miguser77" } });
  if (!u) {
    console.log("no test user found");
    return;
  }
  // نشست‌ها Cascade ندارند؛ دستی حذف می‌شوند، بقیه با onDelete: Cascade
  await db.session.deleteMany({ where: { userId: u.id } });
  await db.user.delete({ where: { id: u.id } });
  console.log("deleted test user:", u.username);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
