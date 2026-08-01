# Tester ReDoS + Capture Groups + Editable Flags — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the post-generate panel a credible local debugger: editable `gims u` flags, a capture-group table under live test, and a non-blocking ReDoS heuristic warning.

**Architecture:** Pure client-side TypeScript helpers (`regex-flags`, `regex-matches`, `regex-redos`) + three small presentational components wired into `ForgeHome`. No new npm dependencies. EN/ZH via `copy.ts` / `i18n.ts`.

**Tech Stack:** Next.js 16, React 19, existing `buildHighlightParts`, `tsx` scripts for checks (same pattern as `check:examples`).

**Spec:** `docs/superpowers/specs/2026-08-01-tester-redos-groups-flags-design.md`

---

## File map

| File | Role |
|------|------|
| `src/lib/regex-flags.ts` | `toggleFlag`, `normalizeFlags`, `FLAG_CHIPS` |
| `src/lib/regex-matches.ts` | `buildMatchRows` → table data |
| `src/lib/regex-redos.ts` | `analyzeRedosRisk` |
| `scripts/check-regex-tester.ts` | Assert helpers |
| `src/components/FlagEditor.tsx` | Flag chips |
| `src/components/CaptureGroupsTable.tsx` | Table UI |
| `src/components/RedosWarning.tsx` | Banner |
| `src/components/ForgeHome.tsx` | Wire state + mount |
| `src/lib/copy.ts` | EN strings |
| `src/lib/i18n.ts` | ZH strings |
| `package.json` | `check:regex-tester` script |

---

### Task 1: Flag helpers + tests

**Files:**
- Create: `src/lib/regex-flags.ts`
- Create: `scripts/check-regex-tester.ts`
- Modify: `package.json`

- [ ] **Step 1: Write `src/lib/regex-flags.ts`**

```ts
export const FLAG_CHIPS = ["g", "i", "m", "s", "u"] as const;
export type FlagChip = (typeof FLAG_CHIPS)[number];

/** Keep only known chips, stable order g-i-m-s-u, drop unknowns. */
export function normalizeFlags(flags: string): string {
  const set = new Set(flags.split(""));
  return FLAG_CHIPS.filter((f) => set.has(f)).join("");
}

export function toggleFlag(flags: string, flag: FlagChip): string {
  const set = new Set(normalizeFlags(flags).split(""));
  if (set.has(flag)) set.delete(flag);
  else set.add(flag);
  return FLAG_CHIPS.filter((f) => set.has(f)).join("");
}

export function hasFlag(flags: string, flag: FlagChip): boolean {
  return normalizeFlags(flags).includes(flag);
}
```

- [ ] **Step 2: Write failing/passing check script skeleton**

Create `scripts/check-regex-tester.ts`:

```ts
import assert from "node:assert/strict";
import { normalizeFlags, toggleFlag, hasFlag } from "../src/lib/regex-flags";

assert.equal(normalizeFlags("igx"), "gi");
assert.equal(toggleFlag("g", "i"), "gi");
assert.equal(toggleFlag("gi", "g"), "i");
assert.equal(hasFlag("gim", "m"), true);
console.log("regex-flags: ok");
```

- [ ] **Step 3: Add npm script and run**

In `package.json` scripts:

```json
"check:regex-tester": "npx --yes tsx scripts/check-regex-tester.ts"
```

Run: `npm run check:regex-tester`  
Expected: `regex-flags: ok`

- [ ] **Step 4: Commit** (only if user asked to commit; otherwise skip)

---

### Task 2: Capture-group match rows + ReDoS heuristics

**Files:**
- Create: `src/lib/regex-matches.ts`
- Create: `src/lib/regex-redos.ts`
- Modify: `scripts/check-regex-tester.ts`

- [ ] **Step 1: Write `src/lib/regex-matches.ts`**

```ts
export type MatchRow = {
  index: number;
  full: string;
  groups: Array<string | undefined>;
  named: Record<string, string>;
};

const MAX_ROWS = 50;

function withGlobal(flags: string): string {
  return flags.includes("g") ? flags : `${flags}g`;
}

export function buildMatchRows(
  text: string,
  pattern: string,
  flags: string
): MatchRow[] | null {
  try {
    const re = new RegExp(pattern, withGlobal(flags));
    const rows: MatchRow[] = [];
    let m: RegExpExecArray | null;
    let guard = 0;
    while ((m = re.exec(text)) !== null && guard++ < MAX_ROWS) {
      if (m[0] === "") {
        re.lastIndex++;
        continue;
      }
      const groups: Array<string | undefined> = [];
      for (let i = 1; i < m.length; i++) groups.push(m[i]);
      const named: Record<string, string> = {};
      if (m.groups) {
        for (const [k, v] of Object.entries(m.groups)) {
          if (v !== undefined) named[k] = v;
        }
      }
      rows.push({ index: m.index, full: m[0], groups, named });
      if (!re.global) break;
    }
    return rows;
  } catch {
    return null;
  }
}

export function maxGroupCount(rows: MatchRow[]): number {
  return rows.reduce((n, r) => Math.max(n, r.groups.length), 0);
}
```

- [ ] **Step 2: Write `src/lib/regex-redos.ts`**

```ts
export type RedosCode =
  | "nestedQuantifier"
  | "adjacentOverlap"
  | "optionalPlusStar"
  | null;

export type RedosResult = { risk: boolean; code: RedosCode };

/** Lightweight static heuristics — advisory only. */
export function analyzeRedosRisk(pattern: string): RedosResult {
  if (!pattern) return { risk: false, code: null };

  // (…quantifier…)quantifier  e.g. (a+)+  (a*)*  (foo)?+
  if (/\((?:[^()\\]|\\.)*[+*][?]?(?:[^()\\]|\\.)*\)[+*?]/.test(pattern)) {
    return { risk: true, code: "nestedQuantifier" };
  }
  if (/\((?:[^()\\]|\\.)*\{[\d,]+\}(?:[^()\\]|\\.)*\)[+*?]/.test(pattern)) {
    return { risk: true, code: "nestedQuantifier" };
  }

  // optional wrapper around open quantifier: (a+)? (a*)?
  if (/\((?:[^()\\]|\\.)*[+*][?]?(?:[^()\\]|\\.)*\)\?/.test(pattern)) {
    return { risk: true, code: "optionalPlusStar" };
  }

  // adjacent greedy overlap: \w+\w*  .*.+  [a-z]+[a-z]*
  if (
    /(?:\.\*|\\.[\w]*\*|\\[wWdDsS]\*|\[(?:\\.|[^\]])+\]\*)(?:\.\+|\\.[\w]*\+|\\[wWdDsS]\+|\[(?:\\.|[^\]])+\]\+)/.test(
      pattern
    ) ||
    /(?:\.\+|\\.[\w]*\+|\\[wWdDsS]\+|\[(?:\\.|[^\]])+\]\+)(?:\.\*|\\.[\w]*\*|\\[wWdDsS]\*|\[(?:\\.|[^\]])+\]\*)/.test(
      pattern
    )
  ) {
    return { risk: true, code: "adjacentOverlap" };
  }

  return { risk: false, code: null };
}
```

- [ ] **Step 3: Extend `scripts/check-regex-tester.ts`**

```ts
import { buildMatchRows, maxGroupCount } from "../src/lib/regex-matches";
import { analyzeRedosRisk } from "../src/lib/regex-redos";

const html = `<a href="https://a.com">A</a><a href='https://b.com'>B</a>`;
const rows = buildMatchRows(
  html,
  String.raw`href\s*=\s*(['"])(.*?)\1`,
  "gi"
);
assert.ok(rows && rows.length >= 2);
assert.equal(rows![0].groups[1], "https://a.com");
assert.ok(maxGroupCount(rows!) >= 2);

assert.equal(analyzeRedosRisk("(a+)+").risk, true);
assert.equal(analyzeRedosRisk("(a+)+").code, "nestedQuantifier");
assert.equal(analyzeRedosRisk(String.raw`[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}`).risk, false);
console.log("regex-matches+redos: ok");
```

Run: `npm run check:regex-tester`  
Expected: both `ok` lines.

---

### Task 3: i18n strings

**Files:**
- Modify: `src/lib/copy.ts`
- Modify: `src/lib/i18n.ts`

- [ ] **Step 1: Add EN keys to `copy.ts`** (after `noMatchesHint` or near export/replace keys)

```ts
  flagsLabel: "Flags",
  capturesTitle: "Capture groups",
  captureDash: "—",
  redosTitle: "This pattern may be slow or unsafe on some inputs (ReDoS risk).",
  redosNested: "A quantified group contains another quantifier (e.g. (a+)+). Prefer a tighter pattern.",
  redosAdjacent: "Adjacent overlapping quantifiers can backtrack heavily. Tighten the pattern if you can.",
  redosOptional: "An optional group wrapping a quantifier can explode on crafted input. Consider rewriting.",
```

- [ ] **Step 2: Add matching ZH keys to `i18n.ts`**

```ts
  flagsLabel: "标志位",
  capturesTitle: "捕获组",
  captureDash: "—",
  redosTitle: "这条正则在部分输入上可能很慢或不安全（ReDoS 风险）。",
  redosNested: "带量词的分组里又套了量词（例如 (a+)+）。尽量改成更收紧的写法。",
  redosAdjacent: "相邻且可能重叠的量词容易引发大量回溯。能收紧就收紧。",
  redosOptional: "可选分组再包一层量词，遇到恶意输入可能爆炸。建议改写。",
```

Typecheck: `MessageKey` is `keyof typeof en` — ZH must include every new key.

---

### Task 4: UI components

**Files:**
- Create: `src/components/FlagEditor.tsx`
- Create: `src/components/CaptureGroupsTable.tsx`
- Create: `src/components/RedosWarning.tsx`

- [ ] **Step 1: `FlagEditor.tsx`**

```tsx
"use client";

import { FLAG_CHIPS, hasFlag, toggleFlag, type FlagChip } from "@/lib/regex-flags";
import { useLocale } from "@/components/LocaleProvider";

export function FlagEditor({
  flags,
  onChange,
}: {
  flags: string;
  onChange: (next: string) => void;
}) {
  const { t } = useLocale();
  return (
    <div className="flex flex-wrap items-center gap-2 px-5 pb-3">
      <span className="text-xs font-medium text-subtle">{t("flagsLabel")}</span>
      <div className="flex flex-wrap gap-1.5">
        {FLAG_CHIPS.map((flag) => {
          const on = hasFlag(flags, flag);
          return (
            <button
              key={flag}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(toggleFlag(flags, flag as FlagChip))}
              className={`btn-press min-w-8 px-2 py-1 rounded-md font-mono text-xs font-semibold border transition-colors ${
                on
                  ? "bg-accent-soft text-accent border-accent/30"
                  : "bg-surface-raised text-muted border-border hover:border-accent/40"
              }`}
            >
              {flag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `RedosWarning.tsx`**

```tsx
"use client";

import type { RedosCode } from "@/lib/regex-redos";
import { useLocale } from "@/components/LocaleProvider";
import type { MessageKey } from "@/lib/i18n";

const CODE_KEY: Record<Exclude<RedosCode, null>, MessageKey> = {
  nestedQuantifier: "redosNested",
  adjacentOverlap: "redosAdjacent",
  optionalPlusStar: "redosOptional",
};

export function RedosWarning({ code }: { code: Exclude<RedosCode, null> }) {
  const { t } = useLocale();
  return (
    <div
      role="status"
      className="mx-5 mb-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3.5 py-3 text-sm text-ink"
    >
      <p className="font-medium">{t("redosTitle")}</p>
      <p className="mt-1 text-muted leading-snug">{t(CODE_KEY[code])}</p>
    </div>
  );
}
```

- [ ] **Step 3: `CaptureGroupsTable.tsx`**

```tsx
"use client";

import {
  buildMatchRows,
  maxGroupCount,
  type MatchRow,
} from "@/lib/regex-matches";
import { useLocale } from "@/components/LocaleProvider";

function cell(v: string | undefined, dash: string): string {
  if (v === undefined) return dash;
  if (v === "") return '""';
  return v;
}

export function CaptureGroupsTable({
  pattern,
  flags,
  testText,
}: {
  pattern: string;
  flags: string;
  testText: string;
}) {
  const { t } = useLocale();
  const rows = buildMatchRows(testText, pattern, flags);
  if (!rows || rows.length === 0) return null;
  const gCount = maxGroupCount(rows);
  const hasNamed = rows.some((r) => Object.keys(r.named).length > 0);

  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-border">
      <div className="px-3 py-2 text-xs font-semibold text-ink bg-surface-raised border-b border-border">
        {t("capturesTitle")}
      </div>
      <table className="w-full text-xs font-mono text-left">
        <thead>
          <tr className="text-subtle border-b border-border">
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">$0</th>
            {Array.from({ length: gCount }, (_, i) => (
              <th key={i} className="px-3 py-2 font-medium">{`$${i + 1}`}</th>
            ))}
            {hasNamed ? (
              <th className="px-3 py-2 font-medium">named</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r: MatchRow, i) => (
            <tr key={`${r.index}-${i}`} className="border-b border-border/70 last:border-0">
              <td className="px-3 py-2 text-subtle">{i + 1}</td>
              <td className="px-3 py-2 text-ink max-w-[14rem] truncate" title={r.full}>
                {r.full}
              </td>
              {Array.from({ length: gCount }, (_, gi) => (
                <td
                  key={gi}
                  className="px-3 py-2 text-muted max-w-[12rem] truncate"
                  title={r.groups[gi] ?? ""}
                >
                  {cell(r.groups[gi], t("captureDash"))}
                </td>
              ))}
              {hasNamed ? (
                <td className="px-3 py-2 text-muted">
                  {Object.entries(r.named)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(" · ") || t("captureDash")}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

### Task 5: Wire into `ForgeHome`

**Files:**
- Modify: `src/components/ForgeHome.tsx`

- [ ] **Step 1: Imports**

```ts
import { FlagEditor } from "@/components/FlagEditor";
import { CaptureGroupsTable } from "@/components/CaptureGroupsTable";
import { RedosWarning } from "@/components/RedosWarning";
import { analyzeRedosRisk } from "@/lib/regex-redos";
import { normalizeFlags } from "@/lib/regex-flags";
```

- [ ] **Step 2: When setting result from generate / examples / share, normalize flags**

Wherever `setResult({ pattern, flags, explanation })` runs, use `flags: normalizeFlags(flags || "")` (or `normalizeFlags(data.flags || "g")` if empty default is desired — prefer keep API flags then normalize).

- [ ] **Step 3: Derive redos once per pattern**

Inside render when `result` exists:

```ts
const redos = analyzeRedosRisk(result.pattern);
```

- [ ] **Step 4: Mount UI**

Under the regex monobox (`/{pattern}/{flags}`), before “How it works”:

```tsx
{redos.risk && redos.code ? <RedosWarning code={redos.code} /> : null}
<FlagEditor
  flags={result.flags}
  onChange={(next) =>
    setResult((prev) => (prev ? { ...prev, flags: next } : prev))
  }
/>
```

Also keep the monobox `/{result.flags}` in sync (already bound to state).

Inside the test `<section>`, after the highlight `<div>`, add:

```tsx
<CaptureGroupsTable
  pattern={result.pattern}
  flags={result.flags}
  testText={testText}
/>
```

- [ ] **Step 5: Manual smoke**

Run `npm run dev`, open `/` and `/cn`:

1. Generate or click an example with captures → table shows `$0/$1…`.
2. Toggle `i` on a case-sensitive sample → match count changes without regenerate.
3. Temporarily set pattern conceptually via a known risky example: paste into a quick unit path — or add a one-line console check; for UI, use browser console `analyzeRedosRisk` via the check script already covering `(a+)+`. Optional: temporarily type in check only.
4. Replace / Export still use updated flags.

Run: `npm run check:regex-tester`  
Run: `npx tsc --noEmit` (or `npm run build` if that is the project gate)

---

### Task 6: Self-review vs spec

- [ ] **Step 1: Spec coverage checklist**

| Spec item | Task |
|-----------|------|
| Editable g/i/m/s/u | 1, 4, 5 |
| Capture table ≤50 | 2, 4, 5 |
| ReDoS heuristics + banner | 2, 4, 5 |
| i18n EN/ZH | 3 |
| No new deps / no pattern edit | upheld |
| check script | 1–2 |

- [ ] **Step 2: Done when checks green and `/cn` smoke OK**

---

## Execution handoff

Plan saved to `docs/superpowers/plans/2026-08-01-tester-redos-groups-flags.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — run tasks in this session with executing-plans checkpoints  

Which approach?
