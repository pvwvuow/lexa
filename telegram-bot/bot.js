#!/usr/bin/env bun
/**
 * بات تلگرام «ویس به متن» — @voicetotextunibot
 * بدون هیچ وابستگی npm (bun یا node18+، فقط ffmpeg لازم است)
 *
 * اجرا:
 *   bun bot.js once   → یک بار آپدیت‌های در انتظار را پردازش می‌کند و خارج می‌شود (حالت تست)
 *   bun bot.js serve  → long-polling دائمی (برای سرور ۲۴/۷)
 *
 * موتور تشخیص گفتار: Whisper large-v3-turbo (لوکال، CPU) از طریق transcribe.py
 * فایل‌های بلند به قطعات ~۹.۵ دقیقه‌ای بریده و پشت‌سرهم ارسال می‌شوند.
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const ROOT = "/home/z/my-project/telegram-bot";
const TMP = path.join(ROOT, "tmp");
const STATE_FILE = path.join(ROOT, "state.json");
fs.mkdirSync(TMP, { recursive: true });

// --- .env loader (بدون وابستگی) ---
for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const TOKEN = process.env.TG_BOT_TOKEN;
if (!TOKEN) throw new Error("TG_BOT_TOKEN is missing");
const API = `https://api.telegram.org/bot${TOKEN}`;

// --- state ---
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return { offset: 0, last: {} };
  }
}
const state = loadState();
const saveState = () => fs.writeFileSync(STATE_FILE, JSON.stringify(state));

// --- helpers ---
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tg(method, body = {}) {
  const r = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`${method}: ${JSON.stringify(j).slice(0, 200)}`);
  return j.result;
}

function run(cmd, args, timeout = 560000) {
  const p = spawnSync(cmd, args, { timeout, maxBuffer: 64e6 });
  if (p.error) throw p.error;
  if (p.status !== 0) throw new Error(`${cmd} failed: ${p.stderr?.toString().slice(-300)}`);
  return p.stdout.toString();
}

function probeDuration(wav) {
  try {
    return parseFloat(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav]).trim()) || 0;
  } catch {
    return 0;
  }
}

function transcribeChunk(wav) {
  return run("python3", [path.join(ROOT, "transcribe.py"), wav]).trim();
}

function splitMessage(text, limit = 3800) {
  const parts = [];
  let cur = "";
  for (const line of text.split("\n")) {
    if ((cur + line + "\n").length > limit && cur) {
      parts.push(cur.trimEnd());
      cur = "";
    }
    cur += line + "\n";
  }
  if (cur.trim()) parts.push(cur.trimEnd());
  return parts;
}

const HELP = `🎙️ <b>ویس به متن</b> — موتور Whisper large-v3-turbo

هر <b>ویس</b> یا <b>فایل صوتی</b> بفرست (مثلًا ضبط کلاس) تا متن فارسیش را بفرستم.

• فایل‌های بلند خودکار تیکه‌تیکه پردازش می‌شوند
• <code>/clean</code> — ویرایش و پاراگراف‌بندی آخرین متن (اگر فعال باشد)
• برای بهترین نتیجه، صوت را در قالب voice یا فایل mp3/m4a/ogg بفرست`;

// --- polish (اختیاری؛ وقتی POLISH_KEY تنظیم شود) ---
async function polish(text) {
  const base = process.env.POLISH_BASE;
  const key = process.env.POLISH_KEY;
  if (!base || !key) {
    return "ℹ️ ویرایش هوشمند فعلاً خاموش است (کلید API تنظیم نشده). متن خام معتبر است.";
  }
  const r = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.POLISH_MODEL || "grok-4.7",
      messages: [
        {
          role: "system",
          content:
            "ویراستار متون فارسی هستی. متنِ پیاده‌شدهٔ یک کلاس/سخنرانی را بدون تغییر معنا و بدون حذف محتوا، با نیم‌فاصلهٔ درست، علائم نگارشی و پاراگراف‌بندی تمیز بازنویسی کن. فقط متن نهایی را برگردان.",
        },
        { role: "user", content: text },
      ],
    }),
  });
  const j = await r.json();
  const out = j?.choices?.[0]?.message?.content;
  if (!out) throw new Error(`polish: ${JSON.stringify(j).slice(0, 200)}`);
  return out;
}

// --- main pipeline ---
async function handle(m) {
  const chatId = m.chat?.id;
  if (!chatId) return;

  if (m.text) {
    if (m.text === "/start" || m.text === "/help") {
      await tg("sendMessage", { chat_id: chatId, text: HELP, parse_mode: "HTML" });
      return;
    }
    if (m.text === "/clean") {
      const last = state.last[chatId];
      if (!last) {
        await tg("sendMessage", { chat_id: chatId, text: "هنوز متنی نداری؛ اول ویس بفرست." });
        return;
      }
      const st = await tg("sendMessage", { chat_id: chatId, text: "✍️ در حال ویرایش..." });
      try {
        const out = await polish(last);
        for (const part of splitMessage(out)) {
          await tg("sendMessage", { chat_id: chatId, text: part });
        }
      } catch (e) {
        await tg("editMessageText", { chat_id: chatId, message_id: st.message_id, text: `❌ ویرایش ناموفق: ${e.message}` });
      }
      return;
    }
    return;
  }

  const f = m.voice || m.audio || m.video_note || m.video ||
    (m.document && /audio|video|ogg|mpeg|mp4/i.test(m.document.mime_type || m.document.file_name || "") ? m.document : null);
  if (!f) return;

  if ((f.file_size || 0) > 19_500_000) {
    await tg("sendMessage", {
      chat_id: chatId,
      text: "⚠️ حجم فایل بیش از سقف ۲۰MB سرور بات تلگرام است. لطفاً به‌صورت «ویس» بفرست (فشرده‌تر است) یا فایل را کوتاه‌تر/تیکه‌تیکه بفرست.",
    });
    return;
  }

  const st = await tg("sendMessage", {
    chat_id: chatId,
    text: `🎧 دریافت شد (${Math.round((f.duration || 0) / 6) / 10 || "?"} دقیقه). در حال تبدیل به متن با Whisper large-v3-turbo...`,
  });

  const base = path.join(TMP, `msg_${m.message_id}`);
  try {
    const info = await tg("getFile", { file_id: f.file_id });
    const dl = await fetch(`https://api.telegram.org/file/bot${TOKEN}/${info.file_path}`);
    fs.writeFileSync(base + "_src", Buffer.from(await dl.arrayBuffer()));

    const wav = base + ".wav";
    run("ffmpeg", ["-y", "-v", "error", "-i", base + "_src", "-ac", "1", "-ar", "16000", wav]);

    const dur = probeDuration(wav);
    const CHUNK = 570; // ۹.۵ دقیقه
    let chunks = [wav];
    if (dur > CHUNK + 30) {
      run("ffmpeg", ["-y", "-v", "error", "-i", wav, "-f", "segment", "-segment_time", String(CHUNK), "-ar", "16000", "-ac", "1", `${base}_seg%03d.wav`]);
      chunks = fs.readdirSync(TMP).filter((x) => x.startsWith(`${path.basename(base)}_seg`) && x.endsWith(".wav")).sort().map((x) => path.join(TMP, x));
    }

    let full = "";
    for (let i = 0; i < chunks.length; i++) {
      const t = transcribeChunk(chunks[i]);
      if (chunks.length > 1) {
        // هر جزء بلافاصله ارسال می‌شود تا اگر وسط کار قطع شد، بخش‌های انجام‌شده از دست نروند
        await tg("sendMessage", { chat_id: chatId, text: `— جزء ${i + 1} از ${chunks.length} —\n${t}` });
        try {
          await tg("editMessageText", { chat_id: chatId, message_id: st.message_id, text: `⏳ جزء ${i + 1} از ${chunks.length} انجام شد...` });
        } catch {}
      }
      full += (chunks.length > 1 ? `\n— جزء ${i + 1} از ${chunks.length} —\n` : "") + t + "\n";
    }
    if (chunks.length === 1) {
      for (const part of splitMessage(full)) await tg("sendMessage", { chat_id: chatId, text: part });
    }
    state.last[chatId] = full.trim();
    saveState();
    console.log(`[ok] msg ${m.message_id}: ${full.length} chars, ${chunks.length} chunk(s)`);
  } catch (e) {
    await tg("sendMessage", { chat_id: chatId, text: `❌ خطا در پردازش: ${e.message}` });
    console.error(`[err] msg ${m.message_id}:`, e.message);
  } finally {
    for (const x of fs.readdirSync(TMP)) if (x.startsWith(`msg_${m.message_id}`)) fs.rmSync(path.join(TMP, x), { force: true });
  }
}

async function pollOnce(timeoutSec) {
  const updates = await tg("getUpdates", {
    offset: state.offset || undefined,
    timeout: timeoutSec,
    allowed_updates: ["message", "channel_post"],
  });
  for (const u of updates) {
    state.offset = u.update_id + 1;
    saveState();
    const m = u.message || u.channel_post;
    if (m) await handle(m);
  }
  return updates.length;
}

async function main() {
  const mode = process.argv[2] || "once";
  if (mode === "once") {
    const n = await pollOnce(0);
    console.log(`[once] processed ${n} update(s), offset=${state.offset}`);
  } else if (mode === "serve") {
    console.log("[serve] long-polling started — Ctrl+C to stop");
    for (;;) {
      try {
        await pollOnce(25);
      } catch (e) {
        console.error("[serve]", e.message);
        await sleep(3000);
      }
    }
  } else {
    throw new Error(`unknown mode: ${mode}`);
  }
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
