"use client";

import * as React from "react";
import { LogIn, LogOut, RefreshCw, ShieldCheck, UserRound, CloudCheck, Loader2, GraduationCap, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-client";
import { navigate } from "@/lib/router";
import { fa } from "@/lib/fa";
import { AuthDialog } from "./AuthDialog";
import { UserAvatar } from "./common";

/** بخش حساب کاربری در هدر: مهمان → دکمهٔ ورود؛ واردشده → منوی حساب */
export function AccountArea() {
  const auth = useAuth();
  const [open, setOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);

  if (auth.status === "loading") {
    return <span aria-hidden className="inline-block h-10 w-10 animate-pulse rounded-xl bg-muted" />;
  }

  // ── مهمان ──
  if (!auth.user) {
    return (
      <>
        {/* دکمهٔ فیبر کربن — بافت تاریک بافته‌ای با لبهٔ براق و درخشش برنز */}
        <button
          onClick={() => setOpen(true)}
          title="ورود یا ساخت حساب کاربری"
          className="btn-carbon inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-bold text-bronze"
        >
          <span className="btn-carbon-glow" aria-hidden />
          <LogIn className="relative z-10 h-[18px] w-[18px]" />
          <span className="relative z-10 hidden sm:inline">ورود / ثبت‌نام</span>
        </button>
        <AuthDialog open={open} onOpenChange={setOpen} />
      </>
    );
  }

  // ── کاربر واردشده ──
  const u = auth.user;
  const savedTime =
    auth.lastSavedAt &&
    new Date(auth.lastSavedAt).toLocaleTimeString("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
    });

  async function doLogout() {
    setLeaving(true);
    await auth.logout();
    setLeaving(false);
    navigate({ view: "home" });
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-2 pe-2.5 ps-1.5 shadow-card transition-colors hover:border-bronze/60"
            aria-label={`حساب ${u.username}`}
          >
            <UserAvatar src={u.avatarUrl} name={u.username} size="xs" />
            <span className="hidden max-w-[110px] truncate text-start text-xs font-bold sm:block">
              {u.username}
            </span>
            <CloudCheck className="h-4 w-4 text-success" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" sideOffset={8} className="w-64 rounded-xl p-2">
          <DropdownMenuLabel dir="rtl" className="space-y-0.5 px-2">
            <p className="flex items-center gap-1.5 text-sm font-bold leading-none">
              {u.role === "admin" ? (
                <ShieldCheck className="h-4 w-4 text-bronze" />
              ) : u.role === "teacher" ? (
                <GraduationCap className="h-4 w-4 text-bronze" />
              ) : null}
              {u.username}
            </p>
            <p className="text-[11px] font-medium leading-relaxed text-muted-foreground">
              {u.role === "admin"
                ? "مدیر سامانه"
                : u.role === "teacher"
                  ? "استاد Lexa"
                  : `عضو از ${new Date(u.createdAt).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" })}`}
            </p>
            <p className="flex items-center gap-1 pt-0.5 text-[10.5px] text-muted-foreground/80">
              {auth.syncing ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> در حال همگام‌سازی…
                </>
              ) : savedTime ? (
                <>
                  <CloudCheck className="h-3 w-3 text-success" /> ذخیره شده در {savedTime}
                </>
              ) : (
                <>همگام‌سازی خودکار فعال</>
              )}
            </p>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          {u.role === "teacher" && (
            <DropdownMenuItem
              onClick={() => { setMenuOpen(false); navigate({ view: "studio" }); }}
              className="cursor-pointer rounded-lg gap-2 text-bronze"
            >
              <GraduationCap className="h-4 w-4" /> اتاق استاد
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            onClick={() => { setMenuOpen(false); navigate({ view: "settings" }); }}
            className="cursor-pointer rounded-lg gap-2"
          >
            <Settings className="h-4 w-4" /> تنظیمات و پروفایل
          </DropdownMenuItem>

          {u.role === "admin" && (
            <DropdownMenuItem
              onClick={() => { setMenuOpen(false); navigate({ view: "admin" }); }}
              className="cursor-pointer rounded-lg gap-2 text-bronze"
            >
              <ShieldCheck className="h-4 w-4" /> پنل مدیریت
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            onClick={async () => { setMenuOpen(false); await auth.syncNow(); }}
            className="cursor-pointer rounded-lg gap-2"
          >
            {auth.syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            همگام‌سازی اکنون
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={doLogout}
            disabled={leaving}
            className="cursor-pointer rounded-lg gap-2 text-destructive focus:text-destructive"
          >
            {leaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            خروج از حساب
          </DropdownMenuItem>

          <div className="rounded-lg border border-dashed border-border px-2.5 py-2 text-[10px] leading-relaxed text-muted-foreground/80">
            دادهٔ شما بیرون از همین مرورگر هم از دست نمی‌رود؛ با ورود دوباره همه چیز برمی‌گردد.
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

/** آمار کوچک داخل سایدبار برای حس اطمینان (فقط وقتی وارد شده) */
export function SyncHint({ collapsed = false }: { collapsed?: boolean }) {
  const auth = useAuth();
  if (auth.status !== "authed" || !auth.user) return null;
  // منوی جمع‌شده: این نوشته‌ها جای غلطی برای فضای باریک‌اند و پنهان می‌شوند
  if (collapsed) return null;
  return (
    <p className="mt-1 px-3 text-center text-[10px] leading-relaxed text-muted-foreground/70">
      حساب «{auth.user.username}» فعال است — پیشرفت شما خودکار ذخیره می‌شود
      {auth.lastSavedAt ? ` · ${fa(new Date(auth.lastSavedAt).getHours())}:${fa(String(new Date(auth.lastSavedAt).getMinutes()).padStart(2, "0"))}` : ""}
    </p>
  );
}
