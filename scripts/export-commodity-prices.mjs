#!/usr/bin/env node
// Writes web/src/data/commodity-prices.json from Agriculture Radar's published
// benchmark prices, so Inflation Radar can relate crop prices to food CPI
// without importing across the two apps' build roots. `--check` exits
// non-zero if the file is stale (CI); without it the file is rewritten.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "agriculture/web/public/data");
const output = join(root, "web/src/data/commodity-prices.json");

const manifest = JSON.parse(readFileSync(join(dataDir, "manifest.json"), "utf8"));
const result = {
  vintage: manifest.vintage,
  source: "World Bank commodity price data (the Pink Sheet), via Agriculture Radar",
  sourceUrl: manifest.releases.worldbank.source_url,
  licenseUrl: manifest.releases.worldbank.license_url,
  commodities: {},
};
for (const crop of ["wheat", "maize", "rice"]) {
  const { prices } = JSON.parse(readFileSync(join(dataDir, `${crop}.json`), "utf8"));
  const info = manifest.commodities[crop];
  result.commodities[crop] = { name: info.name, benchmark: info.benchmark_name, unit: info.benchmark_unit, prices };
}
const text = `${JSON.stringify(result)}\n`;

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(output, "utf8");
  } catch {
    // A missing file is simply stale.
  }
  if (current !== text) {
    console.error("web/src/data/commodity-prices.json is out of date. Run: node scripts/export-commodity-prices.mjs");
    process.exit(1);
  }
} else {
  writeFileSync(output, text);
  console.log(`wrote ${output}`);
}
