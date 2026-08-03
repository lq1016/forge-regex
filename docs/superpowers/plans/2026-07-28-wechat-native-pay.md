# CN Edition (`/cn`) + WeChat / Alipay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Chinese product at `/cn` with ¥9/30-day WeChat + Alipay checkout; keep global `/` English + Paddle.

**Architecture:** Parallel App Router tree `src/app/cn/*`; shared generate/auth APIs; `cn_orders` + `current_period_end`; WeChat Native first, Alipay second on same `/cn/pricing`.

**Tech Stack:** Next.js App Router, SQLite, WeChat APIv3, Alipay OpenAPI (later), existing Pro/auth.

**Spec:** `docs/superpowers/specs/2026-07-28-wechat-native-pay-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `src/app/cn/page.tsx` | Chinese home (reuse logic from `/`) |
| `src/app/cn/pricing/page.tsx` + client | ¥9 + WeChat/Alipay CTAs |
| `src/lib/copy-zh.ts` or i18n | Chinese strings |
| `src/lib/db.ts` / `cn-orders.ts` / `pro.ts` | Orders + 30-day Pro |
| `src/lib/wechat-pay.ts` | Native APIv3 |
| `src/lib/alipay.ts` | Alipay client (phase 1.5) |
| `src/app/api/pay/**` | methods + wechat + alipay routes |
| `src/components/WeChatPayButton.tsx` | QR flow |
| `src/components/AlipayPayButton.tsx` | Alipay flow |
| Global header / footer | Link 中文版 ↔ English |

---

### Task 1: Full `/cn` edition + Chinese copy + nav links

- [ ] Add `src/app/cn/page.tsx` — full Chinese home (generate/test/replace/export/share entry; same APIs).
- [ ] Add `src/app/cn/pricing/…`, `src/app/cn/shares/…` (and auth next=/cn as needed).
- [ ] Global header:「中文版」→ `/cn`; CN header:「English」→ `/`.
- [ ] Confirm `/cn` loads on local end-to-end for core generate loop.

### Task 2: Schema + timed Pro (`current_period_end`, `cn_orders`)

- [ ] As in prior WeChat plan; amount default **900 fen**.

### Task 3: WeChat Native client + APIs + mock

- [ ] `WECHAT_*` + `CN_PRICE_CNY=9`; create/notify/status; mock-pay.

### Task 4: Wire WeChat on `/cn/pricing` only

- [ ] Do **not** add WeChat to global `/pricing`.
- [ ] Show ¥9 / 30 天; QR modal; poll.

### Task 5: Alipay client + APIs + button on `/cn/pricing`

- [ ] Parallel to WeChat; channel `alipay`; same +30d helper.

### Task 6: Env docs + deploy with empty CN keys

- [ ] `.env.example`; production: `/cn` live, buttons 即将开通 until credentials.

---

## Acceptance

- [ ] `https://…/cn` Chinese edition  
- [ ] `https://…/` English + Paddle only  
- [ ] CN pay **¥9 → +30 days** via WeChat (mock then real)  
- [ ] Alipay button path ready (mock or real)  
- [ ] Missing credentials → 即将开通  
