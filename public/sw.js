/*
 * Lexa — Service Worker (v9)
 * راهبرد: پوستهٔ طراحی (HTML/JS/CSS/فونت/تصاویر) کش می‌شود تا سایت آفلاین هم با همان
 * ظاهر بالا بیاید؛ ولی پاسخ‌های JSON مسیر /api/* هرگز کش نمی‌شوند — مطالبِ سروری فقط
 * با «ذخیرهٔ تک‌تک مطالب/دوره‌ها» در دسترس می‌مانند.
 *
 * v9 — رفع «آفلاین ناقص/کُند»:
 * ۱) اسکریپت/استایل: کش پوسته (SHELL_CACHE) هم دیده می‌شود — قبلاً «(cache.match || caches.match)»
 *    روی دو Promise بود و بخش دوم هرگز اجرا نمی‌شد؛ چانک‌هایی که هنگام نصب کش شده بودند
 *    آفلاین پیدا نمی‌شدند.
 * ۲) شکست شبکه (آفلاین) → بلافاصله کش؛ قبلاً هر اسکریپت ۱۰ ثانیه منتظر می‌ماند.
 * ۳) فونت/رسانه/آیکن: کش پوسته هم جستجو می‌شود (نصب SW آن‌ها را آنجا می‌گذارد).
 *
 * v6 — رفع «صفحه کار نمی‌کند»: اسکریپت‌ها هیچ‌وقت «قطع و خطا» نمی‌شوند؛ پس‌افت
 * اسکریپت فقط با تطابق دقیق URL (بدون ignoreSearch)؛ مهلت ناوبری ۱۰ ثانیه.
 * v3 — کش دارایی‌های ارجاع‌شده در HTML پوسته + پس‌افت ناوبری با ignoreSearch.
 */
const VERSION = "lexa-pwa-v54";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-asset`;
const IMG_CACHE = `${VERSION}-img`;

/* فایل‌های هسته که با نصب SW پیش‌بارگذاری می‌شوند */
const CORE_URLS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icons/pwa-192.png",
  "/icons/pwa-512.png",
  "/icons/pwa-maskable-512.png",
];

/* ── ابزار: fetch با مهلت — تا آفلاین سریع به کش بیفتیم ── */
function fetchWithTimeout(req, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    fetch(req).then(
      (res) => { clearTimeout(t); resolve(res); },
      (err) => { clearTimeout(t); reject(err); },
    );
  });
}

/** کش کردن فهرست URL — هر آیتم مستقل؛ شکست یکی بقیه را نمی‌کُشد */
async function cacheUrlList(cache, urls) {
  let ok = 0;
  await Promise.allSettled(
    urls.map(async (u) => {
      try {
        const cross = new URL(u, self.location.origin).origin !== self.location.origin;
        const res = await fetch(u, cross ? { mode: "no-cors", cache: "no-cache" } : { cache: "no-cache" });
        if (res && (res.ok || res.type === "opaque")) {
          await cache.put(u, res);
          ok += 1;
        }
      } catch {
        /* آیتم ناموفق نباید بقیه را خراب کند */
      }
    })
  );
  return ok;
}

/**
 * پوستهٔ کامل: "/" را می‌گیرد، در کش می‌گذارد و از متن HTML همهٔ دارایی‌های
 * هم‌مبدا (چانک‌های JS/CSS/فونت/رسانه) را استخراج و کش می‌کند — تا آفلاینِ
 * کامل، حتی برای ویوهایی که کاربر هنوز ندیده، تضمین شود.
 */
async function precacheShellHtml(cache) {
  try {
    const res = await fetch("/", { cache: "no-cache" });
    if (!res || !res.ok) return 0;
    await cache.put("/", res.clone());
    const html = await res.text();
    const urls = new Set();
    const re = /(?:src|href)=["']([^"']+)["']/g;
    let m;
    while ((m = re.exec(html))) {
      const u = m[1];
      if (!u || u.startsWith("data:") || u.startsWith("blob:")) continue;
      try {
        const abs = new URL(u, self.location.origin);
        if (abs.origin !== self.location.origin) continue;
        const p = abs.pathname;
        const hit =
          p.startsWith("/_next/") || p.startsWith("/fonts/") || p.startsWith("/media/") ||
          p.startsWith("/icons/") || p === "/favicon.svg" || p === "/manifest.webmanifest" ||
          /\.(css|js|mjs|woff2?|png|svg|jpg|webp|ico)$/.test(p);
        if (hit) urls.add(p + abs.search);
      } catch { /* URL نامعتبر */ }
    }
    return cacheUrlList(cache, [...urls]);
  } catch {
    return 0;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      await cacheUrlList(shell, CORE_URLS);
      await precacheShellHtml(shell);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

/* پیام از صفحه: «بستهٔ طراحی» (ASSET_CACHE) یا تصاویر آیتم‌های ذخیره‌شده (IMG_CACHE) */
self.addEventListener("message", (event) => {
  const type = event.data?.type;
  if (type === "PING") {
    caches.open(IMG_CACHE).then((c) => c.put("/__ping-marker", new Response("pong:" + VERSION)));
    self.clients.matchAll({ includeUncontrolled: true, type: "window" }).then((cs) => {
      cs.forEach((c) => c.postMessage({ type: "PONG", version: VERSION, clients: cs.length }));
    });
    return;
  }
  if (type === "PRECACHE_IMAGES") {
    const urls = Array.isArray(event.data.urls) ? event.data.urls : [];
    const port = event.ports && event.ports[0];
    event.waitUntil(
      (async () => {
        const cache = await caches.open(IMG_CACHE);
        const ok = await cacheUrlList(cache, urls);
        if (port) port.postMessage({ type: "PRECACHE_DONE", count: ok });
      })()
    );
    return;
  }
  if (type === "PRECACHE_SHELL") {
    const urls = Array.isArray(event.data.urls) ? event.data.urls : [];
    const port = event.ports && event.ports[0];
    event.waitUntil(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        let ok = await cacheUrlList(cache, urls);
        // پوسته و همهٔ دارایی‌های ارجاع‌شده در HTML — قلب آفلاینِ کامل
        const shell = await caches.open(SHELL_CACHE);
        ok += await precacheShellHtml(shell);
        if (port) port.postMessage({ type: "PRECACHE_DONE", count: ok });
        else {
          const clients = await self.clients.matchAll();
          clients.forEach((c) => c.postMessage({ type: "PRECACHE_DONE", count: ok }));
        }
      })()
    );
  }
});

/** فقط درخواست‌های GETِ هم‌مبدا */
function isSameOriginGet(req) {
  return req.method === "GET" && new URL(req.url).origin === self.location.origin;
}

/** اول شبکه با مهلت؛ در شکست ابتدا تطابق دقیق کش، بعد تطابق بی‌search (کهنه‌محتمل‌تر) */
async function networkFirst(req, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetchWithTimeout(req, timeoutMs);
    if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch {
    return (
      (await cache.match(req)) ||
      (await caches.match(req)) ||
      (await cache.match(req, { ignoreSearch: true })) ||
      (await caches.match(req, { ignoreSearch: true })) ||
      Response.error()
    );
  }
}

/**
 * اسکریپت/استایل: هیچ‌وقت «قطع و خطا» نیست.
 * شبکه شروع می‌شود؛ اگر تا graceMs جواب نیامد و «دقیقاً همین URL» در کش (هر کشی،
 * از جمله پوسته) بود، همان برگردانده می‌شود؛ اگر شبکه شکست خورد (آفلاین) همان
 * لحظه کش؛ وگرنه منتظر جواب واقعی شبکه. هیچ‌وقت به‌خاطر کندیِ موقت صفحهٔ سفید نمی‌سازیم.
 */
async function networkFirstNeverAbort(req, cacheName, graceMs) {
  const cache = await caches.open(cacheName);
  const fromCache = async () => (await cache.match(req)) || (await caches.match(req)) || null;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (res) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(res);
    };
    const timer = setTimeout(async () => {
      if (settled) return;
      const c = await fromCache();
      if (c) finish(c); // شبکه در پس‌زمینه ادامه می‌دهد و کش را تازه می‌کند
    }, graceMs);
    fetch(req).then(
      (res) => {
        if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
        finish(res);
      },
      async () => {
        const c = await fromCache();
        finish(c || Response.error());
      },
    );
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // ── تصاویر (حتی بیرونی مثل تامنیل مطالب ذخیره‌شده) — کش با تازه‌سازی پس‌زمینه ──
  if (req.method === "GET" && req.destination === "image") {
    event.respondWith(
      caches.open(IMG_CACHE).then(async (cache) => {
        const cached =
          (await cache.match(req, { ignoreSearch: true })) ||
          (await caches.match(req, { ignoreSearch: true }));
        const fresh = fetch(req)
          .then((res) => {
            if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached || Response.error());
        return cached || fresh;
      })
    );
    return;
  }

  if (!isSameOriginGet(req)) return;
  const url = new URL(req.url);

  // ── به‌روزرسانی درون‌برنامه‌ای محتوا (مانیفست و بسته‌ها) — شبکهٔ خالص ──
  // سیستم updater خودش کش دارد (localStorage + IndexedDB) و باید همیشه
  // نسخهٔ واقعی مخزن را ببیند؛ مداخلهٔ SW اینجا باعث تعلیق fetch می‌شود.
  if (url.pathname.startsWith("/updates/")) return;

  // ── متون تنبل جلسه‌ها — شبکهٔ خالص ──
  // لودر texts.ts خودش کش IndexedDB دارد و نسخه‌بندی v را کنترل می‌کند؛
  // مثل /updates/ مداخلهٔ SW باعث تعلیق fetch می‌شود.
  if (url.pathname.startsWith("/texts/")) return;

  // ── داده‌های زندهٔ سرور: هیچ‌وقت کش نمی‌شوند (جز متن کامل قوانین و جلدها) ──
  if (url.pathname.startsWith("/api/")) {
    if (url.pathname.startsWith("/api/laws") || url.pathname.startsWith("/api/cover/")) {
      // stale-while-revalidate — پس از یک بار دیدن، آفلاین هم در دسترس است
      event.respondWith(
        caches.open(ASSET_CACHE).then(async (cache) => {
          const cached = await cache.match(req, { ignoreSearch: true });
          const fresh = fetch(req)
            .then((res) => {
              if (res && res.ok) cache.put(req, res.clone());
              return res;
            })
            .catch(() => cached || Response.error());
          return cached || fresh;
        })
      );
    }
    return; // بقیهٔ APIها — شبکهٔ خالص؛ آفلاین از «مطالب ذخیره‌شده» خوانده می‌شود
  }

  // ── ناوبری (HTML) — اول شبکه (با مهلت)، در نبود اینترنت از کش پوسته ──
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetchWithTimeout(req, 10000);
          if (res && res.ok) {
            caches.open(SHELL_CACHE).then((c) => c.put("/", res.clone())).catch(() => {});
          }
          return res;
        } catch {
          const shell = await caches.open(SHELL_CACHE);
          return (
            (await shell.match(req, { ignoreSearch: true })) ||
            (await shell.match("/")) ||
            (await caches.match(req, { ignoreSearch: true })) ||
            Response.error()
          );
        }
      })()
    );
    return;
  }

  // ── دارایی‌ها ──
  // فونت/رسانه/آیکن: پایدارند → کش اول (هم بستهٔ طراحی، هم کش پوستهٔ نصب).
  const isStableAsset =
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/media/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/favicon.svg" ||
    url.pathname === "/manifest.webmanifest";

  if (isStableAsset) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached =
          (await cache.match(req, { ignoreSearch: true })) ||
          (await caches.match(req, { ignoreSearch: true }));
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res && res.ok && res.type === "basic") cache.put(req, res.clone());
          return res;
        } catch {
          return Response.error();
        }
      })
    );
    return;
  }

  // چانک‌ها و CSS/JS — شبکه هرگز قطع نمی‌شود؛ آفلاین بلافاصله از کش (تطابق دقیق URL)
  if (url.pathname.startsWith("/_next/") || /\.(css|js|mjs)$/.test(url.pathname)) {
    event.respondWith(networkFirstNeverAbort(req, ASSET_CACHE, 10000));
    return;
  }

  // ── بقیه (مثلاً chunkهای dev/HMR و درخواست‌های ابزار توسعه) — همان راهبرد امن ──
  event.respondWith(networkFirstNeverAbort(req, ASSET_CACHE, 10000));
});
