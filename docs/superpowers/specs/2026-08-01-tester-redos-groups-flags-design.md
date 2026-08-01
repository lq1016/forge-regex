# Tester panel: ReDoS + capture groups + editable flags — Design

**Date:** 2026-08-01  
**Status:** Approved (approach A — lightweight local)  
**Product:** Forge Regex (`/` + `/cn`)

## Goals

After AI generates a regex, the same page should be a credible debugger so users do not bounce to DevKitLab / regex101:

1. **Editable flags** — toggle `g i m s u` on the result; live test / replace / export / share follow immediately.
2. **Capture group table** — under live highlight: each match row with `$0`, `$1`… and named groups.
3. **ReDoS hint** — local static heuristics; non-blocking warning banner when the pattern looks risky.

## Non-goals (v1)

- Full `recheck` / WASM ReDoS engine
- Editable pattern string in the UI (flags only)
- Flag chips for `y` / `d` (engine may still add `d` internally for highlight indices)
- Split (`String#split`) tab
- Server-side analysis

## Architecture

All three features are **client-side**, pure TypeScript, no new npm deps.

```
src/lib/regex-flags.ts      # normalize / toggle flag chars
src/lib/regex-matches.ts    # exec → rows { index, groups, named }
src/lib/regex-redos.ts      # heuristic → { risk: boolean, reasonKey }
src/components/FlagEditor.tsx
src/components/CaptureGroupsTable.tsx
src/components/RedosWarning.tsx
ForgeHome.tsx               # wire flags state, mount panels
src/lib/copy.ts + i18n.ts   # EN/ZH strings
```

Data flow:

1. Generate / share-load sets `result = { pattern, flags, explanation }`.
2. `FlagEditor` updates `result.flags` only (immutable pattern + explanation).
3. `buildHighlightParts`, `ReplacePanel`, `ExportPanel`, `ShareButton`, capture table, ReDoS all read current `result.pattern` + `result.flags`.

## Flag editor

- Chips: `g`, `i`, `m`, `s`, `u` (order fixed).
- Toggle = add/remove that char; preserve relative order of remaining flags.
- Invalid combo that throws in `RegExp` constructor: chips still toggle; highlight/table already null-safe on throw.
- Place: beside Copy / Share on the result card header, or directly under the `/pattern/flags` monobox (prefer under monobox so flags stay next to the literal).

## Capture groups table

- Cap at **50** match rows (same order of magnitude as highlight guard).
- Columns: `#` | `$0` | `$1`… (dynamic width from max group count on page) | named (compact `name=value` list if any).
- Empty string capture → show `""`; absent → `—`.
- Hidden when pattern invalid or zero matches.
- Title via i18n: EN “Capture groups” / ZH “捕获组”.

## ReDoS heuristics (v1)

Return `{ risk: true, code }` when any rule hits (first match wins for message):

| code | Pattern idea |
|------|----------------|
| `nestedQuantifier` | Quantified group that itself contains a quantifier, e.g. `(a+)+`, `(a*)+`, `(foo\|bar)+` with inner `*+?{` |
| `adjacentOverlap` | Same / overlapping quantified tokens in sequence, e.g. `\w+\w*`, `.*.+` |
| `optionalPlusStar` | `(a+)?` / `(a*)?` style optional of already-open quantifier inside |

Conservative: prefer false negatives over noisy banners. Message is advisory; never block Generate/Copy.

UI: amber banner above the regex monobox when `risk`.

## i18n keys (add)

- `flagsLabel`, `flagG`, `flagI`, `flagM`, `flagS`, `flagU` (short tooltips optional: reuse label = letter)
- `capturesTitle`, `capturesEmpty` (unused if hidden), `captureDash`
- `redosTitle`, `redosNested`, `redosAdjacent`, `redosOptional`

## Testing

No Vitest in repo. Add `scripts/check-regex-tester.ts` (tsx) asserting:

- flag toggle normalize
- match table extraction for href-style groups
- ReDoS true on `(a+)+`, false on simple email-like pattern

Wire into `package.json` as `check:regex-tester` (optional; run in plan manually).

## Success criteria

- Toggle `i` changes match count on a case-sensitive sample without regenerating.
- Href extractor sample shows `$1` / `$2` (or preferred groups) in the table.
- Pasting `(a+)+` shows ReDoS banner; normal generated crawler patterns do not.
