// ساخت حساب استاد آزمایشی برای QA بصری (تامنیل قاب‌دار + آواتار دایره‌ای)
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";
const prisma = new PrismaClient();
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password.normalize("NFKC"), salt, 64);
  return `s1:${salt}:${derived.toString("hex")}`;
}
try {
  const username = "qavisual";
  const ex = await prisma.user.findUnique({ where: { username } });
  if (ex) { console.log("exists:", ex.id, ex.role); process.exit(0); }
  const u = await prisma.user.create({
    data: { username, passwordHash: hashPassword("Qa!23456789"), displayName: "استاد نمونه", role: "teacher" },
  });
  console.log("created:", u.id, u.role);
} finally { await prisma.$disconnect(); }
