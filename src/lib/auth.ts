import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { PublicUser } from "@/lib/auth-shared";

const scryptAsync = promisify(scrypt);

export const SESSION_COOKIE = "hh_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // ۳۰ روز

// ─── رمز عبور (scrypt با نمک تصادفی) ─────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password.normalize("NFKC"), salt, 64)) as Buffer;
  return `s1:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [v, salt, hex] = stored.split(":");
    if (v !== "s1" || !salt || !hex) return false;
    const derived = (await scryptAsync(password.normalize("NFKC"), salt, 64)) as Buffer;
    const expected = Buffer.from(hex, "hex");
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

// ─── نشست‌ها ──────────────────────────────────────────────────────────────────
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** ساخت نشست تازه و بازگرداندن مقدار خام کوکی */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });
  // پاکسازی دستهٔ منقضی‌های قدیمی (فقط نشست — نه دادهٔ کاربر)
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 7 * 86_400_000) } } });
  return { token, expiresAt };
}

export interface SessionUser extends PublicUser {
  sessionId: string;
}

/** خواندن کاربر جاری از کوکی؛ در صورت یافتن، lastSeenAt را به‌روز می‌کند */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  const u = session.user;
  // ثبت آخرین فعالیت حداکثر هر ۵ دقیقه یک بار
  if (!u.lastSeenAt || Date.now() - u.lastSeenAt.getTime() > 5 * 60_000) {
    await db.user.update({ where: { id: u.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return {
    id: u.id,
    username: u.username,
    role: u.role === "admin" ? "admin" : "user",
    createdAt: u.createdAt.toISOString(),
    sessionId: session.id,
  };
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return;
  await db.session.deleteMany({ where: { tokenHash: hashToken(raw) } });
}

/** نگاشت کاربر عمومی برای پاسخ API */
export function toPublic(u: SessionUser): PublicUser {
  return { id: u.id, username: u.username, role: u.role, createdAt: u.createdAt };
}

// ─── حساب مدیر ────────────────────────────────────────────────────────────────
let adminEnsured = false;

/**
 * اطمینان از وجود حساب مدیر. اطلاعات اولیه از متغیرهای محیطی
 * ADMIN_USERNAME / ADMIN_PASSWORD خوانده می‌شود؛ در غیر این صورت مقادیر
 * پیش‌فرض «admin / hamyar@1404» ساخته می‌شود.
 */
export async function ensureAdmin(): Promise<void> {
  if (adminEnsured) return;
  const envU = process.env.ADMIN_USERNAME?.trim();
  const envP = process.env.ADMIN_PASSWORD;
  const username = envU && envU.length >= 3 ? envU : "admin";
  const password = envP && envP.length >= 6 ? envP : "hamyar@1404";
  try {
    const existing = await db.user.findFirst({ where: { role: "admin" } });
    if (!existing) {
      await db.user.create({
        data: { username, passwordHash: await hashPassword(password), role: "admin" },
      });
      console.log(`[auth] حساب مدیر ساخته شد → ${username}`);
    }
    adminEnsured = true;
  } catch (e) {
    console.error("[auth] ensureAdmin error:", e);
  }
}
