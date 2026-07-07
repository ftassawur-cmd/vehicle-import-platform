/**
 * Typed environment. Loaded once at import; the process refuses to boot in
 * production with placeholder secrets. Mirrors /.env.example — every key
 * consumed anywhere in the API is declared here, nowhere else.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/* Load .env from the repo root (or cwd) without a dotenv dependency,
   matching the loader in /prisma.config.ts. Ambient env always wins. */
for (const dir of [".", "..", "../.."]) {
  try {
    const raw = readFileSync(resolve(process.cwd(), dir, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (!m || line.trimStart().startsWith("#")) continue;
      let val = m[2]!;
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      if (process.env[m[1]!] === undefined) process.env[m[1]!] = val;
    }
    break;
  } catch {
    /* keep walking up */
  }
}

const str = (key: string, fallback?: string): string => {
  const v = process.env[key];
  if (v !== undefined && v !== "") return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`[env] Missing required environment variable ${key}`);
};

const int = (key: string, fallback: number): number => {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`[env] ${key} must be a number, got '${v}'`);
  return n;
};

/** "15m" | "30d" | "12h" | "45s" → milliseconds. */
export function durationMs(spec: string, key = "duration"): number {
  const m = /^(\d+)\s*(ms|s|m|h|d)$/.exec(spec.trim());
  if (!m) throw new Error(`[env] ${key} must look like '15m' or '30d', got '${spec}'`);
  const n = Number(m[1]);
  const unit = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2] as "ms" | "s" | "m" | "h" | "d"];
  return n * unit;
}

const nodeEnv = str("NODE_ENV", "development");
const isProd = nodeEnv === "production";

export const env = {
  nodeEnv,
  isProd,
  port: int("PORT", 3000),

  databaseUrl: str("DATABASE_URL", isProd ? undefined : "postgresql://jsl:jsl@localhost:5432/jsl_imports"),

  jwtAccessSecret: str("JWT_ACCESS_SECRET", isProd ? undefined : "dev-access-secret-change-me"),
  jwtRefreshSecret: str("JWT_REFRESH_SECRET", isProd ? undefined : "dev-refresh-secret-change-me"),
  accessTokenTtlMs: durationMs(str("ACCESS_TOKEN_TTL", "15m"), "ACCESS_TOKEN_TTL"),
  refreshTokenTtlMs: durationMs(str("REFRESH_TOKEN_TTL", "30d"), "REFRESH_TOKEN_TTL"),
  argon2MemoryKib: int("ARGON2_MEMORY_KIB", 65536),

  appUrl: str("APP_URL", "http://localhost:5173"),
  apiUrl: str("API_URL", "http://localhost:3000"),
  cookieDomain: process.env["COOKIE_DOMAIN"] || undefined,

  smtp: {
    host: process.env["SMTP_HOST"] || "",
    port: int("SMTP_PORT", 587),
    user: process.env["SMTP_USER"] || "",
    pass: process.env["SMTP_PASS"] || "",
    from: process.env["MAIL_FROM"] || "JSL Imports <no-reply@jslimports.lk>",
  },

  fxStaleAfterHours: int("FX_STALE_AFTER_HOURS", 168),

  throttleTtlMs: int("THROTTLE_TTL_MS", 60_000),
  throttleLimit: int("THROTTLE_LIMIT", 120),
} as const;

if (isProd && (env.jwtAccessSecret.includes("change-me") || env.jwtRefreshSecret.includes("change-me"))) {
  throw new Error("[env] Refusing to start in production with placeholder JWT secrets.");
}
if (!isProd && env.jwtAccessSecret.startsWith("dev-")) {
  // Loud, once, so nobody ships the dev fallback by accident.
  console.warn("[env] Using built-in development JWT secrets — set JWT_ACCESS_SECRET / JWT_REFRESH_SECRET in .env");
}
