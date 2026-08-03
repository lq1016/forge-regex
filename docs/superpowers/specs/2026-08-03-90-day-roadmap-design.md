# Forge Regex — 90-day product roadmap

**Date:** 2026-08-03  
**Status:** Approved (approach 1 — core-loop gaps)  
**Product:** Forge Regex (`/` + `/cn`)

## Context

Already shipped: NL → regex, live highlight test, flags, capture groups, ReDoS hints, replace, multi-lang export, Pro share links, pattern library, EN/ZH, quota + Paddle / WeChat / Alipay.

Positioning: occasional regex users who hate relearning syntax — “describe → see matches,” not regex golf experts.

## Goals (90 days)

**North star:** After generate, users can verify, edit, and leave with working code **on the same page** — without bouncing to regex101.

Priority order (explicit):

1. **D — Core trust** (generation quality + tester credibility)
2. **B — Return visits** (come back to continue work)
3. **A — Pro conversion** (relief, not ransom)
4. SEO / content only as light capacity in month 3

## Non-goals (within 90 days)

- Multi-engine runtime execution (snippets only; JS remains the live engine)
- Full WASM / `recheck`-class ReDoS analysis
- Railroad diagrams / step debuggers
- Further payment-rail experiments (Paddle / CN rails stay as-is)
- Social share graph (comments, likes, graphs)
- Cloud favorites / team workspaces in months 1–2
- Anonymous share **creation** (create remains Pro)

## Approach

**Approach 1 (chosen):** Ship one core-loop gap per month. Growth and monetization do not steal the main delivery bandwidth until month 3.

Rejected:

- Parallel “tester + SEO every week” (attention split)
- Monetization hooks before trust (Pro feels like ransom)

## Principles

1. Only ship work that serves: describe → see matches → trust → leave with code.
2. One primary delivery per month; at most one small patch alongside.
3. Payments / SEO must not displace the monthly primary.
4. Non-goals stay written down to prevent scope creep.

## Success signals (solo-friendly, qualitative OK)

- Longer post-generate sessions (test / edit flags / replace / refine)
- Fewer “I still paste into regex101” reports
- Pro upgrades happen because the tool sticks — not because free is broken

---

## Month 1 — Core trust: editable pattern + AI refine

### Primary delivery

| Item | What | Why |
|------|------|-----|
| Editable pattern | Result monobox allows editing the pattern string; live test / replace / export / share / captures / ReDoS follow immediately | First reason users bounce to regex101; previously deferred in tester spec |
| AI refine | One-click presets (e.g. tighten / loosen / capture-value-only) or a short refine instruction that regenerates from current pattern + prompt | Faster trust loop than retyping a long NL prompt |

### Small patch (allowed)

- Failed generations should not consume a quota credit (or refund on hard failure)

### Out of month 1

Split tab, multi-engine run, WASM ReDoS, favorites sidebar.

### Month 1 acceptance

- User can edit pattern without leaving the page; invalid patterns fail soft (same as today).
- At least 2–3 refine presets work EN + ZH; refine uses existing `/api/generate` path with clear prompt framing.
- Quota behavior for failed generate is documented in UI copy if changed.

---

## Month 2 — Return visits: local history (not a sidebar product)

### Primary delivery

| Item | What | Why |
|------|------|-----|
| Local history | Persist last N sessions in `localStorage` (prompt, pattern, flags, testText, explanation optional) | Zero backend, zero Pro gate, immediate return value |
| Recent entry | Compact “Recent” control on home; click restores full page state | Far lighter than a full library UX |
| Share → Forge polish | `/r/[id]` → Open in Forge restores flags + test text consistently | Share becomes a draft handoff, not only a read-only showcase |

### Optional small patch (pick one, not both)

- Split preview tab, **or**
- Export snippet that includes short explanation comments

### Out of month 2

Cloud favorites, team workspace, anonymous share creation.

### Month 2 acceptance

- Closing and reopening the site still lists recent items; restore matches last saved state.
- Open-in-Forge from a share does not drop flags/test text.

---

## Month 3 — Natural monetization + light growth

| Item | What | Why |
|------|------|-----|
| History → Pro hook | Local history stays free; “sync to account / cross-device” requires Pro | Matches “Pro = relief, not ransom” |
| Pattern / scene pages | 1–2 high-quality pages per week on top of `/patterns` + CN crawler themes — no thin SEO spam | Acquisition without stealing product focus |
| Refine vs quota policy | Document whether refine burns a generation; Pro unlimited should feel tangible | Connects month-1 refine to the business model |

### Month 3 acceptance

- Signed-in Pro users can sync (or restore) history across devices; free users keep local-only with a clear upgrade path.
- At least a small batch of new scene/pattern pages live and linked from library / CN marketing paths.
- Quota rules for refine are explicit in UI and API.

---

## Ship order (implementation sequence)

1. Editable pattern (month 1, first half)
2. AI refine presets (month 1, second half)
3. Local history + Recent UI (month 2)
4. History sync = Pro (month 3)
5. Scene page thickening (month 3, interleaved)

**First implementation plan after this roadmap:** item 1 — editable pattern (with flags already shipped).

## Dependencies / constraints

- Solo capacity: one primary delivery per month.
- Live engine remains browser `RegExp` (JS).
- Existing i18n (`copy` + `i18n`) must cover new strings EN/ZH.
- Sticky footer shell rules unchanged for any new page chrome.

## Open questions (resolve in feature specs, not here)

- Exact refine preset list and whether free refine counts as a full generation.
- History N (suggested 20–50) and whether to store explanation JSON.
- Sync storage: extend SQLite vs new table — decide in month-3 feature design.
