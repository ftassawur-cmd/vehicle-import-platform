/** @jsl/calc-engine — type system. Mirrors /config/*.json shapes 1:1. */

export type Currency = "LKR" | "JPY" | "USD" | "EUR" | "GBP";
export type Confidence = "verified" | "verified-secondary" | "reported" | "estimate" | "low";
export type FuelType =
  | "petrol" | "diesel"
  | "petrolHybrid" | "dieselHybrid"
  | "petrolPhev" | "dieselPhev"
  | "ev" | "esmart";
export type VehicleClassId =
  | "car" | "vanDualPurpose" | "pickup" | "lorrySub5MT" | "busSmall" | "busLarge"
  | "motorcycle" | "specialPurpose" | "ambulance" | "hearse" | "goKart" | "electricGolfCar";
export type ShippingMethod = "roro" | "container";
export type BodyClass = "car" | "suv" | "vanDualPurpose" | "pickup";

export interface Money { amount: number; currency: Currency; }

// ─────────── Inputs ───────────

export interface VehicleInput {
  makeName: string;
  modelName: string;
  variantCode?: string;
  year: number;
  fuelType: FuelType;
  vehicleClass: VehicleClassId;
  bodyClass?: BodyClass;          // for freight defaults
  engineCc?: number;              // combustion / hybrid
  motorKw?: number;               // EV
  manufactureDate: string;        // ISO — drives excise age banding
  firstRegistrationDate?: string; // ISO — drives import age-limit check
}

export interface JapanCostsInput {
  hammerPrice: Money;
  auctionFee?: Money;
  exporterServiceFee?: Money;
  inlandTransport?: Money;
  exportCertificateDeregistration?: Money;
  jaaiInspection?: Money;
  radiationCertificate?: Money;
  cleaning?: Money;
  documentationCourier?: Money;
  jpPortAndLoading?: Money;
  other?: { label: string; value: Money }[];
}

export interface ShippingInput {
  method: ShippingMethod;
  originPortCode: string;
  freight?: Money;                 // override; otherwise from rules
  insurance?: Money;               // override; otherwise computed
  blDate?: string;                 // shipment date — age-limit + rate windows
}

export interface CalcFacts {
  asOfDate: string;                // rules evaluated as of this date
  lcOpenedDate?: string;           // drives 2026 temp-surcharge exemption
  assessedCustomsValueLkr?: number;// optional Customs reassessment override
}

export interface LocalOverrides {
  portLines?: { id: string; amount: number }[];
  clearingAgentLkr?: number;
  localTransportLkr?: number;
  includeDemurrageContingency?: boolean;
  includeRegistration?: boolean;   // default true
  registrationAgentFee?: boolean;
}

export interface CalcInputs {
  vehicle: VehicleInput;
  japan: JapanCostsInput;
  shipping: ShippingInput;
  facts: CalcFacts;
  local?: LocalOverrides;
}

// ─────────── Rule-set (config mirror) ───────────

export interface SourceMeta { confidence?: Confidence; sourceRef?: string; notes?: string; }

export interface DutyComponentRule extends SourceMeta {
  id: string;
  label: string;
  ratePct: number;
  base: string[];                 // component ids and/or "customsValue"
  effectiveFrom?: string;
  effectiveTo?: string | null;
  conditions?: { lcOpenedAfter?: string };
  excludedVehicleClasses?: VehicleClassId[];
}

export interface ExciseBand extends SourceMeta {
  min: number; max: number | null;
  ratePerUnit?: number | null;
  ratePerUnitByAge?: Record<string, number>;
  perUnitFixed?: number | null;
  advaloremPct?: number | null;
}

export interface ExciseTable {
  unit: "cc" | "kW";
  ageTiers?: boolean;
  notesGeneral?: string;
  bands: ExciseBand[];
}

export interface TaxRules {
  _meta: { version: string; effectiveDate: string; [k: string]: unknown };
  rounding: { duties: "rupee"; displayMinor: number };
  customsValue: { mode: "higherOfDeclaredOrAssessed" | "declared" | "assessed" } & SourceMeta;
  dutyComponents: DutyComponentRule[];
  pal: { enabled: boolean; ratePct: number } & SourceMeta;
  cess: { enabled: boolean; ratePct: number } & SourceMeta;
  exciseDuty: {
    selection: "higherOf";
    combustionOver3YearsMultiplier: { value: number } & SourceMeta;
    tables: Record<string, ExciseTable>;
  };
  sscl: { ratePct: number; applyCifUplift: boolean; baseIncludes: string[] } & SourceMeta;
  vat: { ratePct: number; cifUpliftPct: number; baseIncludes: string[] } & SourceMeta;
}

export interface LuxuryRules {
  _meta: Record<string, unknown>;
  base: "cif";
  thresholdsLkr: Record<FuelType, number>;
  ratePctOnExcess: Record<FuelType, number>;
  exemptVehicleClasses: VehicleClassId[];
}

export interface VehicleCategoryRules {
  classes: { id: VehicleClassId; label: string; maxImportAgeYears: number; confidence?: Confidence }[];
  [k: string]: unknown;
}

export interface FxRules {
  rates: { pair: string; rate: number; asOf: string; source: string; confidence?: Confidence; stale?: boolean }[];
  [k: string]: unknown;
}

export interface RuleSet {
  taxRules: TaxRules;
  luxury: LuxuryRules;
  vehicleCategories: VehicleCategoryRules;
  fx: FxRules;
  shipping: any;
  auctionDefaults: any;
  insurance: any;
  portCharges: any;
  governmentCharges: any;
  registrationFees: any;
  versions: Record<string, string>; // domain -> version string (provenance)
}

// ─────────── Output ───────────

export type WarningSeverity = "info" | "warn" | "error";
export interface CalcWarning { severity: WarningSeverity; code: string; message: string; }

export type StepGroup = "japan" | "freight" | "customs" | "local" | "registration" | "total";

export interface StepResult {
  id: string;
  group: StepGroup;
  label: string;
  formula: string;                // human-readable, printed on quotes
  amountLkr: number;              // rounded per policy
  runningTotalLkr?: number;
  confidence: Confidence;
  notes?: string[];
  fxUsed?: { pair: string; rate: number; asOf: string }[];
}

export interface CalcResult {
  inputsEcho: CalcInputs;
  ruleVersions: Record<string, string>;
  steps: StepResult[];
  totals: {
    fobJpy: number;
    cifLkr: number;
    customsValueLkr: number;
    importTaxesLkr: number;
    landedAtPortLkr: number;
    onRoadLkr: number;
    effectiveTaxPctOfCif: number;
  };
  warnings: CalcWarning[];
  eligibility: { importable: boolean; reasons: string[] };
  minConfidenceTouched: Confidence;
  generatedAt: string;
}
