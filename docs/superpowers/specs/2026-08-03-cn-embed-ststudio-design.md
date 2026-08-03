# Forge Regex CN → ststudio.top `/works/forge-regex` — Design

**Date:** 2026-08-03  
**Status:** Approved (approach 3 — host-site works page + shared core)  
**Products:** Forge Regex EN (`regex.ststudio.top`) · SilentTrace Studio (`www.ststudio.top`)

## Goals

1. **Chinese edition lives on the main site** at `https://www.ststudio.top/works/forge-regex` (works catalog, not a subdomain).
2. **English edition stays** on `https://regex.ststudio.top/` only.
3. **`regex.ststudio.top/cn` goes away** — permanent redirects to the main-site works URL.
4. **CN auth/billing uses ststudio account system** (`st_session` + `entitlements`).
5. **EN auth/billing stays Forge-native** (email/password + Paddle). **Two account systems, no SSO.**
6. **Feature/logic changes on the EN product must sync to CN** via a shared core — not two forever-forked implementations.

## Non-goals (v1)

- Merging EN and CN user accounts or wallets
- Syncing Paddle entitlements into ststudio (or the reverse)
- Rewriting generate/quota/regex helpers twice in Python and TypeScript
- Pixel-perfect parity of every EN marketing page on day one (tooling + core loop must sync; promo pages may lag)
- Keeping any public CN UI on `regex.ststudio.top`

## Context (as of design)

### Forge Regex (Next.js)

- `/` EN + Paddle Pro (`global` edition)
- `/cn` ZH + WeChat/Alipay Pro (`cn` edition) — **to be removed from this host**
- Own auth cookie/session, SQLite quota/shares

### ststudio.top (Flask)

- Cookie `st_session`, `Domain=.ststudio.top` in prod
- API: `/api/auth/{register,login,logout,me}`
- DB: `users` / `sessions` / `entitlements`
- Works pattern: `/works`, `/works/little-fox`, … (`docs/shared-account.md` already sketches Forge SSO notes; this design **does not** use cross-subdomain Forge login for CN — CN is same-origin under www)

## Architecture

### Shared core (`forge-core`)

Extract a package (recommended: monorepo `packages/forge-core` consumed by Next EN and by the CN client/server adapter) that owns:

| Area | Contents |
|------|----------|
| Regex tooling | flags, highlight, match rows, ReDoS heuristics, `isValidRegExp`, refine prompt builders, export snippets, local-history shape |
| Generate contract | request/response JSON, curated overrides, “charge only on success”, refine counts as one generation |
| Copy keys | EN/ZH message tables (or ZH export from the same source) |

**Change rule:** EN feature work that touches behavior → update `forge-core` + contract tests first → Next UI → **same release checklist** updates CN Flask shell / adapters. No “ship EN only, CN later” for core loop.

### Runtime split

| Layer | English (`regex.ststudio.top`) | Chinese (`www.ststudio.top/works/forge-regex`) |
|-------|--------------------------------|-----------------------------------------------|
| UI shell | Next.js React (current) | Flask route + page shell in works catalog; prefer **same client bundle** built from shared Forge UI/core (not a full Jinja rewrite of regex logic) |
| Who am I / Pro? | Forge auth + Paddle | `st_session` + `entitlements.product_id = forge-regex-pro` |
| Generate / quota engine | Existing Next API routes | Exposed only under **main-site paths** (e.g. `/api/forge-regex/*` or `/works/forge-regex/api/*`) via reverse-proxy to an internal generate service **or** thin Flask proxy; browser never talks to `regex.ststudio.top` for CN |
| Payments | Paddle | ststudio WeChat/Alipay flow (mirror little-fox: create → status → `grant_entitlement`) |

**Rationale:** User-facing “scheme 3” (works on main site, not subdomain). Engineering still shares one core so EN→CN sync is feasible. Pure Python reimplementation of the generator/tester is explicitly rejected for v1.

```text
Browser (www.ststudio.top)
  ├─ /works/forge-regex          → Flask page + shared client bundle
  ├─ /api/auth/*                 → ststudio auth
  ├─ /api/forge-regex/pay/*      → ststudio pay → entitlements
  └─ /api/forge-regex/generate…  → proxy → forge-core generate service (CN edition)

Browser (regex.ststudio.top)
  ├─ / , /pricing, /patterns…    → Next EN only
  └─ /cn*                        → 301 → www .../works/forge-regex…
```

## Account, entitlement, quota (isolated)

### English

- Unchanged Forge email/password + guest/free daily caps + Paddle Pro (`global`).

### Chinese

- Login: redirect to `/user?next=/works/forge-regex` (existing user center).
- Pro: `forge-regex-pro` row in `entitlements` (`status=active`).
- Free tier: define CN free limits on the generate service keyed by ststudio `user.id` (and guest fingerprint if allowing anonymous tries on the works page). **Do not** read Forge EN subscription tables.
- Pro features (unlimited generate/refine, optional cloud history sync): gate on `has_entitlement(user, "forge-regex-pro")`.
- Shares: if kept in v1, store against ststudio user id (or defer cloud share to a later milestone and keep local-only history first).

### Explicit isolation

- No account linking by email.
- No “EN Pro unlocks CN” or reverse.
- Cookie `st_session` is authoritative only on the main site origin for CN.

## Routes

### ststudio (CN)

| Path | Purpose |
|------|---------|
| `/works/forge-regex` | Tool home (generate / test / refine / local history) |
| `/works/forge-regex/pricing` | CN pricing + unlock |
| `/works/forge-regex/patterns…` | Optional in v1; may link out or port later |
| `/api/forge-regex/*` | Generate, quota, pay create/status (names finalised in plan) |
| `/works` index | Card linking to Forge Regex |

### regex.ststudio.top (EN)

| Path | Purpose |
|------|---------|
| `/`, EN app routes | English product |
| `/cn*` | **301** → `https://www.ststudio.top/works/forge-regex` (map subpaths where practical: pricing → `/works/forge-regex/pricing`) |

## `/cn` decommission

1. Ship main-site CN works page (feature parity for core loop).
2. Add 301s on `regex.ststudio.top` for `/cn` and nested paths.
3. Remove Next `/cn` tree from the EN deploy (or leave dead code behind redirects only during a short burn-in).
4. Update CN marketing links from `regex.ststudio.top/cn` → `www.ststudio.top/works/forge-regex`.
5. SEO: update sitemaps; keep 301s long-lived.

## Sync workflow (EN → CN)

1. Contract tests in `forge-core` (refine modes, highlight, quota charge rules, curated overrides).
2. EN Next consumes new core.
3. CN client bundle rebuild from same core; Flask shell only changes if new UI chrome or new pay/auth hooks.
4. Checklist item on every Forge EN release: “CN works page smoke: generate / refine / quota / entitlement gate”.

## v1 scope

**In**

1. Extract `forge-core` + tests  
2. Flask `/works/forge-regex` shell + shared client  
3. Wire `st_session` / `forge-regex-pro`  
4. Generate + live test + refine + local history on CN  
5. CN Pro unlock via ststudio pay path (mock-capable like little-fox)  
6. EN remove public `/cn` + 301s  

**Out (v1)**

- SSO / unified wallet  
- Paddle ↔ ststudio entitlement sync  
- Mandatory cloud shares/history on CN (local history OK; cloud optional follow-up)  
- Full pattern-library port on day one  

## Open questions (resolve in implementation plan)

- Exact URL prefix for CN APIs (`/api/forge-regex` vs under `/works/forge-regex/api`)
- Whether CN generate runs as a sibling Node process proxied by Nginx/Flask, or in-process later
- CN guest (logged-out) free try count vs require login first
- Where shared package lives (forge-regex monorepo vs separate repo published for both)

## Success criteria

- User can complete describe → generate → test → refine on `www.ststudio.top/works/forge-regex` while logged into ststudio.
- Purchasing CN Pro grants `forge-regex-pro` and removes generate caps.
- `regex.ststudio.top/cn` redirects to the works URL; EN site has no CN edition UI.
- A change to shared regex/generate behavior is released to EN and CN from the same core revision.
