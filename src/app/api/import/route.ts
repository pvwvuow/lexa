import { NextResponse } from 'next/server';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * دریافت PDF از URL (یا متن خام) + استخراج متن + برش خودکار به قطعات فصل/جلسه
 * body: { url?, rawText? , mode:'text'|'outline' }
 */
async function fetchText(url: string): Promise<{ text: string; bytes: number }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(90_000), redirect: 'follow' });
  if (!res.ok) throw new Error(`دانلود فایل ناموفق بود (HTTP ${res.status}).`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 30 * 1024 * 1024) throw new Error('حجم فایل بیش از حد مجاز است (۳۰ مگابایت).');
  try {
    const parsed = await pdfParse(buf);
    let text = (parsed.text || '')
      .replace(/-\n(?=\p{L})/gu, '')      // اتصال واژه‌های شکسته
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (!text || text.length < 400) throw new Error('متن قابل استخراج یافت نشد؛ احتمالاً PDF تصویری (Scan) است.');
    text = text.slice(0, 300_000);       // سقف استخراج
    return { text, bytes: buf.length };
  } catch (e) {
    if (e instanceof Error && e.message.includes('تصویری')) throw e;
    throw new Error('پردازش PDF ناموفق بود. می‌توانید متن را دستی الصاق کنید.');
  }
}

function smartSlice(text: string, count: number): string[] {
  // برش هوشمند: تلاش برای بریدن روی مرز پاراگراف/جمله
  const target = Math.ceil(text.length / count);
  const out: string[] = [];
  let cur = 0;
  while (cur < text.length) {
    let end = Math.min(cur + target, text.length);
    if (end < text.length) {
      // نزدیک‌ترین مرز جمله قبل از end+800 پیدا می‌شود
      let best = -1;
      for (let i = end; i > end - 1500 && i > cur + 500; i--) {
        if (/[.!؟]$/.test(text[i] ?? '')) { best = i + 1; break; }
      }
      if (best > 0) end = best;
    }
    out.push(text.slice(cur, end).trim());
    cur = end;
  }
  return out.filter(Boolean);
}

export async function POST(req: Request) {
  try {
    const { url, rawText } = (await req.json()) as { url?: string; rawText?: string };
    let full = '';
    if (rawText && rawText.trim().length > 200) full = rawText.trim();
    else if (url) full = (await fetchText(url.trim())).text;
    else return NextResponse.json({ error: 'آدرس PDF یا متن را وارد کنید.' }, { status: 400 });

    // گام دوم: برش به ۲۴ قطعهٔ مساوی؛ کلاینت آن‌ها را بین جلسات انتخاب‌شده تقسیم می‌کند
    const slices = smartSlice(full, 24).map((s) => s.slice(0, 9000));
    return NextResponse.json({
      titleGuess: firstMeaningfulLine(full),
      length: full.length,
      slices,
      preview: full.slice(0, 700),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[IMPORT]', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

function firstMeaningfulLine(t: string): string {
  for (const line of t.split('\n').slice(0, 40)) {
    const clean = line.replace(/[^\p{L}\p{N} ]/gu, '').trim();
    if (clean.length >= 5 && /[ا-ی]/.test(clean)) return clean.slice(0, 60);
  }
  return 'دورهٔ وارداتی';
}
