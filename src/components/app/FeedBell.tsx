"use client";

// ─── زنگ «تازه‌ها» — شمار مطلب‌های جدید استادها از آخرین بازدید ───────────────
import * as React from "react";
import { Bell, GraduationCap } from "lucide-react";
import { useSocial } from "@/lib/social-client";
import { navigate } from "@/lib/router";
import { fa } from "@/lib/fa";
import { faDate } from "@/components/app/DashboardView";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "./common";

const SEEN_KEY = "lexa-feed-seen";
const LEGACY_SEEN_KEY = "hh-feed-seen";

function readSeen(): number {
  try { return Number(window.localStorage.getItem(SEEN_KEY) ?? window.localStorage.getItem(LEGACY_SEEN_KEY)) || 0; } catch { return 0; }
}

export function FeedBell() {
  const { feed } = useSocial();
  const [seen, setSeen] = React.useState(0);
  React.useEffect(() => setSeen(readSeen()), []);

  const fresh = React.useMemo(
    () => feed.filter((p) => new Date(p.createdAt).getTime() > seen),
    [feed, seen],
  );
  const count = Math.min(fresh.length, 9);

  return (
    <DropdownMenu
      onOpenChange={(o) => {
        if (o) {
          const now = Date.now() + 60_000; // تا پست‌های همان لحظه هم دیده شوند
          try { window.localStorage.setItem(SEEN_KEY, String(now)); } catch {}
          setSeen(now);
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`تازه‌های استادها${count ? ` — ${fa(count)} مطلب جدید` : ""}`}
          title="تازه‌های استادها"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/[0.07] text-white/85 shadow-card transition-colors hover:border-bronze/70 hover:text-bronze"
        >
          <Bell className="h-[17px] w-[17px]" />
          {count > 0 && (
            <span className="absolute -top-1 -end-1 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-bronze px-1 text-[9.5px] font-extrabold text-bronze-foreground shadow-card">
              {fa(count)}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-80 rounded-2xl p-1.5">
        <p className="flex items-center gap-2 px-2.5 pb-1.5 pt-2 text-xs font-extrabold">
          <Bell className="h-3.5 w-3.5 text-bronze" /> تازه‌های استادها
        </p>
        {feed.length === 0 ? (
          <p className="px-2.5 pb-2.5 text-[11px] leading-relaxed text-muted-foreground">
            هنوز مطلبی منتشر نشده؛ بعد از انتشار، اینجا خبر می‌شوی.
          </p>
        ) : (
          <>
            {feed.slice(0, 6).map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => navigate({ view: "post", id: p.id })}
                className="cursor-pointer gap-2.5 rounded-xl py-2"
              >
                <UserAvatar src={p.author.avatarUrl} name={p.author.displayName} size="xs" />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[12px] font-bold ${fresh.some((f) => f.id === p.id) ? "text-bronze" : ""}`}>
                    {p.title}
                  </span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {p.author.displayName} · {faDate(p.createdAt)}
                  </span>
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => navigate({ view: "teachers" })}
              className="cursor-pointer gap-2 rounded-xl py-2 text-[11.5px] font-bold text-bronze"
            >
              <GraduationCap className="h-3.5 w-3.5" /> همهٔ اساتید و مقالات
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
