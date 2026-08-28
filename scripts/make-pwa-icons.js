// ساخت آیکن‌های PWA از لوگو — پس‌زمینهٔ زمردی + لوگوی مرکزی
// خروجی: public/icons/pwa-192.png، pwa-512.png، pwa-maskable-512.png، apple-touch-icon.png
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const svg = fs.readFileSync("public/favicon.svg");

async function render(size, file, { pad = 0.14, maskable = false } = {}) {
  const bg = "#0d211a";
  const inner = Math.round(size * (1 - pad * 2));
  const logo = await sharp(svg, { density: 300 })
    .resize(inner, inner)
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: bg,
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(file);
  console.log("made", file, size + "x" + size, maskable ? "(maskable)" : "");
}

(async () => {
  const dir = "public/icons";
  fs.mkdirSync(dir, { recursive: true });
  // آیکن معمولی — فاوآیکن پس‌زمینهٔ خودش را دارد؛ تقریباً تمام‌صفحه
  await render(192, path.join(dir, "pwa-192.png"), { pad: 0.02 });
  await render(512, path.join(dir, "pwa-512.png"), { pad: 0.02 });
  // maskable — ناحیهٔ امن: لوگو کوچک‌تر تا برش دایرهٔ لانچر نخورده باشد
  await render(512, path.join(dir, "pwa-maskable-512.png"), { pad: 0.16, maskable: true });
  // apple-touch-icon — iOS خودش گوشه گرد می‌کند
  await render(180, "public/icons/apple-touch-icon.png", { pad: 0.02 });
})();
