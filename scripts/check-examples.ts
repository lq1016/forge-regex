/**
 * Validate home demos + SEO pattern pages: each regex must match its sample.
 * Run: pnpm check:examples
 */
import { readFileSync } from "fs";
import { PATTERNS } from "../src/lib/patterns";

type Case = {
  group: string;
  label: string;
  pattern: string;
  flags: string;
  sample: string;
  expectCount?: number;
  forbid?: string[];
};

function runCase(c: Case) {
  const flags = c.flags.includes("g") ? c.flags : `${c.flags}g`;
  let re: RegExp;
  try {
    re = new RegExp(c.pattern, flags);
  } catch (e) {
    return {
      ok: false,
      detail: `invalid: ${(e as Error).message}`,
      matches: [] as string[],
    };
  }
  const matches = [...c.sample.matchAll(re)].map((m) => m[0]);
  const issues: string[] = [];
  if (matches.length === 0) issues.push("0 matches");
  if (c.expectCount != null && matches.length !== c.expectCount) {
    issues.push(`expected ${c.expectCount} got ${matches.length}`);
  }
  for (const bad of c.forbid ?? []) {
    if (matches.some((m) => m === bad || m.includes(bad))) {
      issues.push(`forbidden ${JSON.stringify(bad)}`);
    }
  }
  return { ok: issues.length === 0, detail: issues.join("; "), matches };
}

/** Parse EXAMPLES / EXAMPLES_ZH blocks from ForgeHome.tsx */
function parseHomeExamples(): Case[] {
  const src = readFileSync("src/components/ForgeHome.tsx", "utf8");
  const out: Case[] = [];
  const re =
    /label:\s*"([^"]+)"[\s\S]*?sample:\s*(?:"((?:[^"\\]|\\.)*)"|`([^`]*)`)[\s\S]*?pattern:\s*\n?\s*"((?:[^"\\]|\\.)*)"[\s\S]*?flags:\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  const enEnd = src.indexOf("const EXAMPLES_ZH");
  const zhStart = enEnd;
  while ((m = re.exec(src))) {
    const idx = m.index;
    const group = idx < zhStart ? "home-en" : "home-zh";
    const sample =
      m[2] != null ? (JSON.parse(`"${m[2]}"`) as string) : m[3]!;
    const pattern = JSON.parse(`"${m[4]}"`) as string;
    out.push({
      group,
      label: m[1],
      pattern,
      flags: m[5],
      sample,
    });
  }
  return out;
}

let failed = 0;

console.log("== home (ForgeHome.tsx) ==");
const homeExpect: Record<string, { count: number; forbid?: string[] }> = {
  "home-zh:中文姓名": { count: 3, forbid: ["李", "skip", "John"] },
  "home-zh:车牌号": { count: 3 },
  "home-zh:身份证号": { count: 2 },
};
for (const c of parseHomeExamples()) {
  const exp = homeExpect[`${c.group}:${c.label}`];
  if (exp) {
    c.expectCount = exp.count;
    c.forbid = exp.forbid;
  }
  const r = runCase(c);
  if (!r.ok) failed++;
  console.log(
    `${r.ok ? "OK" : "FAIL"} ${c.group}:${c.label} → ${r.matches.length} ${JSON.stringify(r.matches)}${r.ok ? "" : " :: " + r.detail}`
  );
}

console.log("\n== pattern pages (patterns.ts) ==");
for (const p of PATTERNS) {
  for (const loc of ["en", "zh"] as const) {
    const c: Case = {
      group: `pattern-${loc}`,
      label: p.slug,
      pattern: p.pattern,
      flags: p.flags,
      sample: p[loc].sample,
    };
    // URL pages: forbid CJK bleed
    if (p.slug === "url") {
      c.forbid = ["忽略", "。忽略"];
      c.expectCount = 2;
    }
    if (p.slug === "cn-id") {
      c.expectCount = 2;
      // ensure overlong digit string isn't partially matched when present
      if (!c.sample.includes("1101011990030789123")) {
        c.sample += " 无效：1101011990030789123";
      }
    }
    const r = runCase(c);
    if (!r.ok) failed++;
    console.log(
      `${r.ok ? "OK" : "FAIL"} ${c.group}:${c.label} → ${r.matches.length} ${JSON.stringify(r.matches.slice(0, 5))}${r.ok ? "" : " :: " + r.detail}`
    );
  }
}

// Extra assertions for known footguns
console.log("\n== footgun checks ==");
const footguns: Case[] = [
  {
    group: "footgun",
    label: "id-no-prefix-of-longer",
    pattern:
      "(?<!\\d)[1-9]\\d{5}(?:19|20)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx](?!\\d)",
    flags: "g",
    sample: "1101011990030789123",
    expectCount: 0,
  },
  {
    group: "footgun",
    label: "url-no-cjk-tail",
    pattern:
      "https?:\\/\\/[^\\s\"'<>\\u4e00-\\u9fff\\u3000-\\u303f\\uff00-\\uffef]+(?<![.,;:!?])",
    flags: "gi",
    sample: "http://news.cn/path。后面是中文",
    expectCount: 1,
    forbid: ["后面", "。"],
  },
];
for (const c of footguns) {
  const r = runCase(c);
  // expectCount 0 means ok when matches.length===0
  let ok = r.ok;
  if (c.expectCount === 0) ok = r.matches.length === 0;
  else ok = r.ok;
  if (!ok) failed++;
  console.log(
    `${ok ? "OK" : "FAIL"} ${c.label} → ${JSON.stringify(r.matches)}${ok ? "" : " :: " + r.detail}`
  );
}

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nAll example checks passed");
