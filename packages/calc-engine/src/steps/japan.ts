import type { CalcInputs, Confidence, Money, RuleSet } from "../types.js";

export interface JapanLine {
  id: string;
  label: string;
  money: Money;
  source: "user" | "default";
  confidence: Confidence;
}

const D = (jpy: number): Money => ({ amount: jpy, currency: "JPY" });

/** Assemble Japan-side cost lines (hammer → loaded on vessel). Defaults from auctionDefaults.json. */
export function buildJapanLines(inputs: CalcInputs, rules: RuleSet): JapanLine[] {
  const a = rules.auctionDefaults;
  const j = inputs.japan;
  const pick = (id: string, label: string, user: Money | undefined, def: number): JapanLine => ({
    id,
    label,
    money: user ?? D(def),
    source: user ? "user" : "default",
    confidence: user ? "verified" : "estimate",
  });

  const lines: JapanLine[] = [
    { id: "hammer", label: "Auction hammer price", money: j.hammerPrice, source: "user", confidence: "verified" },
    pick("auctionFee", "Auction fee", j.auctionFee, a.auctionFee.default),
    pick("exporterServiceFee", "Exporter service fee", j.exporterServiceFee, a.exporterServiceFee.default),
    pick("inlandTransport", "Inland transport (auction → port)", j.inlandTransport, a.inlandTransport.default),
    pick("exportCert", "Export certificate & de-registration", j.exportCertificateDeregistration, a.exportCertificateDeregistration.default),
    pick("jaai", "JAAI pre-shipment inspection", j.jaaiInspection, a.jaaiInspection.default),
    pick("radiation", "Radiation certificate", j.radiationCertificate, a.radiationCertificate.default),
    pick("cleaning", "Cleaning / undercarriage wash", j.cleaning, a.cleaning.default),
    pick("docsCourier", "Documentation & courier", j.documentationCourier, a.documentationCourier.default),
    pick("jpPortLoading", "Japan port charges & loading", j.jpPortAndLoading, a.jpPortAndLoading.default),
  ];
  for (const o of j.other ?? [])
    lines.push({ id: `other:${o.label}`, label: o.label, money: o.value, source: "user", confidence: "verified" });
  return lines;
}
