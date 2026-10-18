"use client";
/* Role-based home (phase A1 of docs/ADMIN_PLATFORM.md). AppShell renders this for #/ instead of the
 * student dashboard. A centre owner / manager lands on the centre panel; a user with more than one
 * workspace gets the workspace bar to switch (Lexa console, each managed centre, learning). The Lexa
 * admin's console itself is rendered full-screen by AppShell (usePlatformConsoleActive). */
import * as React from "react";
import { BookOpen, Building2, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/lib/auth-client";
import { useManagedOrgs } from "@/lib/cloud-api/orgs";
import { useCloudSignedIn, useWorkspacePref } from "@/lib/workspace";
import { OrgView } from "@/components/app/OrgView";
import { cx } from "./ConsoleKit";

export function WorkspaceHome({ learningHome }: { learningHome: React.ReactNode }) {
  const auth = useAuth();
  const cloud = useCloudSignedIn();
  const { orgs } = useManagedOrgs();
  const [pref, setPref] = useWorkspacePref();
  const isAdmin = auth.user?.role === "admin" && cloud;

  const wanted = pref.startsWith("org:") ? pref.slice(4) : "";
  const org = orgs.find((o) => o.slug === wanted) ?? (pref === "learning" ? undefined : orgs[0]);
  const showOrg = !!org && pref !== "learning";

  const items: { key: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [];
  if (isAdmin) items.push({ key: "auto", label: "کنسول مدیریت Lexa", icon: LayoutDashboard });
  for (const o of orgs) items.push({ key: `org:${o.slug}`, label: `پنل ${o.name}`, icon: Building2 });
  if (items.length) items.push({ key: "learning", label: "محیط یادگیری", icon: BookOpen });
  const current = showOrg && org ? `org:${org.slug}` : "learning";

  return (
    <>
      {items.length > 1 && (
        <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6" dir="rtl">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
            <span className="text-[12px] font-bold text-muted-foreground">محیط کار:</span>
            <div role="tablist" className="flex flex-wrap gap-1">
              {items.map((it) => {
                const on = it.key === current;
                const Icon = it.icon;
                return (
                  <button key={it.key} type="button" role="tab" aria-selected={on} onClick={() => setPref(it.key)}
                    className={cx("inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold transition-colors",
                      on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                    <Icon className="h-4 w-4" />{it.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {showOrg && org ? <OrgView key={org.slug} id={org.slug} /> : learningHome}
    </>
  );
}
