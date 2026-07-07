# 02 — Eligibility Rules, Japan-Side Costs, Shipping & Clearance

**Research date:** 3 July 2026 · Values marked *(est.)* are commercial estimates, not regulations —
they seed `auctionDefaults.json`, `shippingRates.json`, `portCharges.json` and are always
user-overridable.

---

## 1. Import eligibility (regulatory — validated by the engine)

Basis: Imports & Exports (Control) Regulations No. 01 of 2025, Gazette 2421/04 (27 Jan 2025), and
operational guidance summarized by trade sources.

| Rule | Value | Confidence |
|---|---|---|
| Steering | Right-hand drive only (LHD needs prior Transport Ministry approval) | verified-secondary |
| Age limit — motor cars, SUVs/jeeps, motorcycles, pickups, buses (10–12 pax) | **< 3 years** | verified-secondary (multiple sources; one lists cars at 2 yrs — flag) |
| Age limit — vans / dual-purpose | **≤ 5 years** | reported |
| Age limit — single/double cabs, lorries & refrigerated trucks < 5 MT GVW | ≤ 4 years | reported |
| Age limit — special-purpose & defence | ≤ 10 years | reported |
| Age measurement | first registration date → Bill of Lading date | verified-secondary |
| Pre-shipment inspection | **JAAI roadworthiness certificate mandatory** (original needed at clearance and for LCA) | verified-secondary |
| Importer licensing | DMT-registered importers: unlimited; private individuals: **1 vehicle per 12 months**, tracked via bank/DMT database | verified-secondary |
| Payment channel | Letter of Credit through licensed banks (LC date drives the 2026 temp-surcharge exemption) | verified |
| Clearance | Must be handled by a licensed Customs House Agent (wharf clerk/broker) | verified-secondary |
| Emissions direction | Policy shift toward Euro 6; petrol/diesel three-wheeler imports prohibited | reported |
| 2026 registration safety floor (reported, verify with DMT) | ≥2 airbags, ABS, ESC for first registration | low — single blog source |

Engine behaviour: `vehicleCategories.json` carries `maxImportAgeYears` per class; exceeding it
produces a **blocking error** with the regulation reference (concessionary permits exist but are
out of scope for auto-approval).

## 2. Japan-side cost anatomy *(est., JPY — seed values for Smart Assistance)*

| Line | Typical range | Default |
|---|---|---|
| Auction fee (USS et al.) | 16,500–33,000 | 22,000 |
| Exporter service/commission (incl. FOB handling) | 55,000–110,000 | 88,000 |
| Inland transport (auction → port) | 10,000–40,000 | 25,000 |
| Export certificate & deregistration | 5,000–15,000 | 10,000 |
| JAAI inspection (mandatory for LK) | 15,000–30,000 | 22,000 |
| Radiation certificate (port-dependent) | 5,000–15,000 | 10,000 |
| Cleaning / undercarriage wash | 5,000–12,000 | 8,000 |
| Documentation / courier (B/L, docs to LK bank) | 5,000–15,000 | 8,000 |
| JP port charges, THC & loading (RoRo) | 20,000–45,000 | 30,000 |

Basis: exporter fee schedules and trade practice; auction fees vary by house and hammer band.
All lines individually overridable; totals feed FOB.

## 3. Ocean freight & marine insurance *(est.)*

- RoRo is billed by volume (m³ = L×W×H); a mid-size car ≈ 8–10 m³, SUV 12–15 m³ (ODS Orient, 2026).
- Exporter guide tariffs from Japan cluster around **USD 1,300 for a unit under 20 m³**, stepping
  up by size tier (Zuffra/TokyoCarz schedule) — route-dependent; BAF fuel surcharges can add 0–30%,
  and 2026 rates are elevated by Middle-East-conflict fuel costs (fuel +~47–50% per EconomyNext,
  Jun 2026).
- **Defaults (Japan → Colombo):** RoRo car **USD 1,500**, SUV **USD 1,850**, van **USD 1,700**;
  shared 40' container per car **USD 1,100** + local unstuffing; transit **14–21 days** including
  transshipment variance. Sailings from Yokohama, Nagoya, Kobe, Osaka, Tokyo, Shimizu, Hakata,
  Kawasaki (KMC Japan schedule confirms active 2026 RoRo rotations).
- Marine insurance: default **1.0%** of (FOB + freight), floor JPY 15,000 *(est.)* — Customs
  requires an insurance certificate; if none, Customs applies a notional insurance uplift
  (verify current notional % — open question Q7).

## 4. Colombo-side clearance *(est., LKR)*

| Line | Range | Default |
|---|---|---|
| SLPA port / terminal handling & wharfage (car, RoRo) | 40,000–90,000 | 60,000 |
| Customs documentation / CUSDEC processing | 5,000–15,000 | 9,000 |
| Clearing agent (CHA) professional fee | 25,000–75,000 | 40,000 |
| Local transport port → yard | 10,000–35,000 | 18,000 |
| Bank charges — LC opening ~0.3–0.5%/qtr + docs | 0.4% + 7,500 | pct+fixed model |
| Demurrage buffer (optional line, off by default) | 0–100,000 | 0 |

Clearance timeline 7–14 days when documents are clean (WealthyIslander guide); delays from
valuation disputes or congestion. The Quotation Builder exposes a "clearance contingency" toggle.

## 5. DMT registration & on-road *(est. — verify with DMT fee tables, open question Q8)*

| Line | Default (car) |
|---|---|
| First registration fee | 15,000 |
| Number plates (pair, standard) | 4,600 |
| Revenue licence (year 1, petrol car 1,300–1,800 cc) | 7,500 |
| VET / emission test (new reg usually exempt yr 1) | 0 |
| Agent/runner (optional) | 10,000 |

## 6. Exchange rates

- Spot USD/LKR ≈ **309.4** (EconomyNext market report, 24 Feb 2026); rupee under pressure —
  depreciated ~4.5% by mid-May 2026 before the surcharge intervention (EconomyNext, 17 Jun 2026).
- JPY/LKR default seeded at **1.95** *(derived estimate — verify daily)*.
- Customs assesses at its own published weekly rate; `exchangeRates.json` carries `asOf`,
  `source`, `staleAfterHours`, and the engine warns whenever a stale rate is used.
