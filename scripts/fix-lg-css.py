#!/usr/bin/env python3
"""Rewrite the liquid-glass CSS block in globals.css (lines 295..365) with a
faithful liquid-glass implementation: luminous edges, specular sheen,
float shadow, clear tinted glass readable in both themes."""
import io

PATH = "/home/z/my-project/src/app/globals.css"

with io.open(PATH, encoding="utf-8") as f:
    lines = f.readlines()

# Sanity check the anchor lines (1-based 295..365 -> idx 294..364)
assert "liquid-glass" in lines[294], lines[294]
assert ".lg-card" in lines[358], lines[358]

NEW = """/* ─── شیشهٔ مایع (Liquid Glass) — بازآفرینی وفادار به liquid-glass-vue ───────
   https://github.com/polidario/Frontend-Projects/tree/main/liquid-glass-vue
   فرمول مرجع: شیشهٔ شفافِ روشن (brightness + بلور ملایم) که رنگِ پشتش را
   نشان می‌دهد، حلقهٔ نور داخلی روی لبهٔ شیشه، برق مورّب نور روی سطح و
   سایهٔ شناور بزرگ. تینت هر تم جدا تنظیم شده تا شیشه در هر دو دیده شود.
   نکته: فقط اعلان استاندارد backdrop-filter — اگر -webkit- هم نوشته شود
   Lightning CSS (Tailwind v4) اعلان استاندارد را حذف می‌کند و بلور از بین می‌رود. */

/* لایهٔ شکست نور — فقط کرومیوم؛ محتوای پشت شیشه را با نقشۀ جابه‌جایی می‌شکند */
.lg-refract {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  backdrop-filter: url(#lg-displacement);
}

/* برق مشخصهٔ شیشه — بازتاب مورّب نور روی سطح + خطِ باریک روشن لبهٔ بالا */
.lg-spec {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background: linear-gradient(105deg,
    rgb(255 255 255 / 0.30) 0%,
    rgb(255 255 255 / 0.12) 15%,
    rgb(255 255 255 / 0.02) 34%,
    rgb(255 255 255 / 0) 58%,
    rgb(255 255 255 / 0.07) 86%,
    rgb(255 255 255 / 0.14) 100%);
  box-shadow: inset 0 1px 0.5px -0.25px rgb(255 255 255 / 0.55);
}
.dark .lg-spec {
  background: linear-gradient(105deg,
    rgb(255 255 255 / 0.16) 0%,
    rgb(255 255 255 / 0.06) 15%,
    rgb(255 255 255 / 0.01) 34%,
    rgb(255 255 255 / 0) 58%,
    rgb(255 255 255 / 0.04) 86%,
    rgb(255 255 255 / 0.08) 100%);
  box-shadow: inset 0 1px 0.5px -0.25px rgb(255 255 255 / 0.35);
}

/* داک موبایل — شیشهٔ شناور: پرشدگی سفید گرادیانی، لبهٔ نورانی، سایهٔ معلق */
.lg-dock {
  border: 1px solid rgb(255 255 255 / 0.55);
  background: linear-gradient(105deg,
    rgb(255 255 255 / 0.52) 0%,
    rgb(255 255 255 / 0.30) 34%,
    rgb(255 255 255 / 0.22) 62%,
    rgb(255 255 255 / 0.36) 100%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.65),
    inset 0 -1px 0.5px -0.5px rgb(255 255 255 / 0.35),
    0 24px 48px -16px rgb(10 22 17 / 0.40),
    0 6px 16px -6px rgb(10 22 17 / 0.30);
  backdrop-filter: blur(20px) saturate(1.8) brightness(1.06);
}
.dark .lg-dock {
  border-color: rgb(255 255 255 / 0.22);
  background: linear-gradient(105deg,
    rgb(46 62 56 / 0.62) 0%,
    rgb(38 52 47 / 0.52) 40%,
    rgb(30 42 38 / 0.55) 100%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.22),
    inset 0 -1px 0.5px -0.5px rgb(255 255 255 / 0.10),
    0 24px 48px -16px rgb(0 0 0 / 0.60),
    0 6px 16px -6px rgb(0 0 0 / 0.45);
  backdrop-filter: blur(20px) saturate(1.55) brightness(1.14);
}

/* آیتم فعال داک — کپسول شیشه‌ای روشن که روی شیشهٔ داک می‌درخشد */
.lg-dock-btn-active {
  color: var(--primary);
  border: 1px solid rgb(255 255 255 / 0.75);
  background: linear-gradient(135deg, rgb(255 255 255 / 0.85), rgb(255 255 255 / 0.45));
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.95),
    0 4px 12px -4px rgb(10 22 17 / 0.40);
  backdrop-filter: blur(8px) saturate(1.5);
}
.dark .lg-dock-btn-active {
  color: rgb(216 181 113);
  border-color: rgb(255 255 255 / 0.30);
  background: linear-gradient(135deg, rgb(255 255 255 / 0.24), rgb(255 255 255 / 0.09));
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.40),
    0 4px 12px -4px rgb(0 0 0 / 0.50);
}

/* کارت شیشه‌ای هیرو — پنۀ شفافِ روشن: رنگِ پنل از پشتش می‌درخشد */
.lg-card {
  border: 1px solid rgb(255 255 255 / 0.38);
  background: linear-gradient(120deg,
    rgb(255 255 255 / 0.17) 0%,
    rgb(255 255 255 / 0.07) 32%,
    rgb(255 255 255 / 0.05) 62%,
    rgb(255 255 255 / 0.11) 100%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.30),
    inset 0 -1px 0.5px -0.5px rgb(255 255 255 / 0.14),
    0 22px 44px -18px rgb(3 12 9 / 0.55),
    0 6px 16px -8px rgb(3 12 9 / 0.35);
  backdrop-filter: blur(12px) saturate(1.65) brightness(1.16);
}
.dark .lg-card {
  border-color: rgb(255 255 255 / 0.22);
  background: linear-gradient(120deg,
    rgb(255 255 255 / 0.12) 0%,
    rgb(255 255 255 / 0.05) 32%,
    rgb(255 255 255 / 0.04) 62%,
    rgb(255 255 255 / 0.08) 100%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.18),
    inset 0 -1px 0.5px -0.5px rgb(255 255 255 / 0.08),
    0 22px 44px -18px rgb(0 0 0 / 0.55),
    0 6px 16px -8px rgb(0 0 0 / 0.40);
  backdrop-filter: blur(12px) saturate(1.5) brightness(1.10);
}

/* اسکلت/حالت خالی — همان شیشه، کم‌رنگ‌تر که با کارت واقعی قاطی نشود */
.lg-skeleton {
  border: 1px solid rgb(255 255 255 / 0.22);
  background: linear-gradient(120deg, rgb(255 255 255 / 0.10), rgb(255 255 255 / 0.04));
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.14);
  backdrop-filter: blur(10px) saturate(1.4) brightness(1.10);
}
"""

out = lines[:294] + [NEW] + lines[365:]
with io.open(PATH, "w", encoding="utf-8") as f:
    f.writelines(out)
print("OK — replaced lines 295..365 with new liquid-glass system")
