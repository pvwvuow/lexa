/**
 * data-guard — نگهبان داده‌ها (لایهٔ درون‌سروری، پس از سه ریست مخرب محیط)
 *
 * چرا اینجا؟ تجربه نشان داد دیمن‌های bash بیرونی توسط پلتفرم جمع می‌شوند،
 * ولی پروسهٔ node سرور زنده می‌ماند. پس بکاپ دوره‌ای باید داخل خود سرور باشد.
 *
 * وظایف:
 *  ۱) خودترمیمیِ هنگام بوت: اگر db/custom.db غایب یا تقریباً خالی بود (≤۱ کاربر)
 *     و اسنپ‌شات گنجینه پرتر بود → بازگردانی فوری، پیش از اولین کوئری کاربر.
 *  ۲) بکاپ دوره‌ای هر ۵ دقیقه: VACUUM INTO (اسنپ‌شات سازگار و اتمیک SQLite)
 *     + کامیت بی‌صدای گیت فقط در صورت تغییر.
 *
 * هر خطا فقط لاگ می‌شود؛ هیچ‌وقت نباید سرور را بیندازد.
 */

import { existsSync, copyFileSync, rmSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

const ROOT = resolveRoot();
const DB_PATH = path.join(ROOT, "db", "custom.db");
const SNAPSHOT = path.join(ROOT, "backups", "db-snapshot.db");
const SAFETY = path.join(ROOT, "backups", "db-safety.db");
const LOG = "[data-guard]";

function resolveRoot(): string {
  // ۱) اگر DATABASE_URL به شکل file:/abs/…/db/custom.db باشد، ریشه دو سطح بالاتر است
  //    (…/db/custom.db → …/db → ریشهٔ پروژه)
  const url = process.env.DATABASE_URL;
  if (url && url.startsWith("file:/")) {
    const dbFile = url.slice("file:".length);
    return path.dirname(path.dirname(dbFile));
  }
  // ۲) فایل .env پروژه را دستی بخوان (در standalone، dotenv ممکن است هنوز load نشده باشد)
  try {
    const envTxt = readFileSync("/home/z/my-project/.env", "utf8");
    const m = envTxt.match(/^DATABASE_URL=file:(\/.+)$/m);
    if (m) return path.dirname(path.dirname(m[1]));
  } catch {
    /* بی‌اهمیت */
  }
  // ۳) پیش‌فرض ثابت پروژه
  return "/home/z/my-project";
}

/**
 * شمارش کاربران یک فایل دیتابیس با پروسهٔ فرزند node —
 * node:sqlite در باندل استندالون قابل require نیست، ولی در پروسهٔ فرزند خام در دسترس است.
 */
async function countUsersViaSqlite(file: string): Promise<number> {
  const script = "const{DatabaseSync}=require('node:sqlite');const d=new DatabaseSync(process.argv[1]);try{console.log(d.prepare('SELECT COUNT(*) AS c FROM \"User\"').get().c)}finally{d.close()}";
  const { stdout } = await execFileP(process.execPath, ["-e", script, file], { timeout: 15_000 });
  return Number(stdout.trim());
}

/** ۱) خودترمیمی هنگام بوت — قبل از بازشدن Prisma */
async function bootSelfHeal(): Promise<void> {
  try {
    let liveUsers = 0;
    let liveOk = false;
    if (existsSync(DB_PATH)) {
      try {
        liveUsers = await countUsersViaSqlite(DB_PATH);
        liveOk = true;
      } catch {
        liveOk = false; // فایل هست ولی سالم/خوانا نیست
      }
    }
    if (liveOk && liveUsers > 1) return; // دیتابیس زنده سالم و پُر است

    if (!existsSync(SNAPSHOT)) {
      console.log(`${LOG} اسنپ‌شاتی برای خودترمیمی نیست؛ رد شد (live=${liveUsers})`);
      return;
    }
    const snapUsers = await countUsersViaSqlite(SNAPSHOT);
    if (snapUsers <= liveUsers) {
      console.log(`${LOG} اسنپ‌شات پرتر از دیتابیس زنده نیست (snap=${snapUsers}, live=${liveUsers})؛ رد شد`);
      return;
    }
    mkdirSync(path.dirname(DB_PATH), { recursive: true });
    copyFileSync(SNAPSHOT, DB_PATH);
    console.log(`${LOG} ✅ خودترمیمی: دیتابیس خالی (${liveUsers} کاربر) از اسنپ‌شات (${snapUsers} کاربر) بازگردانی شد`);
  } catch (e) {
    console.error(`${LOG} خطای خودترمیمی (بی‌خطر):`, e instanceof Error ? e.message : e);
  }
}

let running = false;

/** ۲) بکاپ دوره‌ای: VACUUM INTO + کامیت گیت در صورت تغییر */
async function backupCycle(): Promise<void> {
  if (running) return;
  running = true;
  try {
    // اسنپ‌شات سازگار با VACUUM INTO (هدف نباید از قبل موجود باشد)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { db } = await import("@/lib/db");
    rmSync(SNAPSHOT, { force: true });
    await db.$queryRawUnsafe(`VACUUM INTO '${SNAPSHOT}'`);
    copyFileSync(SNAPSHOT, SAFETY);

    // کامیت بی‌صدا فقط اگر چیزی تغییر کرده باشد
    await new Promise<void>((resolve) => {
      const files = ["db/custom.db", "backups/db-snapshot.db", "backups/db-safety.db", "data"];
      execFile(
        "git",
        ["-C", ROOT, "add", "--ignore-removal", "-A", ...files],
        { timeout: 30_000 },
        (addErr) => {
          if (addErr) {
            console.error(`${LOG} git add ناموفق:`, addErr.message);
            return resolve();
          }
          execFile("git", ["-C", ROOT, "diff", "--cached", "--quiet"], { timeout: 30_000 }, (diffErr) => {
            if (!diffErr) return resolve(); // کد ۰ = بدون تغییر
            execFile(
              "git",
              ["-C", ROOT, "commit", "--quiet", "-m", `db-guard(سرور): اسنپ‌شوت خودکار داده‌ها (${new Date().toISOString().slice(0, 16)})`],
              { timeout: 60_000 },
              (cErr) => {
                if (cErr) console.error(`${LOG} git commit ناموفق:`, cErr.message);
                else console.log(`${LOG} اسنپ‌شوت کامیت شد ✅`);
                resolve();
              },
            );
          });
        },
      );
    });
  } catch (e) {
    console.error(`${LOG} خطای چرخهٔ بکاپ (بی‌خطر):`, e instanceof Error ? e.message : e);
  } finally {
    running = false;
  }
}

export function startDataGuard(): void {
  try {
    // در فاز build اجرا نشود
    if (process.env.NEXT_PHASE === "phase-production-build") return;
    void bootSelfHeal();
    // اولین بکاپ بعد از ۹۰ ثانیه، سپس هر ۵ دقیقه
    setTimeout(() => void backupCycle(), 90_000).unref();
    setInterval(() => void backupCycle(), 300_000).unref();
    console.log(`${LOG} فعال شد — ریشه: ${ROOT}، بکاپ هر ۵ دقیقه + خودترمیمی بوت`);
  } catch (e) {
    console.error(`${LOG} خطای راه‌اندازی (بی‌خطر):`, e instanceof Error ? e.message : e);
  }
}
