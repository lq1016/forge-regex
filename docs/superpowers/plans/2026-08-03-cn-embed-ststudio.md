# CN Forge on ststudio `/works/forge-regex` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Chinese Forge Regex at `https://www.ststudio.top/works/forge-regex` using ststudio `st_session` + `forge-regex-pro`, keep English-only on `regex.ststudio.top`, and share product logic via `packages/forge-core` so EN changes can sync to CN.

**Architecture:** Extract pure TS core from forge-regex; EN Next keeps consuming it. CN is a Vite React SPA (shared UI + core) served by Flask under `/works/forge-regex`, calling `/api/auth/*` and `/api/forge-regex/*` on the same origin. Generate/quota run on the existing Forge Node API behind a Flask proxy that injects ststudio user id + entitlement (no browser calls to `regex.ststudio.top`). EN `/cn*` becomes 301 to the works URL.

**Tech Stack:** forge-regex (Next 16, pnpm workspace, TypeScript) · ststudio.top (Flask, Jinja, SQLite entitlements) · Vite + React for CN SPA · Nginx/Flask proxy for generate

**Spec:** `docs/superpowers/specs/2026-08-03-cn-embed-ststudio-design.md`

## Global Constraints

- EN and CN **account systems stay separate** (no SSO, no Paddle↔entitlement sync).
- CN Pro product id: **`forge-regex-pro`** exactly.
- CN cookie auth: **`st_session`** via existing `/api/auth/me`.
- CN public URLs under **`/works/forge-regex`** on www; browser must not depend on `regex.ststudio.top` for CN.
- Shared behavior lives in **`packages/forge-core`** — do not reimplement highlight/refine/quota rules in Python.
- CN guest free tries: **2 / UTC day / fingerprint** (same as current Forge guest), then require ststudio login; signed-in free: **8 / UTC day / user id**; Pro entitlement → unlimited.
- CN API prefix: **`/api/forge-regex/*`**.
- Generate backend: **proxy to Forge Node** (`FORGE_GENERATE_ORIGIN`, internal), not a Python LLM port.
- Cloud shares/history on CN: **out of v1** (local history only).
- Pattern library full port: **out of v1**.
- Both repos may need commits; keep forge-core changes in forge-regex first.

### Resolved open questions

| Question | Decision |
|----------|----------|
| API prefix | `/api/forge-regex` |
| Generate runtime | Sibling/internal Forge Node, Flask proxies |
| Guest policy | 2 guest tries, then login; 8/day signed-in free |
| Package location | `forge-regex/packages/forge-core` |

---

## File map

### forge-regex

| Path | Role |
|------|------|
| `packages/forge-core/` | Shared regex + refine + history helpers + copy ZH/EN subsets |
| `packages/forge-cn-app/` | Vite React SPA for CN embed |
| `src/lib/*` | Re-export or import from forge-core (EN) |
| `src/middleware.ts` or `next.config.ts` | 301 `/cn` → www works |
| `src/app/cn/**` | Remove or stub behind redirects after cutover |

### ststudio.top

| Path | Role |
|------|------|
| `app/services/auth.py` | `PRODUCT_FORGE_REGEX`, `products.forgeRegexPro` in `public_me` |
| `app/routes/forge_regex_api.py` | pay + generate/quota proxy |
| `app/routes/pages.py` | `/works/forge-regex`, `/works/forge-regex/pricing` |
| `app/templates/works/forge-regex.html` | SPA shell |
| `app/templates/works/forge-regex-pricing.html` | Pricing / unlock |
| `app/static/works/forge-regex/` | Built SPA assets |
| `app/templates/works/index.html` | Catalog card |
| `app/__init__.py` | Register blueprint |

---

### Task 1: Create `packages/forge-core` and move pure regex helpers

**Files:**
- Create: `packages/forge-core/package.json`
- Create: `packages/forge-core/tsconfig.json`
- Create: `packages/forge-core/src/index.ts`
- Move (or copy-then-reexport): `regex-flags.ts`, `regex-valid.ts`, `regex-highlight.ts`, `regex-matches.ts`, `regex-redos.ts`, `refine.ts`, `local-history.ts` → `packages/forge-core/src/`
- Modify: `pnpm-workspace.yaml` to include `packages/*`
- Modify: `scripts/check-regex-tester.ts`, `scripts/check-regex-valid.ts`, `scripts/check-refine-history.ts` imports
- Modify: Next app imports to `@forge-regex/core`

**Interfaces:**
- Produces: package name `@forge-regex/core` exporting existing function names unchanged (`normalizeFlags`, `isValidRegExp`, `buildHighlightParts`, `buildMatchRows`, `analyzeRedosRisk`, `buildRefineUserMessage`, `isRefineMode`, `pushLocalHistory`, `loadLocalHistory`, …)

- [ ] **Step 1: Extend workspace**

`pnpm-workspace.yaml`:

```yaml
packages:
  - "."
  - "packages/*"
```

- [ ] **Step 2: Scaffold package.json**

`packages/forge-core/package.json`:

```json
{
  "name": "@forge-regex/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

- [ ] **Step 3: Move helper files into `packages/forge-core/src/` and add `index.ts` re-exports**

```ts
export * from "./regex-flags";
export * from "./regex-valid";
export * from "./regex-highlight";
export * from "./regex-matches";
export * from "./regex-redos";
export * from "./refine";
export * from "./local-history";
```

Keep file contents identical to current `src/lib` versions.

- [ ] **Step 4: Point app + scripts at the package**

In ForgeHome and other consumers, replace `@/lib/regex-*` / `@/lib/refine` / `@/lib/local-history` with `@forge-regex/core`.

In check scripts, import from `../packages/forge-core/src/...`.

Leave thin shims in `src/lib/regex-flags.ts` etc. that re-export from `@forge-regex/core` **only if** a one-release compatibility period is needed; prefer direct imports.

- [ ] **Step 5: Run checks**

```bash
cd /Users/liuqiang/cursorProjects/works/forge-regex
pnpm install
npm run check:regex-tester
npm run check:regex-valid
npm run check:refine-history
npx tsc --noEmit
```

Expected: all `ok`, tsc clean for core moves.

- [ ] **Step 6: Commit (forge-regex)**

```bash
git add pnpm-workspace.yaml packages/forge-core src scripts package.json pnpm-lock.yaml
git commit -m "refactor: extract @forge-regex/core shared helpers"
```

---

### Task 2: ststudio entitlement product + `/api/auth/me` flag

**Files:**
- Modify: `/Users/liuqiang/cursorProjects/ststudio.top/app/services/auth.py`
- Test: manual `GET /api/auth/me` after grant

**Interfaces:**
- Produces: `PRODUCT_FORGE_REGEX = "forge-regex-pro"`; `public_me(...).products.forgeRegexPro: bool`

- [ ] **Step 1: Add constant and products map entry**

In `auth.py` next to `PRODUCT_LITTLE_FOX`:

```python
PRODUCT_FORGE_REGEX = "forge-regex-pro"
```

In `public_me`:

```python
"products": {
    "littleFoxCollection": has_entitlement(user["id"], PRODUCT_LITTLE_FOX),
    "forgeRegexPro": has_entitlement(user["id"], PRODUCT_FORGE_REGEX),
},
```

- [ ] **Step 2: Smoke from Flask shell / temporary grant**

```python
from app.services import auth
auth.grant_entitlement(USER_ID, auth.PRODUCT_FORGE_REGEX, "test-order")
```

Then `GET /api/auth/me` with session → `products.forgeRegexPro === true`.

- [ ] **Step 3: Commit (ststudio.top)**

```bash
git add app/services/auth.py
git commit -m "feat: add forge-regex-pro entitlement product flag"
```

---

### Task 3: Flask works routes + catalog card + SPA shell

**Files:**
- Create: `app/templates/works/forge-regex.html`
- Create: `app/templates/works/forge-regex-pricing.html`
- Modify: `app/routes/pages.py`
- Modify: `app/templates/works/index.html`

- [ ] **Step 1: Add routes**

```python
@pages_bp.route("/works/forge-regex")
@pages_bp.route("/works/forge-regex/")
def works_forge_regex():
    from app.services import auth
    user = auth.current_user()
    has_pro = bool(user and auth.has_entitlement(user["id"], auth.PRODUCT_FORGE_REGEX))
    return render_template(
        "works/forge-regex.html",
        page_id="works",
        authenticated=bool(user),
        has_pro=has_pro,
    )

@pages_bp.route("/works/forge-regex/pricing")
def works_forge_regex_pricing():
    from app.services import auth
    user = auth.current_user()
    has_pro = bool(user and auth.has_entitlement(user["id"], auth.PRODUCT_FORGE_REGEX))
    return render_template(
        "works/forge-regex-pricing.html",
        page_id="works",
        authenticated=bool(user),
        has_pro=has_pro,
        login_next="/works/forge-regex/pricing",
    )
```

- [ ] **Step 2: SPA shell template**

`forge-regex.html` extends `base.html`, includes `#forge-regex-root`, and:

```html
<script>
  window.__FORGE_CN__ = {
    authenticated: {{ authenticated|tojson }},
    hasPro: {{ has_pro|tojson }},
    loginUrl: "/user?next=/works/forge-regex",
    apiBase: "/api/forge-regex",
  };
</script>
<script type="module" src="/works/forge-regex/assets/index.js"></script>
```

(Exact asset hashed names come from Vite build in Task 4 — use a stable `index.js` copy step or inject manifest.)

- [ ] **Step 3: Catalog card** on `works/index.html` linking to `/works/forge-regex` (title「Forge Regex」, badge「AI 正则」).

- [ ] **Step 4: Commit (ststudio.top)**

```bash
git commit -m "feat: add /works/forge-regex shell and catalog card"
```

---

### Task 4: CN Vite app (`packages/forge-cn-app`) with ststudio auth adapter

**Files:**
- Create: `packages/forge-cn-app/` (Vite + React)
- Create: auth adapter calling `/api/auth/me` with `credentials: "same-origin"`
- Create: generate client posting to `/api/forge-regex/generate`
- Reuse UI patterns from `ForgeHome` / `RefineBar` / `PatternEditor` / `RecentHistory` / `FlagEditor` / panels — **copy or extract shared components into `packages/forge-cn-app/src`**; wire `locale="zh"` only
- Build out to `ststudio.top/app/static/works/forge-regex/`

**Interfaces:**
- Consumes: `@forge-regex/core`, `window.__FORGE_CN__`
- Produces: static assets under `/works/forge-regex/assets/*`

- [ ] **Step 1: Scaffold Vite React TS app** depending on `@forge-regex/core`

- [ ] **Step 2: Implement `StstudioAuth`**

```ts
export type StstudioMe = {
  authenticated: boolean;
  user: { id: number; email: string; displayName: string } | null;
  products: { forgeRegexPro?: boolean };
};

export async function fetchMe(): Promise<StstudioMe> {
  const res = await fetch("/api/auth/me", { credentials: "same-origin" });
  return res.json();
}
```

- [ ] **Step 3: Port minimal CN tool UI**

Must support: prompt → generate → highlight test → flags → editable pattern → refine presets → local history → pricing CTA when not Pro / quota exhausted.  
**Skip:** Forge email auth modal, Paddle, cloud shares, EN locale.

Quota display: from generate/quota API responses (`remaining`, `limit`, `isPro`).

- [ ] **Step 4: Build + copy**

```bash
cd packages/forge-cn-app && pnpm build
# copy dist/* → ../../ststudio.top/app/static/works/forge-regex/
```

Document the copy command in `packages/forge-cn-app/README.md`.

- [ ] **Step 5: Commit** both repos as needed (`feat: add forge-cn-app SPA for ststudio embed`).

---

### Task 5: CN pay API (mirror little-fox)

**Files:**
- Create: `ststudio.top/app/routes/forge_regex_api.py`
- Create: `ststudio.top/app/services/forge_regex_pay.py` (order JSON files, like comics)
- Modify: `app/__init__.py` register blueprint `url_prefix="/api"`
- Modify: pricing template/JS to call create/status/mock-pay

**Interfaces:**
- `POST /api/forge-regex/pay/create` → `{ orderId, codeUrl?, mock? }` (login required)
- `GET /api/forge-regex/pay/status?orderId=`
- `POST /api/forge-regex/pay/mock-pay` (when `WECHAT_PAY_MOCK=1`)
- On paid: `grant_entitlement(user_id, PRODUCT_FORGE_REGEX, order_id)`

Price: **¥9.9 = 990 fen** (align current CN Forge pricing).

- [ ] **Step 1: Implement create/status/mock** copying structure from `comics_api.py` / `comics.py` order files, product id `forge-regex-pro`.

- [ ] **Step 2: Wire pricing page buttons** (login gate → create → poll status → reload).

- [ ] **Step 3: Manual test with mock pay** → `products.forgeRegexPro` true.

- [ ] **Step 4: Commit (ststudio.top)**

```bash
git commit -m "feat: forge-regex-pro WeChat mock pay on works pricing"
```

---

### Task 6: Generate/quota proxy with ststudio identity

**Files:**
- Modify: `forge_regex_api.py` — `POST /api/forge-regex/generate`, `GET /api/forge-regex/quota`
- Modify: forge-regex `src/app/api/generate/route.ts` (and quota) to accept **internal** CN identity headers when `FORGE_CN_PROXY_SECRET` matches
- Env: ststudio `FORGE_GENERATE_ORIGIN`, `FORGE_CN_PROXY_SECRET`; forge `FORGE_CN_PROXY_SECRET`

**Interfaces:**
- Browser → Flask `/api/forge-regex/generate` (cookies for `st_session`)
- Flask verifies user/guest, forwards to `{FORGE_GENERATE_ORIGIN}/api/generate` with body + headers:
  - `X-Forge-Proxy-Secret: <shared>`
  - `X-Forge-Cn-User-Id: <id or empty>`
  - `X-Forge-Cn-Pro: 0|1`
  - `X-Forge-Fp: <fingerprint>`
  - `X-Forge-Edition: cn` (legacy) or dedicated CN quota keys in Forge DB: `studiouser:<id>` / fp

**Quota keying on Forge side (CN proxy mode):**

- If `X-Forge-Cn-Pro: 1` → unlimited (skip increment)
- Else if user id present → count like free email but key `stu:<userId>` (new table or reuse email table with synthetic key — prefer **new** `cn_user_usage(user_key, day, count)` to avoid colliding with real emails)
- Else → guest fp limits (2/day)

- [ ] **Step 1: Add `cn_user_usage` table + helpers in forge-regex `quota.ts`**

- [ ] **Step 2: In generate route, if proxy secret valid, branch quota to CN keys; set `locale` default `zh`; skip Forge session auth**

- [ ] **Step 3: Flask proxy** reads `current_user()`, `has_entitlement`, forwards body (`prompt`, `refine`, `fp`, `locale: "zh"`).

- [ ] **Step 4: Integration test**

Logged-out: 2 generates then 401/login_required.  
Logged-in free: 8/day.  
After mock Pro: unlimited.

- [ ] **Step 5: Commit** both repos.

---

### Task 7: EN `/cn` decommission + redirects

**Files:**
- Modify: `forge-regex/src/middleware.ts` (or `next.config.ts` redirects)
- Modify: `src/app/sitemap.ts` — drop `/cn` URLs
- Update CN marketing links under `content/cn-marketing/` to `https://www.ststudio.top/works/forge-regex` (batch replace)
- Optional: delete or gut `src/app/cn/**` after redirects proven

Redirect map:

```ts
{ source: "/cn", destination: "https://www.ststudio.top/works/forge-regex", permanent: true },
{ source: "/cn/:path*", destination: "https://www.ststudio.top/works/forge-regex", permanent: true },
// Prefer specific:
{ source: "/cn/pricing", destination: "https://www.ststudio.top/works/forge-regex/pricing", permanent: true },
```

- [ ] **Step 1: Add redirects, deploy EN**

- [ ] **Step 2: Verify** `curl -I https://regex.ststudio.top/cn` → 301 Location works URL

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: 301 /cn to ststudio works/forge-regex"
```

---

### Task 8: End-to-end checklist + sync README

**Files:**
- Create: `forge-regex/docs/superpowers/cn-sync-checklist.md`
- Update: `ststudio.top/docs/forge-regex-cn-embed.md` with build/proxy env vars

- [ ] **Step 1: Write release checklist**

```markdown
# CN sync checklist (every EN core change)
- [ ] forge-core tests green
- [ ] EN app uses new core
- [ ] pnpm --filter forge-cn-app build && copy to ststudio static
- [ ] Smoke www /works/forge-regex: generate, refine, history, pay gate
```

- [ ] **Step 2: Run full smoke on staging/local**

- [ ] **Step 3: Commit docs**

---

## Out of scope (do not implement in this plan)

- SSO / account merge
- CN cloud shares / history sync
- Full `/patterns` port on www
- Python reimplementation of DeepSeek generate
- Removing EN Paddle or Forge auth

## Spec coverage

| Spec item | Task |
|-----------|------|
| forge-core shared logic | 1 |
| ststudio entitlement | 2, 5 |
| `/works/forge-regex` shell + catalog | 3 |
| Shared client UI CN | 4 |
| CN pay | 5 |
| Generate via main-site API | 6 |
| `/cn` 301 + EN-only host | 7 |
| Sync discipline | 8 |
| Separate accounts | Global + Tasks 2/5/6 |
