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
  | { view: "admin" };

export function routeToHash(r: Route): string {
  switch (r.view) {
    case "home": return "#/";
    case "course": return `#/course/${r.id}`;
    case "learn": return `#/learn/${r.id}`;
    case "quiz": return r.id ? `#/quiz/${r.id}` : "#/quiz";
    case "case": return r.id ? `#/case/${r.id}` : "#/case";
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
  if (["cards", "progress", "settings", "import", "admin"].includes(head)) return { view: head as never };
  return { view: "home" };
}

export function navigate(r: Route) {
  if (typeof window !== "undefined") window.location.hash = routeToHash(r);
}

export function useRoute(): Route {
  const [route, setRoute] = React.useState<Route>({ view: "home" });
  React.useEffect(() => {
    const update = () => setRoute(parseHash(window.location.hash));
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return route;
}
