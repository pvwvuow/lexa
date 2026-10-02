/* سرور ایستای ساده برای اکسپورت APK — پورت 3001 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const ROOT = path.join(process.cwd(), "out");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".txt": "text/plain", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon" };
http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || "/").split("?")[0]);
  let f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    if (fs.existsSync(path.join(ROOT, p, "index.html"))) f = path.join(ROOT, p, "index.html");
    else if (p.startsWith("/api/")) { res.writeHead(404, { "Content-Type": "application/json" }); res.end('{"error":"not-found"}'); return; }
    else f = path.join(ROOT, "index.html");
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(3001, () => console.log("serving out/ on 3001"));
