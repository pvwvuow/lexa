import { PrismaClient } from '@prisma/client'
import { SCHEMA_SQL } from '@/lib/schema-sql'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  lexaSchemaReady?: Promise<void>
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error'], // فقط خطاها — لاگ کوئری هم حجم لاگ را منفجر می‌کند هم سرعت را می‌گیرد
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

/* ─── خودترمیمی اسکیما (ensureSchema) ────────────────────────────────────────
 * سرور دسکتاپ دیتابیس را در پروفایل کاربر نگه می‌دارد (lexa.db). در برخی
 * دستگاه‌ها این فایل «بدون جدول» است: کپی ناموفق قالب، اجرای نیمه‌کارهٔ نسخه‌های
 * قدیمی یا بروز خطای یک‌بارهٔ دیسک. نتیجه‌اش خطای ۵۰۰ روی همهٔ /api/auth/* است
 * («خطای سرور» برای کاربر). اینجا در اولین استفاده، اگر جدول User نبود، کل
 * اسکیما با CREATE TABLE IF NOT EXISTS ساخته می‌شود؛ روی دیتابیس سالم این
 * بررسی یک SELECTِ سبک است و هیچ‌چیز بازنویسی نمی‌شود. یک‌بار در عمر پروسه. */

async function ensureSchema(): Promise<void> {
  try {
    await db.$queryRawUnsafe('SELECT 1 FROM "User" LIMIT 1')
    return // اسکیما سالم است
  } catch {
    // جدول نیست یا دیتابیس خالی — ساخت کامل (idempotent)
    console.log('[db] schema missing — running self-heal DDL …')
  }
  // حذف خط‌های کامنت، سپس تفکیک دستورها
  const clean = SCHEMA_SQL
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');
  const statements = clean
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    try {
      await db.$executeRawUnsafe(stmt)
    } catch (e) {
      // خطای «از قبل هست» بی‌ضرر است؛ بقیهٔ دستورها ادامه پیدا می‌کنند
      const msg = e instanceof Error ? e.message : String(e)
      if (/already exists/i.test(msg)) continue
      console.error('[db] DDL failed:', msg.slice(0, 200), '→', stmt.slice(0, 80))
    }
  }
  // راستی‌آزمایی نهایی
  await db.$queryRawUnsafe('SELECT 1 FROM "User" LIMIT 1')
  console.log('[db] schema self-heal complete — tables ready')
}

/** هر مسیر API که به دیتابیس می‌خورد اول این را await کند */
export function dbReady(): Promise<void> {
  if (!globalForPrisma.lexaSchemaReady) {
    globalForPrisma.lexaSchemaReady = ensureSchema().catch((e) => {
      console.error('[db] ensureSchema fatal:', e instanceof Error ? e.message : e)
    })
  }
  return globalForPrisma.lexaSchemaReady
}
