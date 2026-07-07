# 01 — Sri Lanka Vehicle Import Tax Structure

**Research date:** 3 July 2026 · **Status:** Phase 1 complete · **Owner:** Calculation Engine
**Rule:** Nothing in this document is hardcoded. Every value lives in `/config/*.json`, carries a
confidence rating, and is editable from the Admin Panel.

---

## 1. Legal framework (verified)

| Instrument | Role | Ref |
|---|---|---|
| Customs Ordinance (Ch. 235), s.10A | Authority for duty surcharges | Gazette 2422/43 quotes this section |
| Excise (Special Provisions) Act No. 13 of 1989 | Vehicle excise duty (XID) | Ministerial Orders / Gazettes |
| VAT Act (as amended) | 18% import VAT | Rate in force since 1 Jan 2024 |
| SSCL Act No. 25 of 2022 | 2.5% Social Security Contribution Levy | Applied at import |
| Finance Act (Luxury Tax on Motor Vehicles) | Luxury tax above CIF thresholds | Gazette 2421/41 (31 Jan 2025) |
| Imports & Exports (Control) Regulations No. 01 of 2025 | Eligibility, age limits, importer licensing | Gazette Extraordinary 2421/04 (27 Jan 2025) |

Key gazettes discovered during research (register these in the Admin Panel "Regulation Sources" table):

- **2421/04 (27 Jan 2025)** — import control regulations, age limits, registered-importer rules.
- **2421/41 (31 Jan 2025)** — luxury tax on motor vehicles, thresholds raised to LKR 5.0–6.0 M.
- **2421/42 (31 Jan 2025)** — electric-vehicle excise duty (XID) schedule.
- **2422/43 (31 Jan 2025)** — 50% surcharge on Customs Import Duty, effective 1 Feb 2025 for one year.
- **2434/04 (2025/2026)** — revised excise schedule; most recent EV rate revision. Cited by
  practitioner calculators as the operative excise gazette in 2026.
- **2488/56 (May 2026)** — temporary additional 50% surcharge on CID, effective 16 May 2026 for
  three months; does **not** apply where the import Letter of Credit was opened on or before
  15 May 2026. (Gazette number per pixamp.lk; effect confirmed by Newswire, News 1st, Onlanka,
  Financial Chronicle.)

> ⚠️ Gazette numbering conflicts exist between secondary sources (e.g. one practitioner site labels
> the excise schedule 2421/41 and the luxury tax 2421/42; EconomyNext's PDFs label them the other
> way around). The Admin Panel must store *both* the gazette number and a copy/URL of the PDF so
> disputes are resolvable. Never rely on the number alone.

---

## 2. The tax stack in force on 3 July 2026

Order of application (verified against DNS Associates' post-May-2026 worksheet layout, WealthyIslander,
and news reporting):

```
CIF (LKR)                                  ← customs value; Customs may reassess
 ├─ 1. CID  — Customs Import Duty
 ├─ 2. Surcharge(s) on CID
 ├─ 3. Excise Duty (XID)  — per-cc / per-kW / per-unit / ad-valorem, higher applies
 ├─ 4. Luxury Tax — on CIF portion above fuel-type threshold
 ├─ 5. SSCL — 2.5% of cumulative base
 └─ 6. VAT  — 18% of cumulative base incl. SSCL
= Total import taxes
```

### 2.1 CID — Customs Import Duty

- General rate reported at ~20% of CIF at liberalization (EconomyNext, 31 Jan 2025), lifted to an
  **effective 30%** by the standing 50% surcharge (Gazette 2422/43).
- By May 2026, practitioners and news outlets describe the position as "**30% CID**" as the standing
  base (News 1st: the new levy sits on top of "the 30% Customs Import Duty previously charged";
  DNS Associates worksheet row: "CID (30% of CIF)").
- **Config decision:** model duty as *ordered components* rather than a single rate —
  `cid.baseRatePct` (default 20), `cid.standingSurchargePctOfCid` (default 50) — so the effective
  30% is derived, auditable, and adjustable if either leg changes. Confidence: **reported** (two
  independent secondary confirmations; verify against the current Customs tariff guide column
  "Gen Duty" + "Surcharge on Customs Duty").

### 2.2 Temporary additional surcharge — ACTIVE TODAY

- **50% of applicable CID**, effective **16 May 2026 for three months** (i.e. through ~15 Aug 2026),
  on both General and Preferential bases. Confirmed by ≥4 independent outlets.
- **Exemption:** vehicles whose **LC was opened on or before 15 May 2026** — and Cabinet noted that
  post-15-May *amendments* to an existing LC (vehicle count, VINs, descriptions, specs) pull the
  import back under the surcharge.
- Two- and three-wheelers excluded per Financial Chronicle's report.
- **Magnitude dispute (logged):** News 1st / PiXAMP read the temporary surcharge base as the full
  standing 30% (→ effective duty **45% of CIF**); WealthyIslander models it as 50% of the *20%* CID
  leg only (→ **40% of CIF**). Official gazette text says "50% on applicable Customs Import Duty."
  **Engine default:** base = CID **including** the standing surcharge (45% total), because "applicable
  CID" in May 2026 was being charged at 30%, and the majority of practitioner sources agree. The
  base is a config switch (`temporarySurcharges[].appliesTo`), flagged `reported`.
- **Product requirement:** the engine must accept an `lcOpenedDate` input, apply the surcharge only
  inside its window and only when the LC condition is met, and print the assumption on every quote.

### 2.3 Excise Duty (XID)

- Levied under the Excise (Special Provisions) Act via Ministerial Order; schedule keyed by
  **HS code → propulsion → capacity band (cc, or kW for EVs) → age band**.
- Rate *forms* observed: **per-cc**, **per-kW**, **per-unit (fixed LKR)**, and **ad-valorem %**;
  where multiple apply, **the higher payable amount governs** (WealthyIslander; DNS worksheet shows
  both a per-cc/kW row and a per-unit row).
- Age matters: EVs are rated by age tier (≤1 yr / ≤2 yr / ≤3 yr on the DNS worksheet); combustion
  vehicles >3 years attract substantially higher rates; press reporting at liberalization described
  ad-valorem excise reaching 200–300% for vehicles up to 10 years old (Ada Derana, Ceylon Today,
  11 Jan 2025).
- Verified per-cc data points from the January 2025 revision (EconomyNext, 11 Jan 2025 — band-to-fuel
  mapping not fully specified in the article, treat as anchors only):
  - 1,000–1,300 cc: **LKR 2,750/cc** (up from 2,600)
  - 1,300–1,500 cc: **LKR 3,450/cc** (up from 3,250)
  - ≤1,600 cc class: **LKR 4,800/cc** (up from 4,550)
  - 1,600–1,800 cc: **LKR 6,300/cc** (up from 5,900)
- **Config decision:** `taxRules.json → exciseDuty.tables[]` holds the full band matrix. Bands whose
  rates we could not verify against a primary gazette are populated with clearly-labelled
  `confidence: "estimate"` placeholders derived from the anchors above, and the engine emits a
  warning on any result that touched an estimated band. **Before commercial launch, an admin must
  transcribe Gazette 2421/42 + 2434/04 tables verbatim in the Admin Panel.** This is the single
  largest open item — see `03-open-questions.md`.

### 2.4 Luxury Tax

Verified (Gazette 2421/41 via EconomyNext; thresholds & rates cross-confirmed by WealthyIslander and
the Customs Tariff Guide 2025 columns):

| Propulsion | CIF free threshold | Rate on excess |
|---|---|---|
| Petrol | LKR 5,000,000 | 100% |
| Diesel | LKR 5,000,000 | 120% |
| Petrol hybrid / PHEV | LKR 5,500,000 | 80% |
| Diesel hybrid / PHEV | LKR 5,500,000 | 90% |
| Electric / e-SMART | LKR 6,000,000 | 60% |

- Applies **only to the CIF portion above the threshold**.
- Exempt classes: ambulances, hearses, go-karts, special-purpose vehicles, electric golf cars.
- Confidence: **verified-secondary** (multiple concordant sources incl. the official tariff guide's
  luxury columns). Primary gazette PDF should still be archived in the Admin Panel.

### 2.5 SSCL — Social Security Contribution Levy

- **2.5%**, collected at import **before VAT**; base = cumulative (CIF + CID + surcharges + excise +
  luxury tax). The SSCL amount then joins the VAT base. (WealthyIslander explains the sequencing;
  DNS worksheet lists SSCL at 2.5% "of VAT base".)
- Confidence: **reported**. Whether the statutory import SSCL base uses the 10% CIF uplift (as VAT
  does) is an open question — see discrepancy log.

### 2.6 VAT

- **18%** of the cumulative base. Two formulations found:
  - DNS Associates (practitioner, Dec 2025 page): `18% × (CIF×110% + CID + Surcharge + Excise + Luxury)`
    — i.e. includes the statutory **10% uplift on CIF** used for import VAT in Sri Lanka.
  - WealthyIslander: `18% × (CIF + CID + Surcharge + Excise + Luxury + SSCL)` — includes SSCL,
    no uplift mentioned.
  - PiXAMP: excludes luxury tax from the VAT base entirely.
- **Engine default:** base = `CIF×(1+uplift) + CID + surcharges + excise + luxuryTax + SSCL`,
  with `vat.cifUpliftPct` (default 0.10), `vat.baseIncludes[]` and `sscl.baseIncludes[]` as
  explicit config arrays. Every quote prints the base composition. Confidence: **disputed —
  verify against a real CUSDEC assessment** (highest-priority verification after excise tables).

### 2.7 What is *not* charged on cars (per Customs Tariff Guide 2025, Ch. 87 columns)

- **PAL** (Ports & Airports Development Levy): shown as **Ex** (exempt) on the vehicle lines sampled.
- **Cess**: shown as **Ex** on the vehicle lines sampled.
- Modelled in config as zero-rate components with `enabled:false` so they can be switched on per
  HS line if the tariff guide shows otherwise for a class. Confidence: **reported** (sampled lines
  only; verify per HS code).

---

## 3. CIF and customs valuation

- CIF (LKR) = FOB + international freight + marine insurance, converted at the exchange rate
  applicable at import. Sri Lanka Customs **may verify and adjust** declared CIF (WealthyIslander;
  standard practice). The engine therefore separates **declared CIF** (computed from user inputs)
  from an optional **assessed customs value override**, and computes taxes on
  `max(declared, assessed)` by default (mode configurable: declared / assessed / higher).
- Vehicle **age** for import-eligibility = first registration date → Bill of Lading date
  (JapaneseCarTrade guide, consistent with Customs practice). Age for **excise banding** is keyed to
  year/date of manufacture per the gazettes — the engine tracks both dates.

---

## 4. Worked sequencing (the engine's canonical order)

```
 1  FOB(¥)   = hammer + auction fees + exporter/service + inland + docs
              + export cert + inspection(JAAI) + radiation + cleaning + JP port/loading
 2  CIF(¥/$) = FOB + freight + marine insurance
 3  CIF(LKR) = Σ line_i × fx(currency_i → LKR)          [customs rate, dated]
 4  CV       = max(CIF LKR, assessed override)           [customs value]
 5  CID      = CV × 20%
 6  S1       = CID × 50%                                 [standing surcharge]
 7  S2       = (CID+S1) × 50%  if LC > 15 May 2026 and date in window   [temp 2026]
 8  XID      = higher of { rate/cc × cc , rate/kW × kW , per-unit , adval% × base }
 9  LUX      = rate(fuel) × max(0, CIF − threshold(fuel))
10  SSCL     = 2.5% × (CV×(1+uplift?) + CID+S1+S2 + XID + LUX)          [base per config]
11  VAT      = 18%  × (CV×(1+uplift) + CID+S1+S2 + XID + LUX + SSCL)    [base per config]
12  Import taxes = 5..11 ;  Landed(port) = CIF + taxes + port/clearing/bank
13  On-road      = Landed + DMT registration + plates + revenue licence + transport
```

---

## 5. Discrepancy log (drives config flags + admin verification queue)

| # | Question | Positions found | Engine default | Priority |
|---|---|---|---|---|
| D1 | Temp-surcharge base | 45% of CIF total (News 1st, PiXAMP) vs 40% (WealthyIslander) | 45% (base incl. standing surcharge) | HIGH |
| D2 | 10% CIF uplift in VAT base | Included (DNS) vs absent (WealthyIslander) | Included | HIGH |
| D3 | Luxury tax inside VAT/SSCL base | Yes (DNS, WI) vs No (PiXAMP) | Yes | HIGH |
| D4 | SSCL base uses uplifted CIF | Unclear | Same uplift flag as VAT | MED |
| D5 | Excise band rates (full matrix) | Only 4 anchor points verified | Estimates flagged per band | **CRITICAL** |
| D6 | Standing surcharge legal form in 2026 (renewed 2422/43 vs consolidated 30% CID) | Both descriptions circulate | Decomposed 20% + 50% | MED |
| D7 | Gazette numbering (2421/41 vs /42) | Sources swap labels | Store PDFs, not just numbers | LOW |

Every quote generated by the platform prints which defaults were used and links to this log's
Admin-Panel equivalent. **Rates as of:** the `effectiveDate` stamped in `config/taxRules.json`.

---

## 6. Source register

Primary / official:
- Sri Lanka Customs — National Imports Tariff Guide 2025, Chapter 87 (customs.gov.lk PDF).
- Ministry of Finance / treasury.gov.lk gazette PDFs: 2421/43 surcharge order text; excise & luxury
  gazette files (linked from EconomyNext, 31 Jan 2025).
- Sri Lanka Customs — Motor Vehicle Unit pages (customs.gov.lk).

Secondary (dated, concordance-checked):
- EconomyNext: 11 Jan 2025 (excise per-cc hikes); 31 Jan 2025 (surcharge, EV & luxury gazettes,
  20%→30% effect); Feb 2026 (USD/LKR ≈ 309); 17 Jun 2026 (May-2026 surcharge context, FX outflows).
- Newswire 16 & 19 May 2026; News 1st 16 May 2026; Onlanka 17 May 2026; Financial Chronicle
  22 May 2026 (temporary surcharge, LC rule, Cabinet notes).
- WealthyIslander vehicle-import-tax tool (updated 29 May 2026) — sequencing, SSCL, thresholds,
  gazette 2434/04 reference.
- DNS Associates (Galle/Colombo accountancy) surcharge calculator (updated 18 May 2026) — worksheet
  row order, CID 30% presentation, EV age tiers, e-SMART category.
- PiXAMP calculator — gazette 2488/56 number, LC exemption phrasing, dissenting VAT-base view.
- Ada Derana & Ceylon Today (11–13 Jan 2025) — 200–300% ad-valorem excise framing, ≤10-year scope.
