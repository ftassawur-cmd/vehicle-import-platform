import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useReducedMotion } from "framer-motion";

/* ── Theme ── */
export type Theme = "dark" | "light";

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document !== "undefined" && document.documentElement.dataset.theme === "light"
      ? "light"
      : "dark"
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("jsl-theme", theme); } catch { /* private mode */ }
  }, [theme]);
  const toggle = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);
  return [theme, toggle];
}

/* ── Springy number: animates toward `value` on change ── */
export function useCountUp(value: number, duration = 900): number {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef(0);

  useEffect(() => {
    if (reduced || duration <= 0) { fromRef.current = value; setDisplay(value); return; }
    const from = fromRef.current;
    if (from === value) return;
    const start = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 4); // easeOutQuart
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const v = from + (value - from) * ease(p);
      setDisplay(v);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration, reduced]);

  return display;
}

/* ── Per-route document meta ── */
export function usePageMeta(title: string, description?: string): void {
  useEffect(() => {
    document.title = title;
    if (description) {
      const el = document.querySelector('meta[name="description"]');
      if (el) el.setAttribute("content", description);
    }
  }, [title, description]);
}

/* ── IntersectionObserver, fires once ── */
export function useInViewOnce<T extends Element>(margin = "-80px"): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && setSeen(true),
      { rootMargin: margin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen, margin]);
  return [ref, seen];
}
