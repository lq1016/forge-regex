import assert from "node:assert/strict";
import { normalizeFlags, toggleFlag, hasFlag } from "../src/lib/regex-flags";
import { buildMatchRows, maxGroupCount } from "../src/lib/regex-matches";
import { analyzeRedosRisk } from "../src/lib/regex-redos";

assert.equal(normalizeFlags("igx"), "gi");
assert.equal(toggleFlag("g", "i"), "gi");
assert.equal(toggleFlag("gi", "g"), "i");
assert.equal(hasFlag("gim", "m"), true);
console.log("regex-flags: ok");

const html = `<a href="https://a.com">A</a><a href='https://b.com'>B</a>`;
const rows = buildMatchRows(
  html,
  String.raw`href\s*=\s*(['"])(.*?)\1`,
  "gi"
);
assert.ok(rows && rows.length >= 2);
assert.equal(rows![0].groups[1], "https://a.com");
assert.ok(maxGroupCount(rows!) >= 2);

assert.equal(analyzeRedosRisk("(a+)?").code, "optionalPlusStar");
assert.equal(analyzeRedosRisk("(a+)+").risk, true);
assert.equal(analyzeRedosRisk("(a+)+").code, "nestedQuantifier");
assert.equal(analyzeRedosRisk(String.raw`[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}`).risk, false);
console.log("regex-matches+redos: ok");
