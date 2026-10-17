"use client";
/* Routes the social /api/* calls of every platform to the cloud handlers
 * (handlers.ts). Imported once for its side effect from auth-client.tsx, so it
 * runs before any screen fetches. Calls that are not ours fall through to the
 * previous fetch: the local Next server on desktop / self-hosted web, or the
 * APK shim (404 JSON) in static builds. Turn it off with
 * NEXT_PUBLIC_CLOUD_SOCIAL=0 to keep the old SQLite social routes. */
import { CLOUD_SOCIAL, IS_APK } from "@/lib/app-mode";
import { matchCloudRoute, runCloud, type CloudReq } from "./handlers";

declare global {
  interface Window { __lexaCloudApi?: boolean }
}

function apiUrlOf(input: RequestInfo | URL): URL | null {
  try {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    if (!raw) return null;
    const u = new URL(raw, window.location.href);
    const local = u.origin === window.location.origin || u.hostname === "localhost";
    if (!local || !u.pathname.startsWith("/api/")) return null;
    return u;
  } catch {
    return null;
  }
}

async function readBody(input: RequestInfo | URL, init?: RequestInit): Promise<{ body: unknown; form: FormData | null }> {
  let b: unknown = init?.body;
  if (b === undefined && typeof Request !== "undefined" && input instanceof Request) {
    try { b = await input.clone().text(); } catch { b = undefined; }
  }
  if (typeof FormData !== "undefined" && b instanceof FormData) return { body: null, form: b };
  if (typeof b === "string" && b) {
    try { return { body: JSON.parse(b), form: null }; } catch { return { body: null, form: null }; }
  }
  return { body: null, form: null };
}

if (typeof window !== "undefined" && CLOUD_SOCIAL && !window.__lexaCloudApi && typeof window.fetch === "function") {
  window.__lexaCloudApi = true;
  const prev = window.fetch.bind(window);
  const hasServer = !IS_APK;
  window.fetch = function lexaCloudFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = apiUrlOf(input);
    if (!url) return prev(input, init);
    const method = String(init?.method || (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")).toUpperCase();
    const fn = matchCloudRoute(method, url.pathname, hasServer);
    if (!fn) return prev(input, init);
    return (async () => {
      const { body, form } = await readBody(input, init);
      const req: CloudReq = { method, path: url.pathname, query: url.searchParams, body, form };
      const res = await runCloud(fn, req);
      return new Response(JSON.stringify(res.body ?? {}), {
        status: res.status,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    })();
  } as typeof window.fetch;
}

export {};
