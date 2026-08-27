// پاک‌سازی امن فقط برای حساب‌های آزمایشی qa_*
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const users = await db.user.findMany({ where: { username: { startsWith: "qa_built" } }, select: { id: true } });
  for (const u of users) {
    await db.session.deleteMany({ where: { userId: u.id } });
    await db.user.delete({ where: { id: u.id } }); // بقیه روابط Cascade اند
    console.log("deleted user", u.id);
  }
}
main().finally(() => db.$disconnect());
