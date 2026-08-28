/*
 * همیار حقوق — Service Worker
 * راهبرد: پوستهٔ طراحی (HTML/JS/CSS/فونت/تصاویر) کش می‌شود تا سایت آفلاین هم با همان
 * ظاهر بالا بیاید؛ ولی پاسخ‌های JSON مسیر /api/* هرگز کش نمی‌شوند — مطالبِ سروری فقط
 * با «بستهٔ آفلاین مطالب» (ذخیرهٔ دستی در تنظیمات) در دسترس می‌ماند.
 */
const VERSION = "hh-pwa-v2";
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

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((c) => c.addAll(CORE_URLS))
      .then(() => self.skipWaiting())
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

/* پیام از صفحه: «بستهٔ طراحی» را پیش‌بارگذاری کن */
self.addEventListener("message", (event) => {
  if (event.data?.type === "PRECACHE_SHELL") {
    const urls = Array.isArray(event.data.urls) ? event.data.urls : [];
    event.waitUntil(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        await cache.addAll(["/", ...urls]);
        const clients = await self.clients.matchAll();
        clients.forEach((c) => c.postMessage({ type: "PRECACHE_DONE", count: urls.length + 1 }));
      })()
    );
  }
});

/** فقط درخواست‌های GETِ هم‌مبدا */
function isSameOriginGet(req) {
  return req.method === "GET" && new URL(req.url).origin === self.location.origin;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (!isSameOriginGet(req)) return;
  const url = new URL(req.url);

  // ── داده‌های زندهٔ سرور: هیچ‌وقت کش نمی‌شوند (جز متن کامل قوانین و جلدها) ──
  if (url.pathname.startsWith("/api/")) {
    if (url.pathname.startsWith("/api/laws") || url.pathname.startsWith("/api/cover/")) {
      // stale-while-revalidate — پس از یک بار دیدن، آفلاین هم در دسترس است
      event.respondWith(
        caches.open(ASSET_CACHE).then(async (cache) => {
          const cached = await cache.match(req);
          const fresh = fetch(req)
            .then((res) => {
              if (res && res.ok) cache.put(req, res.clone());
              return res;
            })
            .catch(() => cached);
          return cached || fresh;
        })
      );
    }
    return; // بقیهٔ APIها — شبکهٔ خالص؛ آفلاین از «بستهٔ مطالب» خوانده می‌شود
  }

  // ── ناوبری (HTML) — اول شبکه، در نبود اینترنت از کش ──
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(SHELL_CACHE).then((c) => c.put("/", res.clone())).catch(() => {});
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match("/")) || Response.error())
    );
    return;
  }

  // ── دارایی‌ها ──
  // فونت/رسانه/آیکن: پایدارند → کش اول.
  // چانک‌های _next (مخصوصاً در حالت dev) تغییر می‌کنند → اول شبکه با پس‌افت کش.
  const isStableAsset =
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/media/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/favicon.svg" ||
    url.pathname === "/manifest.webmanifest";

  if (isStableAsset) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
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

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            caches.open(ASSET_CACHE).then((c) => c.put(req, res.clone())).catch(() => {});
          }
          return res;
        })
        .catch(async () => (await caches.match(req)) || Response.error())
    );
    return;
  }

  // ── بقیه (مثلاً chunkهای dev/HMR) — اول شبکه با پس‌افت کش ──
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && req.url.startsWith(self.location.origin)) {
          caches.open(ASSET_CACHE).then((c) => c.put(req, res.clone())).catch(() => {});
        }
        return res;
      })
      .catch(async () => (await caches.match(req)) || Response.error())
  );
});
