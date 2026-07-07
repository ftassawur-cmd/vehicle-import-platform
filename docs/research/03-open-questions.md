# 03 — Open Questions & Verification Queue

Every item below maps to a config field with `confidence != "verified"`. The Admin Panel ships with
this list as a seeded "Verification Queue"; commercial launch is gated on Q1–Q4.

| # | Item | Why it matters | How to close it | Config target |
|---|---|---|---|---|
| **Q1** | Full excise (XID) band matrix — per-cc/per-kW/per-unit rates for every propulsion × capacity × age band | Excise is usually the largest single tax line | Transcribe Gazettes 2421/42 & 2434/04 (+ any later order) verbatim; archive PDFs | `taxRules.json → exciseDuty.tables` |
| **Q2** | VAT base: is the 10% CIF uplift applied to vehicles, and is Luxury Tax inside the base? | Swings VAT by 6-figure LKR amounts | Obtain one real CUSDEC assessment sheet from a clearing agent; reconcile line-by-line | `taxRules.json → vat` |
| **Q3** | SSCL base composition (uplift? luxury?) | Compounds into VAT | Same CUSDEC reconciliation | `taxRules.json → sscl` |
| **Q4** | Temporary 2026 surcharge base (40% vs 45% effective) and exact expiry date (15 vs 16 Aug) | ±5 pts of CIF for ~6 weeks | Read Gazette 2488/56 text; confirm with Customs Motor Vehicle Unit | `taxRules.json → temporarySurcharges[0]` |
| Q5 | Standing surcharge legal status (renewed 2422/43 vs consolidated 30% CID) | Affects what happens when the temp order lapses | Treasury gazette trail Jan–Feb 2026 | `taxRules.json → cid` |
| Q6 | Car age limit: 3 years (majority) vs 2 years (one source) — and per-class matrix | Blocks/permits deals | Gazette 2421/04 schedule; DMT circulars | `vehicleCategories.json` |
| Q7 | Customs notional insurance % when no certificate presented; customs FX rate feed | CIF accuracy | Customs valuation notices | `insuranceRules.json`, `exchangeRates.json` |
| Q8 | DMT first-registration fees, plate fees, revenue-licence bands (current schedule) | On-road cost accuracy | DMT published fee tables / office confirmation | `registrationFees.json` |
| Q9 | PAL / Cess exemption across *all* relevant HS lines (sampled lines show "Ex") | Hidden levies risk | Tariff Guide 2026 full Ch. 87 review | `taxRules.json → pal, cess` |
| Q10 | Luxury-tax valuation base nuance (declared CIF vs assessed value) | Threshold-edge cases | CUSDEC reconciliation | `luxuryThresholds.json` |
| Q11 | SLPA/terminal tariff exact figures | Quote precision | SLPA published tariff | `portCharges.json` |
| Q12 | 2026 first-registration safety mandate (airbags/ABS/ESC) | Compliance warnings | DMT circular | `vehicleCategories.json → complianceNotes` |

**Product safeguards while open:** every calculation stores the rule-set version it used; any step
that consumed an `estimate`/`reported` value renders an amber "verify before commitment" badge and
is listed in the PDF quote's assumptions appendix. The UI never claims "100% accurate" — it claims
**100% transparent**, which we can actually guarantee.
