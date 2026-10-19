#!/usr/bin/env node
// Copies packages/web-kit/src into each app's src/kit/ (generated, do not
// edit). `--check` exits non-zero if any copy differs, for CI.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "packages/web-kit/src");
const targets = ["web/src/kit", "agriculture/web/src/kit"].map((t) => join(root, t));
const check = process.argv.includes("--check");

const HEADER = "GENERATED from packages/web-kit/src — edit there, then run: node scripts/sync-web-kit.mjs";
const stamp = (name, body) =>
  name.endsWith(".css") ? `/* ${HEADER} */\n${body}` : `// ${HEADER}\n${body}`;

const files = readdirSync(source).sort();
let drifted = false;

for (const target of targets) {
  const expected = new Map(files.map((f) => [f, stamp(f, readFileSync(join(source, f), "utf8"))]));
  if (check) {
    const present = existsSync(target) ? readdirSync(target).sort() : [];
    const same = present.length === files.length && files.every((f) => present.includes(f) && readFileSync(join(target, f), "utf8") === expected.get(f));
    if (!same) {
      drifted = true;
      console.error(`web-kit copy is out of date: ${target}`);
    }
  } else {
    rmSync(target, { recursive: true, force: true });
    mkdirSync(target, { recursive: true });
    for (const [f, body] of expected) writeFileSync(join(target, f), body);
    console.log(`synced ${files.length} files -> ${target}`);
  }
}

if (check && drifted) {
  console.error("Run: node scripts/sync-web-kit.mjs");
  process.exit(1);
}
