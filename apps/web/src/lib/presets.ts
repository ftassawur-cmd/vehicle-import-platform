import type { BodyClass, CalcInputs, FuelType, ShippingMethod, VehicleClassId } from "@jsl/calc-engine/browser";
import { addDaysIso, todayIso } from "./format";

/** Flat, form-friendly state. Mapped to engine CalcInputs in toCalcInputs(). */
export interface FormState {
  presetId: string;
  makeName: string;
  modelName: string;
  variantCode: string;
  year: number;
  fuelType: FuelType;
  vehicleClass: VehicleClassId;
  bodyClass: BodyClass;
  capacity: number; // cc or kW per fuel table
  manufactureDate: string;
  firstRegistrationDate: string;
  hammerJpy: number;
  auctionFeeJpy: number | null;      // null → Smart default
  exporterFeeJpy: number | null;
  inlandTransportJpy: number | null;
  method: ShippingMethod;
  originPortCode: string;
  blDate: string;
  freightUsd: number | null;      // null → route default
  lcOpenedDate: string;
  asOfDate: string;
  assessedCustomsValueLkr: number | null;
  includeRegistration: boolean;
  registrationAgentFee: boolean;
  includeDemurrageContingency: boolean;
  clearingAgentLkr: number | null;
  localTransportLkr: number | null;
}

export interface Preset {
  id: string;
  label: string;
  note: string;
  patch: Partial<FormState>;
}

const base = (): FormState => ({
  presetId: "prius",
  makeName: "Toyota",
  modelName: "Prius",
  variantCode: "ZVW51",
  year: 2022,
  fuelType: "petrolHybrid",
  vehicleClass: "car",
  bodyClass: "car",
  capacity: 1797,
  manufactureDate: "2023-09-15",
  firstRegistrationDate: "2023-10-20",
  hammerJpy: 2_300_000,
  auctionFeeJpy: null,
  exporterFeeJpy: null,
  inlandTransportJpy: null,
  method: "roro",
  originPortCode: "JPYOK",
  blDate: addDaysIso(todayIso(), 14),
  freightUsd: null,
  lcOpenedDate: todayIso(),
  asOfDate: todayIso(),
  assessedCustomsValueLkr: null,
  includeRegistration: true,
  registrationAgentFee: false,
  includeDemurrageContingency: false,
  clearingAgentLkr: null,
  localTransportLkr: null,
});

export const PRESETS: Preset[] = [
  {
    id: "prius",
    label: "Toyota Prius ZVW51 · 2022",
    note: "1.8 hybrid · grade 4.5 · the homepage demo unit",
    patch: {},
  },
  {
    id: "aqua",
    label: "Toyota Aqua X · 2023",
    note: "1.5 hybrid hatch — the volume seller",
    patch: {
      makeName: "Toyota", modelName: "Aqua", variantCode: "MXPK11", year: 2023,
      fuelType: "petrolHybrid", bodyClass: "car", capacity: 1490,
      manufactureDate: "2024-02-10", firstRegistrationDate: "2024-03-05",
      hammerJpy: 1_550_000,
    },
  },
  {
    id: "vezel",
    label: "Honda Vezel e:HEV Z · 2023",
    note: "compact SUV — RoRo priced at the SUV rate",
    patch: {
      makeName: "Honda", modelName: "Vezel", variantCode: "RV5", year: 2023,
      fuelType: "petrolHybrid", bodyClass: "suv", capacity: 1496,
      manufactureDate: "2023-11-20", firstRegistrationDate: "2024-01-12",
      hammerJpy: 2_650_000,
    },
  },
  {
    id: "every",
    label: "Suzuki Every Join · 2023",
    note: "660 kei van — 5-year class limit applies",
    patch: {
      makeName: "Suzuki", modelName: "Every", variantCode: "DA17V", year: 2023,
      fuelType: "petrol", vehicleClass: "vanDualPurpose", bodyClass: "vanDualPurpose",
      capacity: 658, manufactureDate: "2023-06-01", firstRegistrationDate: "2023-07-15",
      hammerJpy: 950_000,
    },
  },
  {
    id: "sakura",
    label: "Nissan Sakura X · 2024",
    note: "kei EV — kW-based excise with age tiers",
    patch: {
      makeName: "Nissan", modelName: "Sakura", variantCode: "B6AW", year: 2024,
      fuelType: "ev", bodyClass: "car", capacity: 47,
      manufactureDate: "2024-08-01", firstRegistrationDate: "2024-09-10",
      hammerJpy: 1_250_000,
    },
  },
  {
    id: "lc250",
    label: "Toyota Land Cruiser 250 VX · 2024",
    note: "2.8 diesel — watch the luxury-tax line",
    patch: {
      makeName: "Toyota", modelName: "Land Cruiser 250", variantCode: "GDJ250W", year: 2024,
      fuelType: "diesel", bodyClass: "suv", capacity: 2754,
      manufactureDate: "2024-05-20", firstRegistrationDate: "2024-07-01",
      hammerJpy: 7_200_000,
    },
  },
];

export const initialForm = (): FormState => ({ ...base() });

export const applyPreset = (s: FormState, id: string): FormState => {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) return { ...s, presetId: "custom" };
  return { ...base(), blDate: s.blDate, lcOpenedDate: s.lcOpenedDate, asOfDate: s.asOfDate, method: s.method, originPortCode: s.originPortCode, ...p.patch, presetId: id };
};

export function toCalcInputs(f: FormState): CalcInputs {
  const isEv = f.fuelType === "ev";
  return {
    vehicle: {
      makeName: f.makeName || "—",
      modelName: f.modelName || "—",
      variantCode: f.variantCode || undefined,
      year: f.year,
      fuelType: f.fuelType,
      vehicleClass: f.vehicleClass,
      bodyClass: f.bodyClass,
      engineCc: isEv ? undefined : f.capacity || undefined,
      motorKw: isEv ? f.capacity || undefined : undefined,
      manufactureDate: f.manufactureDate,
      firstRegistrationDate: f.firstRegistrationDate || undefined,
    },
    japan: {
      hammerPrice: { amount: f.hammerJpy, currency: "JPY" },
      auctionFee: f.auctionFeeJpy != null ? { amount: f.auctionFeeJpy, currency: "JPY" } : undefined,
      exporterServiceFee: f.exporterFeeJpy != null ? { amount: f.exporterFeeJpy, currency: "JPY" } : undefined,
      inlandTransport: f.inlandTransportJpy != null ? { amount: f.inlandTransportJpy, currency: "JPY" } : undefined,
    },
    shipping: {
      method: f.method,
      originPortCode: f.originPortCode,
      blDate: f.blDate || undefined,
      freight: f.freightUsd != null ? { amount: f.freightUsd, currency: "USD" } : undefined,
    },
    facts: {
      asOfDate: f.asOfDate,
      lcOpenedDate: f.lcOpenedDate || undefined,
      assessedCustomsValueLkr: f.assessedCustomsValueLkr ?? undefined,
    },
    local: {
      includeRegistration: f.includeRegistration,
      registrationAgentFee: f.registrationAgentFee,
      includeDemurrageContingency: f.includeDemurrageContingency,
      clearingAgentLkr: f.clearingAgentLkr ?? undefined,
      localTransportLkr: f.localTransportLkr ?? undefined,
    },
  };
}

/** The golden demo inputs (matches packages/calc-engine/examples/prius-2022.ts). */
export const DEMO_INPUTS: CalcInputs = toCalcInputs({
  ...base(),
  blDate: "2026-07-20",
  lcOpenedDate: "2026-06-10",
  asOfDate: "2026-07-03",
});
