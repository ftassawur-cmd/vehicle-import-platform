/**
 * Prisma 7 project config (root). Deliberately dependency-free at runtime:
 * the repo root has no node_modules, so we only *type*-import from
 * "prisma/config" (erased on load) and export a plain object. Relative
 * paths below are resolved by the Prisma CLI against this file's location.
 *
 * Prisma 7 no longer auto-loads .env, so a minimal loader below walks up
 * from the CLI's cwd to find the repo .env (KEY=VALUE, # comments, quotes).
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { PrismaConfig } from "prisma/config";

for (const dir of [".", "..", "../.."]) {
  try {
    const env = readFileSync(resolve(process.cwd(), dir, ".env"), "utf8");
    for (const line of env.split("\n")) {
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

export default {
  schema: join("prisma", "schema.prisma"),
  datasource: {
    url: process.env["DATABASE_URL"] ?? "postgresql://jsl:jsl@localhost:5432/jsl_imports",
  },
  migrations: {
    path: join("prisma", "migrations"),
    seed: "npm --prefix apps/api run db:seed",
  },
} satisfies PrismaConfig;
