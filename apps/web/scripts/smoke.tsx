/**
 * SSR smoke test: renders the landing shell and each route component to a
 * string in Node. Proves the full tree executes (engine included) and that
 * the golden Prius figure survives into markup. Run: npm run smoke
 */
import { StrictMode, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { LazyMotion, domAnimation } from "framer-motion";
import App from "../src/App";
import Calculator from "../src/pages/Calculator";
import NotFound from "../src/pages/NotFound";
import { calculate } from "@jsl/calc-engine/browser";
import { rules } from "../src/lib/rules";
import { initialForm, toCalcInputs } from "../src/lib/presets";
import { lkr } from "../src/lib/format";

const wrap = (node: ReactNode, path = "/") =>
  renderToString(
    <StrictMode>
      <LazyMotion features={domAnimation} strict>
        <MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>
      </LazyMotion>
    </StrictMode>
  );

let failures = 0;
const expect = (page: string, html: string, needle: string) => {
  if (html.includes(needle)) console.log(`  ✓ ${page} contains “${needle}”`);
  else { failures++; console.error(`  ✗ ${page} missing “${needle}”`); }
};

console.log("smoke · GET / (full app)");
const landing = wrap(<App />);
expect("/", landing, "Know the on-road cost");
expect("/", landing, "22,232,221");             // golden on-road, hero card
expect("/", landing, "Customs &amp; taxes");    // waterfall group rendered
expect("/", landing, "Gazette 2488/56");        // what-if copy
expect("/", landing, "2026.07.03-r1");          // rule-set provenance

console.log("smoke · <Calculator/>");
const calc = wrap(<Calculator />, "/calculator");
expect("/calculator", calc, "Landed-cost calculator");
expect("/calculator", calc, "Auction hammer price");
expect("/calculator", calc, "Final on-road cost");
// Self-consistent figure: whatever the engine says for today's default form.
const expected = lkr(calculate(toCalcInputs(initialForm()), rules).totals.onRoadLkr);
expect("/calculator", calc, expected);
expect("/calculator", calc, "Warnings &amp; assumptions");

console.log("smoke · <NotFound/>");
expect("/nope", wrap(<NotFound />, "/nope"), "manifest");

if (failures) { console.error(`\n${failures} smoke check(s) failed.`); process.exit(1); }
console.log("\nAll smoke checks passed.");
