// Server-only SSRF guard: outbound fetches to user-supplied URLs must reach the
// public internet only (no loopback / private / link-local / metadata hosts).
// Every redirect hop is re-checked and the body is read with a hard byte cap.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class NetGuardError extends Error {}

function v4Blocked(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

/** true = address must not be fetched by the server */
export function isBlockedIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return v4Blocked(ip);
  if (kind !== 6) return true;
  const s = ip.toLowerCase();
  const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return v4Blocked(mapped[1]);
  return (
    s === "::" ||
    s === "::1" ||
    s.startsWith("::ffff:") ||
    s.startsWith("64:ff9b:") ||
    s.startsWith("2001:db8") ||
    /^f[cd]/.test(s) ||
    /^fe[89ab]/.test(s) ||
    s.startsWith("ff")
  );
}

/** Throws NetGuardError unless the URL is http(s) and every resolved address is public. */
export async function assertPublicUrl(raw: string | URL): Promise<URL> {
  let u: URL;
  try {
    u = new URL(String(raw));
  } catch {
    throw new NetGuardError("نشانی URL نامعتبر است.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:")
    throw new NetGuardError("فقط نشانی http/https پذیرفته می‌شود.");
  const host = u.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  )
    throw new NetGuardError("دسترسی به نشانی‌های داخلی شبکه مجاز نیست.");
  let addrs: string[];
  if (isIP(host)) addrs = [host];
  else {
    try {
      addrs = (await lookup(host, { all: true, verbatim: true })).map((a) => a.address);
    } catch {
      throw new NetGuardError("نشانی پیدا نشد.");
    }
  }
  if (!addrs.length || addrs.some(isBlockedIp))
    throw new NetGuardError("دسترسی به نشانی‌های داخلی شبکه مجاز نیست.");
  return u;
}

/**
 * fetch with SSRF checks on every hop (manual redirects, max 5) and a streaming
 * byte cap, so a hostile server cannot exhaust memory by omitting Content-Length.
 */
export async function fetchPublic(
  raw: string,
  opts: { maxBytes: number; timeoutMs?: number; init?: RequestInit },
): Promise<{ res: Response; body: Buffer }> {
  const signal = AbortSignal.timeout(opts.timeoutMs ?? 90_000);
  let url = await assertPublicUrl(raw);
  for (let hop = 0; ; hop++) {
    const res = await fetch(url, { ...opts.init, redirect: "manual", signal });
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      if (hop >= 5) throw new NetGuardError("تعداد تغییر مسیرها بیش از حد است.");
      await res.body?.cancel().catch(() => {});
      url = await assertPublicUrl(new URL(loc, url));
      continue;
    }
    const tooBig = () => new NetGuardError("حجم فایل بیش از حد مجاز است.");
    if (Number(res.headers.get("content-length") ?? 0) > opts.maxBytes) {
      await res.body?.cancel().catch(() => {});
      throw tooBig();
    }
    const chunks: Buffer[] = [];
    let total = 0;
    if (res.body) {
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > opts.maxBytes) {
          await reader.cancel().catch(() => {});
          throw tooBig();
        }
        chunks.push(Buffer.from(value));
      }
    }
    return { res, body: Buffer.concat(chunks) };
  }
}
