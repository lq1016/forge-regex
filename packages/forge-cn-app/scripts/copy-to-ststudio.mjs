import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, "../dist");
const target = resolve(
  here,
  "../../../../ststudio.top/app/static/works/forge-regex"
);

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(src)) {
    const from = join(src, name);
    const to = join(dest, name);
    if (statSync(from).isDirectory()) copyDir(from, to);
    else copyFileSync(from, to);
  }
}

mkdirSync(target, { recursive: true });
// Replace built assets; keep any non-dist siblings if present
const assetsDest = join(target, "assets");
rmSync(assetsDest, { recursive: true, force: true });
copyDir(dist, target);
console.log(`Copied ${dist} → ${target}`);
