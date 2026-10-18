"use client";
/* Study time (phase 4 of docs/ORG_LEARNING.md, supabase/009_study_time.sql).
 * Only ACTIVE time is recorded: the page must be visible and the user must have
 * interacted in the last two minutes. The client sends one 60-second heartbeat and
 * keeps an offline queue; the server (lexa_study_beat) is the trust boundary — it
 * re-checks the limits (1..120 s per beat, 3-minute gap, 12 h per day) and derives
 * the centre from official enrolment, never from what the client claims. */
import * as React from "react";
import { sbUser } from "@/lib/supabase";
import { sbRpc } from "./rest";

export type StudyDay = { day: string; seconds: number };
export type StudyPerson = {
  student_id: string;
  org_username: string;
  full_name: string;
  status?: string;
  seconds: number;
  days: number;
};

const SESSION_KEY = "lexa-study-uid";
const QUEUE_KEY = "lexa-study-q";
const DAY_KEY = "lexa-study-day";
const CAP = 12 * 3600; // 12 hours per day, same as the server

export function studyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e ?? "");
  if (/not signed in|JWT|401/.test(raw)) return "برای ثبت زمان مطالعه ابتدا وارد حساب کاربری خود شوید.";
  if (/bad_session|bad_seconds/.test(raw)) return "زمان ثبت‌شده نامعتبر بود و رد شد.";
  if (/Failed to fetch|NetworkError|TypeError/.test(raw)) return "اتصال به Lexa برقرار نشد؛ زمان آفلاین ذخیره می‌شود.";
  return "ثبت زمان مطالعه انجام نشد.";
}

/** stable per-page-load session id (one row per client session on the server) */
export function studySessionUid(): string {
  let uid = "";
  try {
    uid = sessionStorage.getItem(SESSION_KEY) ?? "";
    if (!uid) {
      uid = (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`)
        .replace(/[^A-Za-z0-9._-]/g, "").slice(0, 40) || `s-${Date.now().toString(36)}`;
      sessionStorage.setItem(SESSION_KEY, uid);
    }
  } catch {
    uid = `s-${Date.now().toString(36)}`;
  }
  return uid;
}

function localTodaySeconds(): number {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const j = JSON.parse(localStorage.getItem(DAY_KEY) ?? "null");
    if (j && j.day === today) return Number(j.seconds) || 0;
  } catch { /* fresh */ }
  return 0;
}

function localAddToday(sec: number): void {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const total = localTodaySeconds() + sec;
    localStorage.setItem(DAY_KEY, JSON.stringify({ day: today, seconds: total }));
  } catch { /* ignore */ }
}

/** queue seconds offline ( flushed on boot / online / sign-in) */
function queuePush(sec: number): void {
  try {
    const q = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as number[];
    q.push(sec);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-480)));
  } catch { /* ignore */ }
}

async function sendOne(sec: number): Promise<boolean> {
  try {
    await sbRpc("lexa_study_beat", { p_session: studySessionUid(), p_seconds: sec, p_org: null });
    localAddToday(sec);
    return true;
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e ?? "");
    if (/Failed to fetch|NetworkError|TypeError/.test(raw)) throw e; // offline → queue
    return false; // server rejected (cap etc.) — drop silently
  }
}

/** send one heartbeat; on failure the seconds go to the offline queue */
export async function beat(sec: number): Promise<void> {
  if (!sbUser()) return;
  if (localTodaySeconds() >= CAP) return; // daily cap — don't spam the server
  try {
    await sendOne(Math.min(Math.max(1, Math.round(sec)), 120));
  } catch {
    queuePush(sec);
  }
}

/** flush the offline queue (each queued chunk ≤ 120 s already) */
export async function flushStudyQueue(): Promise<void> {
  if (!sbUser()) return;
  let q: number[] = [];
  try {
    q = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as number[];
  } catch { return; }
  if (!q.length) return;
  const rest: number[] = [];
  for (const sec of q.slice(0, 40)) {
    try {
      const sent = await sendOne(sec);
      if (!sent) rest.push(sec); // rejected by server — drop? keep out either way
    } catch {
      rest.push(sec); // still offline
      break;
    }
  }
  const remaining = q.slice(40);
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([...rest, ...remaining]));
  } catch { /* ignore */ }
}

// --- queries ---

/** «آمار من»: own daily totals (default: the last 30 days) */
export function myStudy(from?: string, to?: string): Promise<StudyDay[]> {
  return sbRpc<StudyDay[]>("lexa_study_my", { p_from: from ?? null, p_to: to ?? null });
}

/** centre dashboard: per-student active seconds (managers, aal2) */
export function orgStudy(orgId: string, from?: string, to?: string): Promise<StudyPerson[]> {
  return sbRpc<StudyPerson[]>("lexa_study_org", { o: orgId, p_from: from ?? null, p_to: to ?? null });
}

/** teacher view: per-student active seconds inside one class */
export function classStudy(classId: string, from?: string, to?: string): Promise<StudyPerson[]> {
  return sbRpc<StudyPerson[]>("lexa_study_class", { k: classId, p_from: from ?? null, p_to: to ?? null });
}

/** phase 6: the comparison report (managers, aal2) */
export type CompareGroup = { key: string; n: number; shown: boolean; mean: number | null; median: number | null };
export type CompareReport = {
  n: number;
  with_final: number;
  window: { from: string; to: string };
  groups: CompareGroup[];
  thresholds: { inactive: number; low: number };
  diff: { shown: boolean; high_n: number; rest_n: number; high_mean: number | null; rest_mean: number | null; diff: number | null; lo: number | null; hi: number | null };
  control: { shown: boolean; n: number; r_raw: number | null; r_partial: number | null };
  scatter: { h: number; g: number; k: string }[];
  disclaimer: boolean;
};
export function compareReport(orgId: string, classId: string, termId: string, inactive: number, low: number): Promise<CompareReport> {
  return sbRpc<CompareReport>("lexa_compare_report", { o: orgId, p_class: classId, p_term: termId, p_inactive: inactive, p_low: low });
}

// --- formatting (Persian digits) ---
const faNum = new Intl.NumberFormat("fa-IR");

export const fa = (n: number): string => faNum.format(n);

export function faMinutes(sec: number): string {
  const m = Math.round(sec / 60);
  return `${fa(m)} دقیقه`;
}

export function faHours(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h <= 0) return faMinutes(sec);
  return m ? `${fa(h)} ساعت و ${fa(m)} دقیقه` : `${fa(h)} ساعت`;
}

export function faShortHours(sec: number): string {
  const h = sec / 3600;
  if (h < 1) return `${fa(Math.round(sec / 60))} دقیقه`;
  return `${faNum.format(Math.round(h * 10) / 10)} ساعت`;
}

const FA_DAYS = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];

export function faDayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const today = new Date().toISOString().slice(0, 10);
  if (iso === today) return "امروز";
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (iso === yesterday) return "دیروز";
  return `${FA_DAYS[d.getDay()]} ${faNum.format(d.getDate())} ${d.toLocaleDateString("fa-IR", { month: "long" })}`;
}

// --- the heartbeat hook: mounted once in the AppShell ---
export function useStudyBeat(signedIn: boolean): void {
  React.useEffect(() => {
    if (!signedIn) return;
    let last = Date.now();
    const touch = () => { last = Date.now(); };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    events.forEach((ev) => window.addEventListener(ev, touch, { passive: true }));

    void flushStudyQueue();
    const onOnline = () => { void flushStudyQueue(); };
    window.addEventListener("online", onOnline);

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return; // page not in front of the eyes
      if (Date.now() - last > 120_000) return; // no activity in the last 2 minutes
      void beat(60);
    }, 60_000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, touch));
      window.removeEventListener("online", onOnline);
      window.clearInterval(timer);
    };
  }, [signedIn]);
}
