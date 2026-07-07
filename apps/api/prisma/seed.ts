/**
 * Idempotent database seed (tsx runner):
 *   1. The ten /config/*.json payloads → ACTIVE RuleSetVersions
 *      (engine-validated via buildRuleSet BEFORE anything is written — ADR-002).
 *   2. Origin/destination ports used by shippingRates.json.
 *   3. "JSL Imports" organization + SUPER_ADMIN account
 *      (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD, defaults below — CHANGE IN PROD).
 *   4. A small real-spec JDM catalog incl. the golden-test Prius ZVW51.
 *
 * Run: npm --prefix apps/api run db:seed
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as argon2 from "argon2";
import { buildRuleSet, type RulePayloads } from "@jsl/calc-engine";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  AccountStatus,
  ConfigDomain,
  FuelType,
  PrismaClient,
  Role,
  RuleSetStatus,
  VehicleClass,
} from "../src/generated/prisma/client";
import { env } from "../src/config/env";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.databaseUrl }) });
const CONFIG_DIR = join(__dirname, "../../../config");

/* ── 1 · Rule versions ─────────────────────────────────────────────── */

const FILE_BY_DOMAIN: Record<ConfigDomain, string> = {
  [ConfigDomain.TAX_RULES]: "taxRules.json",
  [ConfigDomain.LUXURY_TAX]: "luxuryThresholds.json",
  [ConfigDomain.VEHICLE_CATEGORIES]: "vehicleCategories.json",
  [ConfigDomain.EXCHANGE_RATES]: "exchangeRates.json",
  [ConfigDomain.SHIPPING]: "shippingRates.json",
  [ConfigDomain.AUCTION_DEFAULTS]: "auctionDefaults.json",
  [ConfigDomain.INSURANCE]: "insuranceRules.json",
  [ConfigDomain.PORT_CHARGES]: "portCharges.json",
  [ConfigDomain.GOVERNMENT_CHARGES]: "governmentCharges.json",
  [ConfigDomain.REGISTRATION]: "registrationFees.json",
};

const ENGINE_KEY_BY_DOMAIN: Record<ConfigDomain, keyof RulePayloads> = {
  [ConfigDomain.TAX_RULES]: "taxRules",
  [ConfigDomain.LUXURY_TAX]: "luxury",
  [ConfigDomain.VEHICLE_CATEGORIES]: "vehicleCategories",
  [ConfigDomain.EXCHANGE_RATES]: "fx",
  [ConfigDomain.SHIPPING]: "shipping",
  [ConfigDomain.AUCTION_DEFAULTS]: "auctionDefaults",
  [ConfigDomain.INSURANCE]: "insurance",
  [ConfigDomain.PORT_CHARGES]: "portCharges",
  [ConfigDomain.GOVERNMENT_CHARGES]: "governmentCharges",
  [ConfigDomain.REGISTRATION]: "registrationFees",
};

interface SeedMeta {
  domain?: string;
  version?: string;
  effectiveDate?: string;
}

async function seedRules(): Promise<void> {
  const payloads = {} as Record<keyof RulePayloads, unknown>;
  const rows: { domain: ConfigDomain; version: string; effectiveFrom: Date; payload: unknown }[] = [];

  for (const domain of Object.values(ConfigDomain)) {
    const file = FILE_BY_DOMAIN[domain];
    const payload = JSON.parse(readFileSync(join(CONFIG_DIR, file), "utf8")) as { _meta?: SeedMeta };
    const meta = payload._meta ?? {};
    if (meta.domain && meta.domain !== domain)
      throw new Error(`${file}: _meta.domain '${meta.domain}' ≠ expected '${domain}'`);
    const version = meta.version ?? "seed-r1";
    payloads[ENGINE_KEY_BY_DOMAIN[domain]] = payload;
    rows.push({
      domain,
      version,
      effectiveFrom: meta.effectiveDate ? new Date(meta.effectiveDate) : new Date("2026-07-03"),
      payload,
    });
  }

  // Fail fast with the engine's own validator before a single row is written.
  buildRuleSet(payloads as RulePayloads);
  console.log("  ✓ all 10 payloads pass buildRuleSet()");

  for (const row of rows) {
    await prisma.ruleSetVersion.upsert({
      where: { domain_version: { domain: row.domain, version: row.version } },
      create: {
        domain: row.domain,
        version: row.version,
        status: RuleSetStatus.ACTIVE,
        payload: row.payload as object,
        effectiveFrom: row.effectiveFrom,
        changeNote: "Initial seed from /config",
      },
      update: { payload: row.payload as object, status: RuleSetStatus.ACTIVE },
    });
    console.log(`  ✓ ${row.domain} ${row.version} ACTIVE`);
  }
}

/* ── 2 · Ports ─────────────────────────────────────────────────────── */

const PORTS: { code: string; name: string; country: string }[] = [
  { code: "JPYOK", name: "Yokohama", country: "JP" },
  { code: "JPNGO", name: "Nagoya", country: "JP" },
  { code: "JPUKB", name: "Kobe", country: "JP" },
  { code: "JPOSA", name: "Osaka", country: "JP" },
  { code: "JPTYO", name: "Tokyo", country: "JP" },
  { code: "JPSMZ", name: "Shimizu", country: "JP" },
  { code: "JPHKT", name: "Hakata", country: "JP" },
  { code: "JPKWS", name: "Kawasaki", country: "JP" },
  { code: "LKCMB", name: "Colombo", country: "LK" },
];

async function seedPorts(): Promise<void> {
  for (const port of PORTS)
    await prisma.port.upsert({ where: { code: port.code }, create: port, update: { name: port.name } });
  console.log(`  ✓ ${PORTS.length} ports`);
}

/* ── 3 · Organization + super-admin ────────────────────────────────── */

async function seedAdmin(): Promise<void> {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@jslimports.lk").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
  if (!process.env.SEED_ADMIN_PASSWORD)
    console.warn(
      "  ⚠  SEED_ADMIN_PASSWORD not set — using the default 'ChangeMe123!'. CHANGE THIS BEFORE ANY REAL DEPLOYMENT.",
    );

  const org = await prisma.organization.upsert({
    where: { slug: "jsl" },
    create: { name: "JSL Imports", slug: "jsl", type: "importer" },
    update: {},
  });

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: env.argon2MemoryKib,
    timeCost: 3,
    parallelism: 1,
  });

  const admin = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      fullName: "JSL Super Admin",
      status: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
    update: { status: AccountStatus.ACTIVE },
  });

  await prisma.orgMembership.upsert({
    where: { userId_orgId: { userId: admin.id, orgId: org.id } },
    create: { userId: admin.id, orgId: org.id, role: Role.SUPER_ADMIN },
    update: { role: Role.SUPER_ADMIN },
  });
  console.log(`  ✓ org 'jsl' + SUPER_ADMIN ${email}`);
}

/* ── 4 · Vehicle catalog (real JDM specs) ──────────────────────────── */

interface VariantSeed {
  code: string;
  yearFrom: number;
  yearTo?: number;
  fuelType: FuelType;
  engineCc?: number;
  motorKw?: number;
  drivetrain?: string;
  transmission?: string;
  bodyType?: string;
  weightKg?: number;
  fuelEconomyKmPerL?: number;
}

const CATALOG: {
  make: string;
  country: string;
  models: { name: string; class: VehicleClass; popular?: boolean; variants: VariantSeed[] }[];
}[] = [
  {
    make: "Toyota",
    country: "JP",
    models: [
      {
        name: "Prius",
        class: VehicleClass.CAR,
        popular: true,
        variants: [
          // Golden-test vehicle: 4th-gen facelift ZVW51 S "Touring Selection"
          { code: "ZVW51", yearFrom: 2019, yearTo: 2022, fuelType: FuelType.PETROL_HYBRID, engineCc: 1797, motorKw: 53, drivetrain: "2WD", transmission: "CVT", bodyType: "hatchback", weightKg: 1360, fuelEconomyKmPerL: 27.2 },
          { code: "ZVW60", yearFrom: 2023, fuelType: FuelType.PETROL_HYBRID, engineCc: 1986, motorKw: 83, drivetrain: "2WD", transmission: "CVT", bodyType: "hatchback", weightKg: 1420, fuelEconomyKmPerL: 28.6 },
        ],
      },
      {
        name: "Aqua",
        class: VehicleClass.CAR,
        popular: true,
        variants: [
          { code: "MXPK11", yearFrom: 2021, fuelType: FuelType.PETROL_HYBRID, engineCc: 1490, motorKw: 59, drivetrain: "2WD", transmission: "CVT", bodyType: "hatchback", weightKg: 1130, fuelEconomyKmPerL: 33.6 },
        ],
      },
    ],
  },
  {
    make: "Honda",
    country: "JP",
    models: [
      {
        name: "Fit",
        class: VehicleClass.CAR,
        popular: true,
        variants: [
          { code: "GR3", yearFrom: 2020, fuelType: FuelType.PETROL_HYBRID, engineCc: 1496, motorKw: 80, drivetrain: "2WD", transmission: "e-CVT", bodyType: "hatchback", weightKg: 1190, fuelEconomyKmPerL: 28.8 },
        ],
      },
      {
        name: "Vezel",
        class: VehicleClass.CAR,
        variants: [
          { code: "RV5", yearFrom: 2021, fuelType: FuelType.PETROL_HYBRID, engineCc: 1496, motorKw: 96, drivetrain: "2WD", transmission: "e-CVT", bodyType: "suv", weightKg: 1380, fuelEconomyKmPerL: 24.8 },
        ],
      },
    ],
  },
  {
    make: "Nissan",
    country: "JP",
    models: [
      {
        name: "Note",
        class: VehicleClass.CAR,
        popular: true,
        variants: [
          { code: "E13", yearFrom: 2020, fuelType: FuelType.ESMART, engineCc: 1198, motorKw: 85, drivetrain: "2WD", transmission: "single-speed", bodyType: "hatchback", weightKg: 1220, fuelEconomyKmPerL: 28.4 },
        ],
      },
      {
        name: "Sakura",
        class: VehicleClass.CAR,
        variants: [
          { code: "B6AW", yearFrom: 2022, fuelType: FuelType.EV, motorKw: 47, drivetrain: "2WD", transmission: "single-speed", bodyType: "kei", weightKg: 1070 },
        ],
      },
    ],
  },
  {
    make: "Suzuki",
    country: "JP",
    models: [
      {
        name: "Every",
        class: VehicleClass.VAN_DUAL_PURPOSE,
        variants: [
          { code: "DA17V", yearFrom: 2015, fuelType: FuelType.PETROL, engineCc: 658, drivetrain: "2WD", transmission: "5MT", bodyType: "kei-van", weightKg: 870, fuelEconomyKmPerL: 17.2 },
        ],
      },
    ],
  },
];

async function seedCatalog(): Promise<void> {
  let variants = 0;
  for (const makeSeed of CATALOG) {
    const make = await prisma.vehicleMake.upsert({
      where: { name: makeSeed.make },
      create: { name: makeSeed.make, country: makeSeed.country },
      update: {},
    });
    for (const modelSeed of makeSeed.models) {
      const model = await prisma.vehicleModel.upsert({
        where: { makeId_name: { makeId: make.id, name: modelSeed.name } },
        create: {
          makeId: make.id,
          name: modelSeed.name,
          class: modelSeed.class,
          popular: modelSeed.popular ?? false,
        },
        update: { class: modelSeed.class, popular: modelSeed.popular ?? false },
      });
      for (const v of modelSeed.variants) {
        await prisma.vehicleVariant.upsert({
          where: { modelId_code_yearFrom: { modelId: model.id, code: v.code, yearFrom: v.yearFrom } },
          create: { modelId: model.id, ...v },
          update: { yearTo: v.yearTo, engineCc: v.engineCc, motorKw: v.motorKw },
        });
        variants++;
      }
    }
  }
  console.log(`  ✓ catalog: ${CATALOG.length} makes, ${variants} variants (incl. golden ZVW51)`);
}

/* ── main ──────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  console.log("Seeding JSL Imports database…");
  console.log("· rule versions");
  await seedRules();
  console.log("· ports");
  await seedPorts();
  console.log("· organization & admin");
  await seedAdmin();
  console.log("· vehicle catalog");
  await seedCatalog();
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
