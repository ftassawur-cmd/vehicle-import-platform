import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { m, useReducedMotion } from "framer-motion";
import { Moon, Sun, ArrowUpRight } from "lucide-react";
import { useTheme } from "@/hooks";
import { ruleVersion } from "@/lib/rules";

/* ── Logo: two ports, one route ── */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" className="shrink-0">
        <path d="M4 19 C 8 6, 18 6, 22 12" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="4" cy="19" r="2.6" fill="var(--accent)" />
        <circle cx="22" cy="12" r="2.6" fill="none" stroke="var(--accent)" strokeWidth="2" />
      </svg>
      {!compact && (
        <span className="font-display text-[17px] font-bold tracking-tight">
          JSL<span className="text-mute font-medium"> Imports</span>
        </span>
      )}
    </span>
  );
}

export function ThemeToggle() {
  const [theme, toggle] = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className="grid size-9 place-items-center rounded-full border border-line text-mute transition-colors hover:border-accent/60 hover:text-ink"
    >
      {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}

/* ── Header ── */
const NAV = [
  { href: "/#math", label: "The math" },
  { href: "/#rules", label: "2026 rules" },
  { href: "/#faq", label: "FAQ" },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header
      data-noprint
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300 ${
        scrolled ? "glass border-b border-line-soft" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link to="/" aria-label="JSL Imports home" className="rounded-md">
          <Logo />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="text-[14px] text-mute transition-colors hover:text-ink">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {pathname !== "/calculator" && (
            <Link to="/calculator" className="btn-primary !px-5 !py-2 !text-[14px]">
              Price a vehicle <ArrowUpRight size={15} />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

/* ── Footer ── */
export function Footer() {
  return (
    <footer data-noprint className="border-t border-line-soft bg-bg-deep">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.3fr_1fr_1.4fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-mute">
            Japan → Sri Lanka vehicle import costs, itemised to the rupee and traced to their gazettes.
          </p>
          <p className="eyebrow mt-5">rule-set {ruleVersion}</p>
        </div>
        <nav aria-label="Footer" className="flex flex-col gap-2.5 text-[14px]">
          <span className="eyebrow mb-1">Product</span>
          <Link className="text-mute hover:text-ink" to="/calculator">Calculator</Link>
          {NAV.map((n) => (
            <a key={n.href} className="text-mute hover:text-ink" href={n.href}>{n.label}</a>
          ))}
        </nav>
        <div className="text-[13px] leading-relaxed text-faint">
          <span className="eyebrow mb-1 block text-mute">Accuracy posture</span>
          Rates and regulations change by gazette without notice. Results are estimates with dated
          rule-set provenance and explicit confidence badges — not customs brokerage, legal, or tax
          advice. Verify with a licensed Customs House Agent and Sri Lanka Customs before financial
          commitment.
          <p className="mt-4 text-mute">© 2026 JSL Imports</p>
        </div>
      </div>
    </footer>
  );
}

/* ── Scroll-reveal wrapper (fires once) ── */
export function Reveal({
  children, delay = 0, y = 18, className,
}: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </m.div>
  );
}

/* ── Ambient starfield (hero only, very quiet) ── */
export function Starfield({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0, h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    type Star = { x: number; y: number; r: number; p: number; s: number };
    let stars: Star[] = [];

    const seed = () => {
      stars = Array.from({ length: Math.round((w * h) / 16000) }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.1 + 0.3,
        p: Math.random() * Math.PI * 2,
        s: Math.random() * 0.12 + 0.03,
      }));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      if (reduced) draw(0); // single static frame
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const light = document.documentElement.dataset.theme === "light";
      for (const st of stars) {
        const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(st.p + t * 0.0012));
        ctx.globalAlpha = (light ? 0.16 : 0.5) * tw;
        ctx.fillStyle = light ? "#4353e0" : "#aeb9ff";
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fill();
        if (!reduced) {
          st.y += st.s; st.x -= st.s * 0.4;
          if (st.y > h + 2) { st.y = -2; st.x = Math.random() * w; }
          if (st.x < -2) st.x = w + 2;
        }
      }
      ctx.globalAlpha = 1;
      if (!reduced && !document.hidden) raf = requestAnimationFrame(draw);
    };

    const onVis = () => { if (!document.hidden && !reduced) raf = requestAnimationFrame(draw); };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    if (!reduced) raf = requestAnimationFrame(draw);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reduced]);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
