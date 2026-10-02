#!/usr/bin/env python3
"""تولید آیکون‌های اندروید (mipmap) و اسپلش Lexa از لوگوی pwa-512"""
from PIL import Image, ImageDraw, ImageOps
import os

SRC = "/home/z/my-project/public/icons/pwa-512.png"
AND = "/home/z/my-project/android"
BG = (13, 33, 26, 255)  # سبز عمیق برند #0d211a

os.makedirs(f"{AND}/assets", exist_ok=True)

src = Image.open(SRC).convert("RGBA")

# ── آیکون اصلی (پس‌زمینهٔ برند + آیکون با حاشیه) ──
def make_icon(size):
    canvas = Image.new("RGBA", (size, size), BG)
    # آیکون با گوشهٔ گرد در مرکز — 72٪ اندازه
    inner = int(size * 0.72)
    icon = src.resize((inner, inner), Image.LANCZOS)
    # ماسک دایره‌ای نرم
    mask = Image.new("L", (inner, inner), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, inner - 1, inner - 1], radius=int(inner * 0.22), fill=255)
    canvas.paste(icon, ((size - inner) // 2, (size - inner) // 2), mask)
    return canvas

# ── آیکون round (دایره کامل) ──
def make_round(size):
    canvas = Image.new("RGBA", (size, size), BG)
    inner = int(size * 0.74)
    icon = src.resize((inner, inner), Image.LANCZOS)
    mask = Image.new("L", (inner, inner), 0)
    d = ImageDraw.Draw(mask)
    d.ellipse([0, 0, inner - 1, inner - 1], fill=255)
    canvas.paste(icon, ((size - inner) // 2, (size - inner) // 2), mask)
    return canvas

# ── foreground adaptive (اندام آیکون در ناحیهٔ امن 66٪) ──
def make_fg(size):
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner = int(size * 0.58)
    icon = src.resize((inner, inner), Image.LANCZOS)
    mask = Image.new("L", (inner, inner), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, inner - 1, inner - 1], radius=int(inner * 0.22), fill=255)
    canvas.paste(icon, ((size - inner) // 2, (size - inner) // 2), mask)
    return canvas

dens = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
for d, px in dens.items():
    mdir = f"{AND}/app/src/main/res/mipmap-{d}"
    os.makedirs(mdir, exist_ok=True)
    make_icon(px).save(f"{mdir}/ic_launcher.png")
    make_round(px).save(f"{mdir}/ic_launcher_round.png")
    make_fg(px).save(f"{mdir}/ic_launcher_foreground.png")

# background adaptive
for d, px in dens.items():
    Image.new("RGBA", (px, px), BG).save(f"{AND}/app/src/main/res/mipmap-{d}/ic_launcher_background.png")

# ── اسپلش ۲۷۳۲×۲۷۳۲ — پس‌زمینهٔ برند + لوگو مرکز ──
S = 2732
splash = Image.new("RGBA", (S, S), BG)
icon = src.resize((640, 640), Image.LANCZOS)
mask = Image.new("L", (640, 640), 0)
d = ImageDraw.Draw(mask)
d.rounded_rectangle([0, 0, 639, 639], radius=140, fill=255)
splash.paste(icon, ((S - 640) // 2, (S - 640) // 2 - 120), mask)
# نام Lexa زیر لوگو — با فونت پیش‌فرض نمی‌شود فارسی نوشت؛ لوگو کافی است
splash.save(f"{AND}/assets/splash.png", optimize=True)

print("icons + splash generated")
