"use client";
/* Active study time (phase 4 of docs/ORG_LEARNING.md, supabase/009_study_time.sql).
 * Counts only while the page is visible and the user did something in the last 2 minutes.
 * Seconds are collected per minute (max 60), queued in localStorage per account (works offline)
 * and sent every 60 s. The server keeps one row per user and minute, so resending is harmless.
 *
 *   startStudyTracker()            once, in AppShell
 *   useStudyContext("tcourse", id) in a reader / player / exam screen
 *   trackLearningEvent(...)        when a lesson, quiz or review is finished */
import * as React from "react";
import { sbUser } from "@/lib/supabase";
import { sbRpc } from "@/lib/cloud-api/rest";

export type StudyKind = "course" | "tcourse" | "post" | "book" | "exam" | "flashcards" | "quiz" | "law" | "other";
export type LearningEventKind = "lesson_done" | "quiz_done" | "cards_reviewed" | "exam_done";

const TICK_MS = 15_000;
const IDLE_MS = 120_000;
const FLUSH_MS = 60_000;
const KEEP_MS = 13 * 24 * 3600_000;
const MAX_BEATS = 400;
const MAX_EVENTS = 150;

interface Beat { s: number; k: StudyKind; i: string; sent?: number }
interface Ev { id: string; t: string; k: LearningEventKind; ik: StudyKind; i: string; v: number | null }
interface Queue { beats: Record<string, Beat>; events: Ev[] }

let started = false;
let lastActivity = 0;
let lastTick = 0;
let flushing = false;
const ctxStack: { kind: StudyKind; item: string }[] = [];
const listeners = new Set<() => void>();

const keyFor = (uid: string) => `lexa.study.v1.${uid}`;

function load(uid: string): Queue {
  try {
    const raw = localStorage.getItem(keyFor(uid));
    const q = raw ? (JSON.parse(raw) as Queue) : null;
    if (q && typeof q === "object" && q.beats && Array.isArray(q.events)) return q;
  } catch { /* broken entry: start again */ }
  return { beats: {}, events: [] };
}

function save(uid: string, q: Queue): void {
  const cutoff = Date.now() - KEEP_MS;
  for (const m of Object.keys(q.beats)) if (Date.parse(m) < cutoff) delete q.beats[m];
  q.events = q.events.filter((e) => Date.parse(e.t) >= cutoff).slice(-500);
  try {
    localStorage.setItem(keyFor(uid), JSON.stringify(q));
  } catch { /* storage full: keep going in memory next tick */ }
}

const minuteKey = (ms: number) => new Date(Math.floor(ms / 60_000) * 60_000).toISOString();

function current(): { kind: StudyKind; item: string } {
  return ctxStack[ctxStack.length - 1] ?? { kind: "other", item: "" };
}

function active(now: number): boolean {
  return typeof document !== "undefined" && document.visibilityState === "visible" && now - lastActivity < IDLE_MS;
}

function tick(): void {
  const now = Date.now();
  const elapsed = Math.min(now - lastTick, TICK_MS * 1.5);
  lastTick = now;
  const u = sbUser();
  if (!u || !active(now) || elapsed <= 0) return;
  const q = load(u.id);
  const key = minuteKey(now);
  const c = current();
  const b = q.beats[key] ?? { s: 0, k: c.kind, i: c.item };
  b.s = Math.min(60, b.s + Math.round(elapsed / 1000));
  b.k = c.kind;
  b.i = c.item;
  q.beats[key] = b;
  save(u.id, q);
  listeners.forEach((f) => f());
}

/** send what is queued (also called when the page is hidden) */
export async function flushStudy(): Promise<void> {
  const u = sbUser();
  if (!u || flushing) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  const q = load(u.id);
  const pending = Object.entries(q.beats).filter(([, b]) => b.s > 0 && b.sent !== b.s).slice(0, MAX_BEATS);
  const events = q.events.slice(0, MAX_EVENTS);
  if (!pending.length && !events.length) return;
  flushing = true;
  try {
    await sbRpc("lexa_study_track", {
      beats: pending.map(([t, b]) => ({ t, s: b.s, k: b.k, i: b.i })),
      events: events.map((e) => ({ id: e.id, t: e.t, k: e.k, ik: e.ik, i: e.i, v: e.v })),
    });
    const after = load(u.id);
    const nowKey = minuteKey(Date.now());
    for (const [t, b] of pending) {
      const cur = after.beats[t];
      if (!cur) continue;
      if (t < nowKey && cur.s === b.s) delete after.beats[t];
      else cur.sent = b.s;
    }
    const sentIds = new Set(events.map((e) => e.id));
    after.events = after.events.filter((e) => !sentIds.has(e.id));
    save(u.id, after);
  } catch {
    /* offline or server error: everything stays queued */
  } finally {
    flushing = false;
  }
}

function onActivity(): void {
  lastActivity = Date.now();
}

function onVisibility(): void {
  if (document.visibilityState === "hidden") {
    tick();
    void flushStudy();
  } else {
    lastTick = Date.now();
    lastActivity = Date.now();
  }
}

/** start once (idempotent); safe on the server render */
export function startStudyTracker(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  lastActivity = Date.now();
  lastTick = Date.now();
  const opts: AddEventListenerOptions = { passive: true, capture: true };
  for (const ev of ["pointerdown", "keydown", "wheel", "touchstart", "scroll"]) window.addEventListener(ev, onActivity, opts);
  let lastMove = 0;
  window.addEventListener("mousemove", () => {
    const n = Date.now();
    if (n - lastMove > 5000) { lastMove = n; onActivity(); }
  }, opts);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("online", () => void flushStudy());
  window.setInterval(tick, TICK_MS);
  window.setInterval(() => void flushStudy(), FLUSH_MS);
  window.setTimeout(() => void flushStudy(), 5000);
}

/** what the user is studying right now; the innermost screen wins */
export function useStudyContext(kind: StudyKind, item: string | null | undefined): void {
  React.useEffect(() => {
    const entry = { kind, item: String(item ?? "").slice(0, 80) };
    ctxStack.push(entry);
    return () => {
      const i = ctxStack.lastIndexOf(entry);
      if (i >= 0) ctxStack.splice(i, 1);
    };
  }, [kind, item]);
}

export function trackLearningEvent(kind: LearningEventKind, itemKind: StudyKind, item: string, value: number | null = null): void {
  const u = sbUser();
  if (!u) return;
  const q = load(u.id);
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));
  q.events.push({ id, t: new Date().toISOString(), k: kind, ik: itemKind, i: String(item ?? "").slice(0, 80), v: value });
  save(u.id, q);
}

/** seconds recorded on this device that the server has not confirmed yet (for "my stats") */
export function unsentSeconds(): number {
  const u = sbUser();
  if (!u) return 0;
  return Object.values(load(u.id).beats).reduce((a, b) => a + Math.max(0, b.s - (b.sent ?? 0)), 0);
}

export function onStudyTick(f: () => void): () => void {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

/** drop the local queue of this account (after "delete my study data") */
export function clearStudyQueue(): void {
  const u = sbUser();
  if (!u) return;
  try { localStorage.removeItem(keyFor(u.id)); } catch { /* ignore */ }
}
