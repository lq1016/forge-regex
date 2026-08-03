# Editable Pattern — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users edit the generated regex pattern string in place so live test, replace, export, share, captures, and ReDoS all update immediately without leaving Forge.

**Architecture:** Add a small controlled `PatternEditor` (pattern only; flags stay on `FlagEditor`) and a tiny `isValidRegExp` helper. `ForgeHome` updates `result.pattern` on change and marks explanation as stale when the pattern diverges from the last AI/example value. No new npm deps; EN/ZH via `copy.ts` / `i18n.ts`. Checks via existing `tsx` assert scripts.

**Tech Stack:** Next.js 16, React 19, TypeScript, `npm run check:regex-tester` / new check script pattern.

**Spec:** Month 1 “Editable pattern” in `docs/superpowers/specs/2026-08-03-90-day-roadmap-design.md` (AI refine is a **separate** later plan).

## Global Constraints

- Live engine remains browser `RegExp` (JS) — no multi-engine runtime.
- Invalid patterns must fail soft (highlight / captures / replace already null-safe on throw).
- Flags remain editable only via existing `FlagEditor` (`g i m s u`); do not put a free-text flags field in the monobox.
- EN + ZH strings for any new copy; keys must exist in both `src/lib/copy.ts` and `src/lib/i18n.ts`.
- Sticky footer shell unchanged — only edit the result card monobox area.
- No AI refine, no history, no quota refund in this plan.

---

## File map

| File | Role |
|------|------|
| `src/lib/regex-valid.ts` | `isValidRegExp(pattern, flags)` — pure helper for UI + checks |
| `src/components/PatternEditor.tsx` | Controlled monobox: `/` + editable pattern + `/{flags}` chrome |
| `src/components/ForgeHome.tsx` | Replace static spans with `PatternEditor`; track `patternDirty` |
| `src/lib/copy.ts` | EN: `patternEditLabel`, `patternInvalid`, `explanationStale` |
| `src/lib/i18n.ts` | ZH equivalents |
| `scripts/check-regex-valid.ts` | Assert `isValidRegExp` |
| `package.json` | `check:regex-valid` script |

---

### Task 1: `isValidRegExp` helper + check script

**Files:**
- Create: `src/lib/regex-valid.ts`
- Create: `scripts/check-regex-valid.ts`
- Modify: `package.json` (scripts only)

**Interfaces:**
- Consumes: none
- Produces: `isValidRegExp(pattern: string, flags?: string): boolean`

- [ ] **Step 1: Write the failing check script first**

Create `scripts/check-regex-valid.ts`:

```ts
import assert from "node:assert/strict";
import { isValidRegExp } from "../src/lib/regex-valid";

assert.equal(isValidRegExp("a+"), true);
assert.equal(isValidRegExp("[a-z]+", "gi"), true);
assert.equal(isValidRegExp("(unclosed"), false);
assert.equal(isValidRegExp("*"), false);
assert.equal(isValidRegExp(""), true); // empty pattern is valid RegExp
console.log("regex-valid: ok");
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx --yes tsx scripts/check-regex-valid.ts`  
Expected: FAIL — `Cannot find module '../src/lib/regex-valid'` (or similar)

- [ ] **Step 3: Implement helper**

Create `src/lib/regex-valid.ts`:

```ts
/** True if `new RegExp(pattern, flags)` does not throw. */
export function isValidRegExp(pattern: string, flags = ""): boolean {
  try {
    // eslint-disable-next-line no-new
    new RegExp(pattern, flags);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Add npm script and run**

In `package.json` `"scripts"` add:

```json
"check:regex-valid": "npx --yes tsx scripts/check-regex-valid.ts"
```

Run: `npm run check:regex-valid`  
Expected stdout includes: `regex-valid: ok`

- [ ] **Step 5: Commit**

```bash
git add src/lib/regex-valid.ts scripts/check-regex-valid.ts package.json
git commit -m "$(cat <<'EOF'
feat: add isValidRegExp helper for editable patterns

EOF
)"
```

---

### Task 2: i18n strings

**Files:**
- Modify: `src/lib/copy.ts`
- Modify: `src/lib/i18n.ts`

**Interfaces:**
- Consumes: existing `MessageKey` / `copy` pattern
- Produces: keys `patternEditLabel`, `patternInvalid`, `explanationStale`

- [ ] **Step 1: Add EN keys to `src/lib/copy.ts`**

Insert near the existing `flagsLabel` / `generatedRegex` area:

```ts
  patternEditLabel: "Pattern",
  patternInvalid: "Invalid pattern — fix the syntax to see matches.",
  explanationStale: "Pattern edited — token explanations may no longer match.",
```

- [ ] **Step 2: Add ZH keys to `src/lib/i18n.ts`**

Same key names (TypeScript will error if missing):

```ts
  patternEditLabel: "正则",
  patternInvalid: "正则无效——修好语法后才能看到匹配。",
  explanationStale: "已手动修改正则——下方分词说明可能已过时。",
```

- [ ] **Step 3: Typecheck that both maps stay in sync**

Run: `npx tsc --noEmit`  
Expected: no errors about missing `zh` keys (or project’s usual clean/near-clean state; fix any new key mismatch you introduced).

- [ ] **Step 4: Commit**

```bash
git add src/lib/copy.ts src/lib/i18n.ts
git commit -m "$(cat <<'EOF'
i18n: add editable-pattern labels (EN/ZH)

EOF
)"
```

---

### Task 3: `PatternEditor` component

**Files:**
- Create: `src/components/PatternEditor.tsx`

**Interfaces:**
- Consumes: `isValidRegExp` from `@/lib/regex-valid`; `useLocale` / `t`
- Produces: `<PatternEditor pattern flags onChange />` where `onChange(nextPattern: string)`

- [ ] **Step 1: Create `src/components/PatternEditor.tsx`**

```tsx
"use client";

import { isValidRegExp } from "@/lib/regex-valid";
import { useLocale } from "@/components/LocaleProvider";

export function PatternEditor({
  pattern,
  flags,
  onChange,
}: {
  pattern: string;
  flags: string;
  onChange: (next: string) => void;
}) {
  const { t } = useLocale();
  const valid = isValidRegExp(pattern, flags);

  return (
    <div className="mx-5 mb-4">
      <label htmlFor="forge-pattern-edit" className="sr-only">
        {t("patternEditLabel")}
      </label>
      <div
        className={`flex items-start gap-0 font-mono text-[13px] sm:text-sm leading-relaxed bg-ink text-[#e8eaed] rounded-xl px-4 py-3.5 overflow-x-auto selection:bg-accent/40 border ${
          valid ? "border-transparent" : "border-amber-500/60"
        }`}
      >
        <span className="text-teal-300 shrink-0 select-none" aria-hidden>
          /
        </span>
        <textarea
          id="forge-pattern-edit"
          value={pattern}
          spellCheck={false}
          rows={1}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 bg-transparent text-[#f4f5f7] outline-none resize-y min-h-[1.25rem] field-sizing-content"
          aria-invalid={!valid}
        />
        <span className="text-teal-300 shrink-0 select-none" aria-hidden>
          /{flags}
        </span>
      </div>
      {!valid ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400 px-0.5">
          {t("patternInvalid")}
        </p>
      ) : null}
    </div>
  );
}
```

Notes for implementer:
- Flags display is read-only chrome; toggling still happens in `FlagEditor` below.
- Prefer a single-line feel but allow grow via `resize-y` for long patterns.
- If `field-sizing-content` is unsupported in the build target, drop that class — `rows={1}` + `resize-y` is enough.

- [ ] **Step 2: Smoke-import check**

Run: `npx --yes tsx -e "require('./src/components/PatternEditor.tsx')"`  
Expected: may fail on JSX/client — that is OK. Prefer: ensure file exists and `npm run lint -- --file src/components/PatternEditor.tsx` if eslint file filter works; otherwise skip to ForgeHome wire-up and use `npm run build` later.

Practical check: `test -f src/components/PatternEditor.tsx && echo ok`  
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add src/components/PatternEditor.tsx
git commit -m "$(cat <<'EOF'
feat: add PatternEditor for in-place regex edits

EOF
)"
```

---

### Task 4: Wire `PatternEditor` into `ForgeHome`

**Files:**
- Modify: `src/components/ForgeHome.tsx`

**Interfaces:**
- Consumes: `PatternEditor`; existing `setResult` / `RegexResult`
- Produces: editing pattern updates `result.pattern`; `patternDirty` drives stale explanation banner

- [ ] **Step 1: Add import + `patternDirty` state**

Near other imports:

```tsx
import { PatternEditor } from "@/components/PatternEditor";
```

Inside `ForgeHomeInner` (or the component that owns `result`), add:

```tsx
const [patternDirty, setPatternDirty] = useState(false);
```

Whenever a **new** result is loaded from generate / example / share (every existing `setResult({...})` that replaces the whole result), also:

```tsx
setPatternDirty(false);
```

Do this in the same call sites that currently `setResult` with a fresh pattern (generate success, example click, share load). Do **not** reset dirty when only flags change.

- [ ] **Step 2: Replace static monobox with PatternEditor**

Remove:

```tsx
              <div className="mx-5 mb-4 font-mono text-[13px] sm:text-sm leading-relaxed bg-ink text-[#e8eaed] rounded-xl px-4 py-3.5 overflow-x-auto selection:bg-accent/40">
                <span className="text-teal-300">/</span>
                <span className="text-[#f4f5f7]">{result.pattern}</span>
                <span className="text-teal-300">/{result.flags}</span>
              </div>
```

Replace with:

```tsx
              <PatternEditor
                pattern={result.pattern}
                flags={result.flags}
                onChange={(next) => {
                  setPatternDirty(true);
                  setResult((prev) =>
                    prev ? { ...prev, pattern: next } : prev
                  );
                }}
              />
              {patternDirty ? (
                <p className="mx-5 mb-3 text-xs text-subtle">
                  {t("explanationStale")}
                </p>
              ) : null}
```

Keep `FlagEditor`, `RedosWarning`, `ShareButton`, `ReplacePanel`, `ExportPanel`, `CaptureGroupsTable` as-is — they already read `result.pattern` / `result.flags`.

- [ ] **Step 3: Manual verification checklist**

Run: `npm run dev`  
Open `/` (and `/cn`):

1. Generate or click an example → monobox shows editable pattern.
2. Edit pattern so it still matches sample → highlight / captures / replace update.
3. Break the pattern (e.g. unclosed `(`) → amber border + `patternInvalid` copy; no crash.
4. Toggle a flag → flags chrome on monobox updates; pattern text unchanged.
5. Copy / Share still use the **edited** pattern.
6. After edit, `explanationStale` appears; after new Generate / example, it disappears.

- [ ] **Step 4: Commit**

```bash
git add src/components/ForgeHome.tsx
git commit -m "$(cat <<'EOF'
feat: wire editable pattern into Forge home result card

EOF
)"
```

---

### Task 5: Final verification

**Files:** none new

- [ ] **Step 1: Run helper checks**

Run:

```bash
npm run check:regex-valid
npm run check:regex-tester
```

Expected: both print `ok` lines and exit 0.

- [ ] **Step 2: Lint / typecheck touched surface**

Run:

```bash
npx tsc --noEmit
```

Expected: no new errors from `regex-valid`, `PatternEditor`, or missing i18n keys.

- [ ] **Step 3: Done**

No further commit unless Step 4 of Task 4 was skipped and files remain dirty — then one commit covering remaining changes.

---

## Out of scope (do not implement in this plan)

- AI refine presets / refine API framing (separate Month 1 plan)
- Failed-generation quota refund
- Editable pattern on `/r/[id]` share view (read-only stays)
- Clearing `explanation` array on edit (stale banner only)
- Local history

## Spec coverage (self-review)

| Roadmap / acceptance item | Task |
|---------------------------|------|
| Editable pattern in result monobox | Task 3–4 |
| Live test / replace / export / share / captures / ReDoS follow | Task 4 (existing consumers) |
| Invalid patterns fail soft | Task 1 + PatternEditor `aria-invalid` + existing null-safe consumers |
| EN/ZH | Task 2 |
| AI refine | Out of scope (next plan) |
| Quota refund patch | Out of scope |
