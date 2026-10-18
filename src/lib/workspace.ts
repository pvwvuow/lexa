"use client";
/* Role-based home (phase A1 of docs/ADMIN_PLATFORM.md). Everyone lands on the workspace of their
 * role: a Lexa admin on the platform console, a centre owner / manager on the centre panel, everyone
 * else on the learning dashboard. People with more than one workspace switch with the workspace bar;
 * the choice is kept on this device. */
import * as React from "react";
import { onAuthChange, sbUser } from "@/lib/supabase";

/** "auto" = the role's own workspace, "learning" = the student dashboard, "org:<slug>" = one centre */
export type WorkspacePref = string;
const KEY = "lexa-workspace";
const EVENT = "lexa-workspace-change";

export function getWorkspacePref(): WorkspacePref {
  try { return window.localStorage.getItem(KEY) || "auto"; } catch { return "auto"; }
}

export function setWorkspacePref(v: WorkspacePref) {
  try { window.localStorage.setItem(KEY, v); } catch { /* private mode: session only */ }
  window.dispatchEvent(new Event(EVENT));
}

export function useWorkspacePref(): [WorkspacePref, (v: WorkspacePref) => void] {
  const [pref, setPref] = React.useState<WorkspacePref>("auto");
  React.useEffect(() => {
    const read = () => setPref(getWorkspacePref());
    read();
    window.addEventListener(EVENT, read);
    window.addEventListener("storage", read);
    return () => { window.removeEventListener(EVENT, read); window.removeEventListener("storage", read); };
  }, []);
  return [pref, setWorkspacePref];
}

/** signed in to the cloud (the console reads Supabase); re-read on sign-in / sign-out */
export function useCloudSignedIn(): boolean {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    setOn(!!sbUser());
    return onAuthChange(() => setOn(!!sbUser()));
  }, []);
  return on;
}

/** AppShell: show the full-screen platform console instead of the learning shell */
export function usePlatformConsoleActive(view: string, role: string | undefined): boolean {
  const [pref] = useWorkspacePref();
  const cloud = useCloudSignedIn();
  if (role !== "admin" || !cloud) return false;
  return view === "admin" || (view === "home" && pref !== "learning" && !pref.startsWith("org:"));
}

/** section of the platform console from the address: #/admin/<section> */
export function consoleSectionFromHash(fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const m = window.location.hash.match(/^#\/admin\/([a-z-]+)/);
  return m ? m[1] : fallback;
}
