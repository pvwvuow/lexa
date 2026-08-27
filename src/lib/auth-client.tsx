"use client";

import * as React from "react";
import { useApp, buildSyncSnapshot } from "@/lib/store";
import type { PublicUser, SyncSnapshot } from "@/lib/auth-shared";

interface AuthCtx {
  user: PublicUser | null;
  status: "loading" | "guest" | "authed";
  syncing: boolean;
  lastSavedAt: string | null;
  login(username: string, password: string): Promise<{ ok: boolean; error?: string }>;
  register(username: string, password: string): Promise<{ ok: boolean; error?: string }>;
  logout(): Promise<void>;
  syncNow(): Promise<boolean>;
}

const Ctx = React.createContext<AuthCtx | null>(null);

export function useAuth(): AuthCtx {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useAuth باید داخل AuthProvider استفاده شود");
  return v;
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  return (await res.json()) as T;
}

const PERSIST_KEY = "hamyar-hoghough-v1";

/**
 * نسخهٔ پشتیبانِ صرفاً محلی از دادهٔ مهمانِ همین دستگاه.
 * طبق سیاست اپ، هنگام ورود به حساب موجود دادهٔ مهمان «ادغام نمی‌شود»؛
 * برای اینکه چیزی هم گم نشود، یک کپی فقط روی همین مرورگر نگه می‌داریم.
 */
function backupGuestBlob() {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
    const st = parsed?.state ?? {};
    const hasData =
      Object.keys((st.progress as object) ?? {}).length > 0 ||
      Object.keys((st.notes as object) ?? {}).length > 0 ||
      (((st.customCourses as unknown[]) ?? []).length > 0);
    if (!hasData) return;
    localStorage.setItem(
      "hamyar-guest-backup-v1",
      JSON.stringify({ savedAt: new Date().toISOString(), data: parsed })
    );
  } catch {}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<PublicUser | null>(null);
  const [status, setStatus] = React.useState<AuthCtx["status"]>("loading");
  const [syncing, setSyncing] = React.useState(false);
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(null);

  // پرچم جلوگیری از push در هنگام دریافت اولیهٔ داده‌ها
  const hydratingRef = React.useRef(true);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const userRef = React.useRef(user);
  userRef.current = user;

  /** ارسال اسنپ‌شات کامل وضعیت به سرور (ادغامی و امن) */
  const flush = React.useCallback(async (): Promise<boolean> => {
    const u = userRef.current;
    if (!u) return false;
    setSyncing(true);
    try {
      const state = useApp.getState();
      const body = buildSyncSnapshot({
        progress: state.progress,
        activity: state.activity,
        notes: state.notes,
        customCourses: state.customCourses,
        lastLocation: state.lastLocation as unknown as Record<string, string>,
        streak: state.streak,
      });
      const res = await fetch("/api/user/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { savedAt?: string };
      if (data.savedAt) setLastSavedAt(data.savedAt);
      return true;
    } catch {
      return false;
    } finally {
      setSyncing(false);
    }
  }, []);

  // نشست جاری هنگام بارگذاری
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const meRes = await fetch("/api/auth/me");
        const me = (await meRes.json()) as { user: PublicUser | null };
        if (!alive) return;
        if (!me.user) {
          setStatus("guest");
          hydratingRef.current = false;
          return;
        }
        setUser(me.user);
        userRef.current = me.user;
        // دریافت داده‌های ذخیره‌شدهٔ کاربر و ادغام با داده‌های محلی دستگاه
        try {
          const dataRes = await fetch("/api/user/data");
          if (dataRes.ok) {
            const data = (await dataRes.json()) as { snapshot: SyncSnapshot };
            if (data.snapshot && useApp.getState().mergeServerSnapshot) {
              useApp.getState().mergeServerSnapshot(data.snapshot);
            }
          }
        } catch {}
        setStatus("authed");
        // پس از دریافت، یک flush اولیه تا داده‌های صرفاً محلی هم به سرور برسند
        void flush().finally(() => {
          hydratingRef.current = false;
        });
      } catch {
        if (alive) {
          setStatus("guest");
          hydratingRef.current = false;
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // همگام‌سازی خودکار تغییرات store با فاصلهٔ خواب ۳ ثانیه
  React.useEffect(() => {
    if (status !== "authed") return;
    const unsub = useApp.subscribe(() => {
      if (hydratingRef.current || !userRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void flush();
      }, 3000);
    });
    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [status, flush]);

  // ذخیرهٔ نهایی پیش از ترک صفحه
  React.useEffect(() => {
    function onHide() {
      if (document.visibilityState === "hidden" && userRef.current) {
        void flush();
      }
    }
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", () => void flush());
    return () => {
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [flush]);

  /** پس از ورود/ثبت‌نام؛ رفتار دو مسیر کاملاً متفاوت است */
  const afterAuth = React.useCallback(
    async (u: PublicUser, mode: "login" | "register") => {
      setUser(u);
      userRef.current = u;
      setStatus("authed");

      if (mode === "login") {
        // ── ورود به حساب موجود: بدون هیچ ادغامی ──
        // ۱) پشتیبان محلی از وضعیت مهمان این دستگاه (هرگز به حساب نمی‌رود)
        backupGuestBlob();
        // ۲) جایگزینی کامل وضعیت محلی با نسخهٔ ذخیره‌شدهٔ سرور
        hydratingRef.current = true;
        try {
          const dataRes = await fetch("/api/user/data");
          if (dataRes.ok) {
            const data = (await dataRes.json()) as { snapshot: SyncSnapshot };
            if (data.snapshot) useApp.getState().replaceFromServer(data.snapshot);
          }
        } catch {}
        setTimeout(() => {
          hydratingRef.current = false;
        }, 500);
        return;
      }

      // ── ثبت‌نام حساب جدید: پیشرفتِ بی‌حسابِ همین دستگاه به آن منتقل می‌شود ──
      try {
        const dataRes = await fetch("/api/user/data");
        if (dataRes.ok) {
          const data = (await dataRes.json()) as { snapshot: SyncSnapshot };
          if (data.snapshot) useApp.getState().mergeServerSnapshot(data.snapshot);
        }
      } catch {}
      await flush();
    },
    [flush]
  );

  const login = React.useCallback<AuthCtx["login"]>(
    async (username, password) => {
      try {
        const data = await jsonFetch<{ user?: PublicUser; error?: string }>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ username, password }),
        });
        if (data.user) {
          await afterAuth(data.user, "login");
          return { ok: true };
        }
        return { ok: false, error: data.error ?? "خطای ناشناخته." };
      } catch {
        return { ok: false, error: "ارتباط با سرور برقرار نشد." };
      }
    },
    [afterAuth]
  );

  const register = React.useCallback<AuthCtx["register"]>(
    async (username, password) => {
      try {
        const data = await jsonFetch<{ user?: PublicUser; error?: string }>(
          "/api/auth/register",
          { method: "POST", body: JSON.stringify({ username, password }) }
        );
        if (data.user) {
          await afterAuth(data.user, "register");
          return { ok: true };
        }
        return { ok: false, error: data.error ?? "خطای ناشناخته." };
      } catch {
        return { ok: false, error: "ارتباط با سرور برقرار نشد." };
      }
    },
    [afterAuth]
  );

  const logout = React.useCallback(async () => {
    try {
      await flush(); // آخرین ذخیره
    } catch {}
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    // پشتیبان محلی، سپس حذف داده‌های محلی؛ چون همه چیز امن در پایگاه داده ماندگار است
    backupGuestBlob();
    hydratingRef.current = true;
    useApp.setState({
      progress: {},
      streak: { count: 0, lastDate: "" },
      activity: [],
      customCourses: [],
      notes: {},
      lastLocation: {},
    });
    try { localStorage.removeItem("hoh_weak_topics"); } catch {}
    userRef.current = null;
    setUser(null);
    setLastSavedAt(null);
    setStatus("guest");
    setTimeout(() => (hydratingRef.current = false), 500);
  }, [flush]);

  const value = React.useMemo<AuthCtx>(
    () => ({ user, status, syncing, lastSavedAt, login, register, logout, syncNow: flush }),
    [user, status, syncing, lastSavedAt, login, register, logout, flush]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
