#!/usr/bin/env bun
/* تست خودترمیمی اسکیما — همان منطق ensureSchema در src/lib/db.ts
 * سناریو: فایل دیتابیس «بدون جدول» (مثل lexa.db خالی روی دستگاه کاربر) */
import { PrismaClient } from "@prisma/client";
import { SCHEMA_SQL } from "../src/lib/schema-sql";

const dbPath = process.argv[2] ?? "/home/z/my-project/qa-dbheal-dbg/lexa.db";
const db = new PrismaClient({
  datasources: { db: { url: "file:" + dbPath } },
  log: ["error"],
});

async function ensureSchema(): Promise<void> {
  try {
    await db.$queryRawUnsafe('SELECT 1 FROM "User" LIMIT 1');
    console.log("(schema already ok)");
    return;
  } catch {
    console.log("schema missing — running DDL …");
  }
  const clean = SCHEMA_SQL.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  const statements = clean.split(";").map((s) => s.trim()).filter(Boolean);
  let ok = 0, skip = 0, fail = 0;
  for (const stmt of statements) {
    try {
      await db.$executeRawUnsafe(stmt);
      ok++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/already exists/i.test(msg)) { skip++; continue; }
      fail++;
      console.error("DDL FAILED:", msg.slice(0, 160), "→", stmt.slice(0, 90));
    }
  }
  console.log(`DDL: ${ok} ok, ${skip} skipped, ${fail} failed (${statements.length} total)`);
  await db.$queryRawUnsafe('SELECT 1 FROM "User" LIMIT 1');
  console.log("VERIFY: User table reachable ✅");
}

try {
  await ensureSchema();

  // ثبت‌نام واقعی با prisma مثل روت‌های auth
  const { randomBytes, scrypt } = await import("node:crypto");
  const { promisify } = await import("node:util");
  const scryptAsync = promisify(scrypt);
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync("heal123456".normalize("NFKC"), salt, 64)) as Buffer;
  const u = await db.user.create({
    data: { username: "qa_heal_user", passwordHash: `s1:${salt}:${derived.toString("hex")}`, role: "user" },
  });
  console.log("CREATE user ok:", u.id.slice(0, 8));
  const back = await db.user.findUnique({ where: { username: "qa_heal_user" } });
  console.log("READ user ok:", back?.username);
  const blob = await db.userBlob.create({ data: { userId: u.id } });
  console.log("CREATE blob ok:", !!blob.id);
  console.log("ALL GREEN ✅");
} finally {
  await db.$disconnect();
}
