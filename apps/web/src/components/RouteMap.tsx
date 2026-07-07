import { useReducedMotion } from "framer-motion";

const ROUTE = "M 598 52 C 470 148, 250 58, 44 186";

/** Decorative Yokohama → Colombo arc behind the hero card. */
export function RouteMap({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  return (
    <svg viewBox="0 0 640 240" aria-hidden="true" className={className} fill="none">
      <path d={ROUTE} stroke="var(--line)" strokeWidth="1.5" />
      <path
        d={ROUTE}
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="3 9"
        className="animate-dash-flow"
        opacity="0.9"
      />
      {/* ports */}
      <g fontFamily="IBM Plex Mono, monospace" fontSize="10" letterSpacing="0.12em">
        <circle cx="598" cy="52" r="4" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
        <text x="590" y="34" textAnchor="end" fill="var(--mute)">YOKOHAMA · 35.4°N</text>
        <circle cx="44" cy="186" r="4" fill="var(--accent)" />
        <text x="56" y="212" fill="var(--mute)">COLOMBO · 6.9°N</text>
      </g>
      {/* vessel */}
      {!reduced && (
        <circle r="3.5" fill="var(--accent)">
          <animateMotion dur="9s" repeatCount="indefinite" path={ROUTE} />
        </circle>
      )}
    </svg>
  );
}
