import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { db, dbReady } from "@/lib/db";
import type { PublicUser } from "@/lib/auth-shared";

const scryptAsync = promisify(scrypt);

export const SESSION_COOKIE = "lexa_session";
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

// ─── نشست‌ها ─────────────────────────────────────────────────────────────────────────────
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
  await dbReady(); // خودترمیمی اسکیما — اگر دیتابیس بی‌جدول باشد اول ساخته می‌شود
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
    role: u.role === "admin" ? "admin" : u.role === "teacher" ? "teacher" : "user",
    displayName: u.displayName,
    bio: u.bio,
    avatarUrl: u.avatarUrl,
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
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    displayName: u.displayName,
    bio: u.bio,
    avatarUrl: u.avatarUrl,
    createdAt: u.createdAt,
  };
}

// ─── حساب مدیر ────────────────────────────────────────────────────────────────────────────────
let adminEnsured = false;

// Passwords that were ever shipped as defaults. They are public (they are in this
// repo's history), so an admin account must never keep one of them.
const PUBLIC_DEFAULT_PASSWORDS = ["lexa@1404", "hamyar@1404"];

/** Where a generated admin password is written: next to the SQLite file (Electron: userData). */
function adminSecretFile(): string {
  const url = process.env.DATABASE_URL ?? "";
  const m = url.match(/^file:(.+)$/);
  let dir = process.cwd();
  if (m) {
    const p = m[1].split("?")[0];
    // Prisma resolves relative SQLite paths from the prisma/ folder
    dir = path.dirname(path.isAbsolute(p) ? p : path.resolve(process.cwd(), "prisma", p));
  }
  return path.join(dir, "ADMIN-PASSWORD.txt");
}

function randomPassword(): string {
  return randomBytes(12).toString("base64url"); // 16 chars
}

function saveAdminSecret(username: string, password: string): string {
  const file = adminSecretFile();
  try {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(
      file,
      `Lexa admin account\nusername: ${username}\npassword: ${password}\n\n` +
        "Sign in, change the password in the admin panel, then delete this file.\n",
      { mode: 0o600 },
    );
  } catch (e) {
    console.error("[auth] could not write the admin password file:", e);
  }
  return file;
}

async function usesPublicDefault(hash: string): Promise<boolean> {
  for (const p of PUBLIC_DEFAULT_PASSWORDS) if (await verifyPassword(p, hash)) return true;
  return false;
}

/**
 * اطمینان از وجود حساب مدیر. اطلاعات اولیه از متغیرهای محیطی
 * ADMIN_USERNAME / ADMIN_PASSWORD خوانده می‌شود. Without a strong ADMIN_PASSWORD a random
 * password is generated and written to ADMIN-PASSWORD.txt next to the database
 * (never a public default). An existing admin that still uses a public default
 * password is moved to ADMIN_PASSWORD or to a new random one the same way.
 */
export async function ensureAdmin(): Promise<void> {
  if (adminEnsured) return;
  await dbReady(); // خودترمیمی اسکیما — پیش از هر پرس‌وجوی حساب مدیر
  const envU = process.env.ADMIN_USERNAME?.trim();
  const envP = process.env.ADMIN_PASSWORD;
  const username = envU && envU.length >= 3 ? envU : "admin";
  const strongEnv = envP && envP.length >= 8 && !PUBLIC_DEFAULT_PASSWORDS.includes(envP) ? envP : null;
  if (envP && !strongEnv) console.warn("[auth] ADMIN_PASSWORD is too short or public; ignoring it");
  try {
    const existing = await db.user.findFirst({ where: { role: "admin" } });
    if (!existing) {
      const password = strongEnv ?? randomPassword();
      await db.user.create({
        data: { username, passwordHash: await hashPassword(password), role: "admin" },
      });
      if (strongEnv) {
        console.log(`[auth] حساب مدیر ساخته شد → ${username}`);
      } else {
        const file = saveAdminSecret(username, password);
        console.log(`[auth] admin account created (${username}); its password is in ${file}`);
      }
    } else if (await usesPublicDefault(existing.passwordHash)) {
      const password = strongEnv ?? randomPassword();
      await db.user.update({
        where: { id: existing.id },
        data: { passwordHash: await hashPassword(password) },
      });
      if (strongEnv) {
        console.log("[auth] default admin password replaced by ADMIN_PASSWORD");
      } else {
        const file = saveAdminSecret(existing.username, password);
        console.warn(`[auth] the public default admin password was replaced; the new one is in ${file}`);
      }
    }
    adminEnsured = true;
  } catch (e) {
    console.error("[auth] ensureAdmin error:", e);
  }
}
