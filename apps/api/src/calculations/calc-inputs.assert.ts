import { BadRequestException } from "@nestjs/common";
import type { CalcInputs } from "@jsl/calc-engine";

/**
 * Structural runtime guard for the engine's CalcInputs. The engine trusts its
 * TypeScript types; over HTTP we re-establish them so bad JSON becomes a 400
 * with exact field paths — never NaN arithmetic in a persisted snapshot.
 * Kept deliberately in lock-step with packages/calc-engine/src/types.ts.
 */

const CURRENCIES = ["LKR", "JPY", "USD", "EUR", "GBP"] as const;
const FUELS = [
  "petrol", "diesel", "petrolHybrid", "dieselHybrid",
  "petrolPhev", "dieselPhev", "ev", "esmart",
] as const;
const METHODS = ["roro", "container"] as const;

type Errs = string[];
const isObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
const isIsoDate = (x: unknown): boolean =>
  typeof x === "string" && /^\d{4}-\d{2}-\d{2}/.test(x) && !Number.isNaN(Date.parse(x));

function num(errs: Errs, obj: Record<string, unknown>, key: string, path: string, opts: { required?: boolean; min?: number } = {}): void {
  const v = obj[key];
  if (v === undefined || v === null) {
    if (opts.required) errs.push(`${path}.${key} is required`);
    return;
  }
  if (typeof v !== "number" || !Number.isFinite(v)) errs.push(`${path}.${key} must be a finite number`);
  else if (opts.min !== undefined && v < opts.min) errs.push(`${path}.${key} must be ≥ ${opts.min}`);
}

function strField(errs: Errs, obj: Record<string, unknown>, key: string, path: string, required = false): void {
  const v = obj[key];
  if (v === undefined || v === null) {
    if (required) errs.push(`${path}.${key} is required`);
    return;
  }
  if (typeof v !== "string" || v.trim() === "") errs.push(`${path}.${key} must be a non-empty string`);
}

function oneOf(errs: Errs, obj: Record<string, unknown>, key: string, path: string, values: readonly string[], required = false): void {
  const v = obj[key];
  if (v === undefined || v === null) {
    if (required) errs.push(`${path}.${key} is required (one of ${values.join(" | ")})`);
    return;
  }
  if (typeof v !== "string" || !values.includes(v))
    errs.push(`${path}.${key} must be one of ${values.join(" | ")}`);
}

function dateField(errs: Errs, obj: Record<string, unknown>, key: string, path: string, required = false): void {
  const v = obj[key];
  if (v === undefined || v === null) {
    if (required) errs.push(`${path}.${key} is required (ISO date)`);
    return;
  }
  if (!isIsoDate(v)) errs.push(`${path}.${key} must be an ISO date (YYYY-MM-DD…)`);
}

function money(errs: Errs, parent: Record<string, unknown>, key: string, path: string, required = false): void {
  const v = parent[key];
  if (v === undefined || v === null) {
    if (required) errs.push(`${path}.${key} is required ({ amount, currency })`);
    return;
  }
  if (!isObj(v)) {
    errs.push(`${path}.${key} must be an object { amount, currency }`);
    return;
  }
  num(errs, v, "amount", `${path}.${key}`, { required: true, min: 0 });
  oneOf(errs, v, "currency", `${path}.${key}`, CURRENCIES, true);
}

export function assertCalcInputs(raw: unknown): asserts raw is CalcInputs {
  const errs: Errs = [];
  if (!isObj(raw)) throw new BadRequestException("inputs must be an object (engine CalcInputs)");

  // vehicle
  if (!isObj(raw["vehicle"])) errs.push("vehicle is required");
  else {
    const v = raw["vehicle"];
    strField(errs, v, "makeName", "vehicle", true);
    strField(errs, v, "modelName", "vehicle", true);
    strField(errs, v, "variantCode", "vehicle");
    num(errs, v, "year", "vehicle", { required: true, min: 1950 });
    oneOf(errs, v, "fuelType", "vehicle", FUELS, true);
    strField(errs, v, "vehicleClass", "vehicle", true); // unknown ids → engine eligibility block
    strField(errs, v, "bodyClass", "vehicle");
    num(errs, v, "engineCc", "vehicle", { min: 1 });
    num(errs, v, "motorKw", "vehicle", { min: 1 });
    dateField(errs, v, "manufactureDate", "vehicle", true);
    dateField(errs, v, "firstRegistrationDate", "vehicle");
  }

  // japan
  if (!isObj(raw["japan"])) errs.push("japan is required");
  else {
    const j = raw["japan"];
    money(errs, j, "hammerPrice", "japan", true);
    for (const k of [
      "auctionFee", "exporterServiceFee", "inlandTransport", "exportCertificateDeregistration",
      "jaaiInspection", "radiationCertificate", "cleaning", "documentationCourier", "jpPortAndLoading",
    ])
      money(errs, j, k, "japan");
    const other = j["other"];
    if (other !== undefined) {
      if (!Array.isArray(other)) errs.push("japan.other must be an array of { label, value }");
      else
        other.forEach((entry, i) => {
          if (!isObj(entry)) return errs.push(`japan.other[${i}] must be an object`);
          strField(errs, entry, "label", `japan.other[${i}]`, true);
          money(errs, entry, "value", `japan.other[${i}]`, true);
        });
    }
  }

  // shipping
  if (!isObj(raw["shipping"])) errs.push("shipping is required");
  else {
    const s = raw["shipping"];
    oneOf(errs, s, "method", "shipping", METHODS, true);
    strField(errs, s, "originPortCode", "shipping", true);
    money(errs, s, "freight", "shipping");
    money(errs, s, "insurance", "shipping");
    dateField(errs, s, "blDate", "shipping");
  }

  // facts
  if (!isObj(raw["facts"])) errs.push("facts is required");
  else {
    const f = raw["facts"];
    dateField(errs, f, "asOfDate", "facts", true);
    dateField(errs, f, "lcOpenedDate", "facts");
    num(errs, f, "assessedCustomsValueLkr", "facts", { min: 0 });
  }

  // local (optional)
  const local = raw["local"];
  if (local !== undefined) {
    if (!isObj(local)) errs.push("local must be an object");
    else {
      num(errs, local, "clearingAgentLkr", "local", { min: 0 });
      num(errs, local, "localTransportLkr", "local", { min: 0 });
      for (const k of ["includeDemurrageContingency", "includeRegistration", "registrationAgentFee"]) {
        const v = local[k];
        if (v !== undefined && typeof v !== "boolean") errs.push(`local.${k} must be a boolean`);
      }
      const lines = local["portLines"];
      if (lines !== undefined) {
        if (!Array.isArray(lines)) errs.push("local.portLines must be an array of { id, amount }");
        else
          lines.forEach((l, i) => {
            if (!isObj(l)) return errs.push(`local.portLines[${i}] must be an object`);
            strField(errs, l, "id", `local.portLines[${i}]`, true);
            num(errs, l, "amount", `local.portLines[${i}]`, { required: true, min: 0 });
          });
      }
    }
  }

  if (errs.length) throw new BadRequestException({ message: errs, error: "Invalid CalcInputs" });
}
