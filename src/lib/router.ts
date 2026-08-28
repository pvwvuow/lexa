"use client";

import * as React from "react";

export type Route =
  | { view: "home" }
  | { view: "course"; id: string }
  | { view: "learn"; id: string }
  | { view: "quiz"; id?: string }
  | { view: "case"; id?: string }
  | { view: "cards" }
  | { view: "progress" }
  | { view: "settings" }
  | { view: "import" }
  | { view: "admin" }
  | { view: "teachers" }
  | { view: "studio" }
  | { view: "post"; id: string }
  | { view: "library" }
  | { view: "law"; id?: string }
  | { view: "teacher"; id: string };

export function routeToHash(r: Route): string {
  switch (r.view) {
    case "home": return "#/";
    case "course": return `#/course/${r.id}`;
    case "learn": return `#/learn/${r.id}`;
    case "quiz": return r.id ? `#/quiz/${r.id}` : "#/quiz";
    case "case": return r.id ? `#/case/${r.id}` : "#/case";
    case "post": return `#/post/${r.id}`;
    case "teacher": return `#/teacher/${r.id}`;
    case "law": return r.id ? `#/law/${r.id}` : "#/law";
    default: return `#/${r.view}`;
  }
}

export function parseHash(h: string): Route {
  const parts = h.replace(/^#\/?/, "").split("/").filter(Boolean);
  const [head, id] = parts;
  if (!head) return { view: "home" };
  if (head === "course" && id) return { view: "course", id };
  if (head === "learn" && id) return { view: "learn", id };
  if (head === "quiz") return { view: "quiz", id };
  if (head === "case") return { view: "case", id };
  if (head === "post" && id) return { view: "post", id };
  if (head === "teacher" && id) return { view: "teacher", id };
  if (head === "law") return { view: "law", id: id || undefined };
  if (["cards", "progress", "settings", "import", "admin", "teachers", "studio", "library"].includes(head)) return { view: head as never };
  return { view: "home" };
}

// ─── تاریخچهٔ ناوبری — برای دکمهٔ «بازگشت به صفحهٔ قبل» ───────────────────────
// پشتهٔ سبک از هش‌ها؛ در یادگیری عمیق سقف دارد تا حافظه رشد نکند.
const MAX_HISTORY = 32;
let navHistory: string[] = [];
if (typeof window !== "undefined") navHistory = [window.location.hash || "#/"];

export function navigate(r: Route) {
  if (typeof window !== "undefined") window.location.hash = routeToHash(r);
}

/** یک قدم به عقب؛ اگر تاریخی نبود به خانه می‌رود */
export function goBack() {
  if (typeof window === "undefined") return;
  if (navHistory.length > 1) window.history.back();
  else window.location.hash = "#/";
}

export function useRoute(): Route {
  const [route, setRoute] = React.useState<Route>({ view: "home" });
  React.useEffect(() => {
    const update = () => {
      const h = window.location.hash || "#/";
      // ثبت در پشتهٔ داخلی (بدون تکرار پشت‌سرهم)
      if (navHistory[navHistory.length - 1] !== h) {
        navHistory.push(h);
        if (navHistory.length > MAX_HISTORY) navHistory = navHistory.slice(-MAX_HISTORY);
      }
      setRoute(parseHash(h));
    };
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return route;
}
