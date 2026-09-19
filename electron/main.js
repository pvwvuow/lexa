/* ─── Lexa — فرآیند اصلی Electron ──────────────────────────────────────────
 * معماری: همان سرور استاندالون Next.js که در نسخهٔ وب هم استفاده می‌شود،
 * با «همان باینری الکترون» در حالت ELECTRON_RUN_AS_NODE به‌عنوان Node اجرا
 * می‌شود — یعنی روی دستگاه کاربر نه Node.js لازم است و نه هیچ پیش‌نیاز دیگر.
 *
 *  ۱) یک پورت آزاد رزرو می‌شود (بدون تصادم با سرویس‌های دیگر)
 *  ۲) ‎.next/standalone/server.js روی همان پورت بالا می‌آید (127.0.0.1)
 *  ۳) تا HTTP آماده شود، پنجره با صفحهٔ «در حال راه‌اندازی» باز می‌ماند
 *  ۴) پنجرهٔ اصلی به سرور محلی وصل می‌شود؛ لینک‌های بیرونی به مرورگر سیستم
 * ─────────────────────────────────────────────────────────────────────── */

const { app, BrowserWindow, shell, dialog } = require("electron");
const { spawn } = require("child_process");
const http = require("http");
const net = require("net");
const path = require("path");

app.setName("Lexa");

// نشانگر «نصب‌شده» در UserAgent — رندرر با آن می‌فهمد متون در باندل نیستند
// و باید مستقیم از گیت‌هاب (jsDelivr/raw) بیایند؛ در حالت dev اثری ندارد
if (app.isPackaged) {
  app.userAgentFallback = `${app.userAgentFallback} LexaPack/1`;
}

// هشدارهای بی‌ضررِ فسخ Promise در زمان بستن پنجره/خروج — لاگ را تمیز نگه می‌دارد
process.on("unhandledRejection", (err) => {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("Object has been destroyed")) return;
  console.error("[lexa-electron] unhandled:", msg);
});

/* ─── مسیرها ──────────────────────────────────────────────────────────────── */

// در پکیج‌شده: resources/app/.next/standalone — در توسعه: ریشهٔ مخزن
const IS_PACKAGED = app.isPackaged;
const APP_ROOT = path.join(__dirname, "..");
const SERVER_DIR = path.join(APP_ROOT, ".next", "standalone");
const SERVER_JS = path.join(SERVER_DIR, "server.js");

/* ─── وضعیت سرور ─────────────────────────────────────────────────────────── */

let serverProc = null;
let win = null;
let quitting = false;

/* ─── پورت آزاد ──────────────────────────────────────────────────────────── */

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

/* ─── اجرای سرور استاندالون با الکترون‌به‌عنوان‌نود ───────────────────────── */

function startServer(port) {
  // ELECTRON_RUN_AS_NODE = الکترون دقیقاً مثل Node.js خالص رفتار می‌کند
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    NODE_ENV: "production",
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    // کش هر کاربر داخل پروفایل خودش
    XDG_CACHE_HOME: path.join(app.getPath("userData"), "cache"),
  };

  serverProc = spawn(process.execPath, [SERVER_JS], {
    env,
    cwd: SERVER_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  serverProc.stdout.on("data", (d) => {
    if (!IS_PACKAGED) process.stdout.write(`[lexa-server] ${d}`);
  });
  serverProc.stderr.on("data", (d) => {
    if (!IS_PACKAGED) process.stderr.write(`[lexa-server] ${d}`);
  });
  serverProc.on("exit", () => {
    serverProc = null;
    // اگر سرور ناخواسته مرد و پنجره هنوز باز است، کاربر را در جریان بگذار
    if (!quitting && win && !win.isDestroyed()) {
      win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(
        `<body style="font-family:sans-serif;background:#faf7f2;display:grid;place-items:center;height:100vh;margin:0" dir="rtl"><div style="text-align:center"><h2 style="color:#8a6d3b">سرور Lexa متوقف شد</h2><p style="color:#666">برنامه را ببند و دوباره باز کن.</p></div></body>`
      )}`).catch(() => {});
    }
  });
}

/** تا سرور HTTP جواب بدهد صبر کن — حداکثر ۴۵ ثانیه */
function waitForServer(port, timeoutMs = 45_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get({ host: "127.0.0.1", port, path: "/", timeout: 2500 }, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => retry());
      req.on("timeout", () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error("سرور Lexa در زمان معقول آماده نشد"));
        return;
      }
      setTimeout(tryOnce, 400);
    };
    tryOnce();
  });
}

/* ─── پنجره‌ها ────────────────────────────────────────────────────────────── */

const SPLASH = (line1, line2) =>
  `data:text/html;charset=utf-8,${encodeURIComponent(
    `<body style="font-family:Tahoma,'Segoe UI',sans-serif;background:linear-gradient(135deg,#faf7f2,#f3ead8);display:grid;place-items:center;height:100vh;margin:0" dir="rtl"><div style="text-align:center"><div style="font-size:42px;font-weight:800;color:#8a6d3b;letter-spacing:1px">Lexa</div><p style="color:#7c6f5a;font-size:14px;margin-top:14px">${line1}</p><p style="color:#a89c85;font-size:11px;margin-top:6px">${line2}</p></div></body>`
  )}`;

function createMainWindow(port) {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 940,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#faf7f2",
    title: "Lexa — استاد حقوقی هوشمند",
    icon: path.join(APP_ROOT, "public", "icons", "icon-192.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  win.once("ready-to-show", () => win.show());

  // لینک‌های بیرونی → مرورگر سیستم؛ داخل برنامه فقط همین origin
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    const allowed = [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
    const inApp = allowed.some((o) => url === o || url.startsWith(o + "/"));
    if (!inApp && /^https?:/i.test(url)) {
      e.preventDefault();
      void shell.openExternal(url);
    }
  });

  win.loadURL(`http://127.0.0.1:${port}`).catch(() => {
    try {
      if (win && !win.isDestroyed()) {
        win.loadURL(SPLASH("اتصال به سرور محلی برقرار نشد", "برنامه را ببند و دوباره باز کن")).catch(() => {});
      }
    } catch { /* پنجره حین خروج از بین رفته — بی‌اثر */ }
  });

  win.on("closed", () => {
    win = null;
  });
}

/* ─── چرخهٔ عمر برنامه ────────────────────────────────────────────────────── */

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      if (!IS_PACKAGED) {
        console.log("[lexa-electron] dev mode — standalone:", SERVER_JS);
      }
      const port = await getFreePort();
      startServer(port);

      // پنجره با صفحهٔ راه‌اندازی باز می‌شود تا کاربر صفحهٔ خالی نبیند
      win = new BrowserWindow({
        width: 1280,
        height: 820,
        minWidth: 940,
        minHeight: 600,
        show: true,
        autoHideMenuBar: true,
        backgroundColor: "#faf7f2",
        title: "Lexa",
        icon: path.join(APP_ROOT, "public", "icons", "icon-192.png"),
        webPreferences: { contextIsolation: true, nodeIntegration: false, spellcheck: false },
      });
      win.loadURL(SPLASH("در حال راه‌اندازی Lexa…", "سرور محلی چند لحظه‌ای بالا می‌آید")).catch(() => {});

      await waitForServer(port);

      // همان پنجره به اپ اصلی وصل می‌شود — بدون باز و بسته شدن دوباره
      createMainWindow(port);
    } catch (err) {
      dialog.showErrorBox(
        "Lexa — خطای راه‌اندازی",
        "سرور داخلی برنامه راه‌اندازی نشد.\n" + (err && err.message ? err.message : String(err)),
      );
      app.quit();
    }
  });

  app.on("window-all-closed", () => {
    app.quit();
  });

  app.on("before-quit", () => {
    quitting = true;
    if (serverProc) {
      try {
        serverProc.kill();
      } catch { /* بی‌اثر */ }
      serverProc = null;
    }
  });
}
