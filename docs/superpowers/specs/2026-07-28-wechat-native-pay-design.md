# Forge Regex — CN Edition (`/cn`) + WeChat / Alipay Design

**Date:** 2026-07-28  
**Status:** Approved (revised)  
**Supersedes:** earlier draft that put WeChat on global `/pricing` at ¥68.

## Goals

1. **China edition** under route prefix **`/cn`** — e.g. [https://regex.ststudio.top/cn](https://regex.ststudio.top/cn) (and `/cn/pricing`, etc.).
2. CN edition UI **Chinese**; payments **微信 + 支付宝**, **¥9 / 月**（付一笔按 **31 天**计，可叠加）.
3. **Global edition** stays at `/` — English + **Paddle $9/mo** only (no WeChat/Alipay on global pricing).
4. Credential-gated: missing WeChat/Alipay env → CN pricing shows「即将开通」.

## Non-goals (this phase)

- Geo-IP auto-redirect (users choose `/` vs `/cn` via link; optional later)
- Auto-renew / 微信代扣 / 支付宝周期扣款
- Invoicing (发票)
- H5/JSAPI first (PC **Native QR** first; mobile polish later)

## Site split

| | Global `/` | CN `/cn` |
|--|------------|----------|
| Language | English | 中文 |
| Pay | Paddle $9/mo | 微信 / 支付宝 **¥9 / 月**（+31 天） |
| App | Existing home + pricing | Same product flows under `/cn/*` |

### Routing approach (locked: full CN edition)

- App Router segment: `src/app/cn/...` mirrors the **full product**, not pricing-only:
  - `/cn` — Chinese home (generate / test / replace / export / share entry)
  - `/cn/pricing` — ¥9 + WeChat / Alipay
  - `/cn/shares`, `/cn/auth/verify` (or shared verify with `?next=/cn`) as needed
  - Legal pages optional under `/cn/*` or link to global with CN note
- Reuse APIs under `/api/*` (no duplicate backends); pass locale where copy matters.
- Shared components; Chinese strings via `copy-zh.ts` / locale helper.
- Header on `/` links「中文版」→ `/cn`; on `/cn` links「English」→ `/`.

## Product — CN pricing

| Method | Processor | Price | Entitlement |
|--------|-----------|-------|-------------|
| 微信支付 | Official Native APIv3 | **¥9** | +31 days Pro |
| 支付宝 | Official (当面付/电脑网站支付 — TBD by merchant product) | **¥9** | +31 days Pro |

- Require **email** before creating order (Pro bound to email; magic-link login).
- Stacking: `current_period_end = max(now, existing) + 31 days` (`CN_PRO_MONTH_DAYS`).
- `customer_id` e.g. `cn:{email}` (channel-agnostic CN entitlement).

Global Paddle users unchanged (`current_period_end` null → status-only).

## WeChat technical flow (phase 1 implement)

Same as approved Native flow:

```text
/cn/pricing → email → POST /api/pay/wechat/create
  → code_url QR → notify → extend Pro +31d → poll status
```

Amount: `900` fen (`CN_PRICE_CNY=9`).

## Alipay (phase 1.5 — same CN page)

- UI: second button「支付宝」on `/cn/pricing`.
- APIs: `/api/pay/alipay/create|notify|status` (parallel to WeChat).
- `cn_orders.channel` = `wechat` | `alipay`.
- Exact Alipay product (电脑网站支付 vs 当面付扫码) chosen when merchant account is ready; UI still QR-or-redirect.

## API

| Method | Path | Role |
|--------|------|------|
| GET | `/api/pay/methods` | `{ wechat, alipay, paddle }` |
| POST | `/api/pay/wechat/create` | `{ email }` → `{ orderId, codeUrl }` |
| POST | `/api/pay/wechat/notify` | WeChat callback |
| GET | `/api/pay/wechat/status` | Poll |
| POST | `/api/pay/alipay/create` | `{ email }` → pay URL / QR payload |
| POST | `/api/pay/alipay/notify` | Alipay callback |
| GET | `/api/pay/alipay/status` | Poll |

## Data

```sql
CREATE TABLE IF NOT EXISTS cn_orders (
  out_trade_no TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  channel TEXT NOT NULL,          -- wechat | alipay
  total_fee_fen INTEGER NOT NULL, -- 900 for ¥9
  status TEXT NOT NULL,           -- pending | paid | failed
  code_url TEXT,
  transaction_id TEXT,
  created_at TEXT NOT NULL,
  paid_at TEXT
);

-- subscriptions.current_period_end TEXT NULL
```

## Config

```text
# Shared CN price
CN_PRICE_CNY=9
NEXT_PUBLIC_CN_PRICE_CNY=9

# WeChat Native
WECHAT_APPID=
WECHAT_MCHID=
WECHAT_API_V3_KEY=
WECHAT_MCH_SERIAL_NO=
WECHAT_MCH_PRIVATE_KEY=
WECHAT_MCH_PRIVATE_KEY_PATH=
WECHAT_PLATFORM_CERT_PATH=
WECHAT_NOTIFY_URL=https://regex.ststudio.top/api/pay/wechat/notify
WECHAT_PAY_MOCK=0

# Alipay (fill when ready)
ALIPAY_APP_ID=
ALIPAY_PRIVATE_KEY=
ALIPAY_PUBLIC_KEY=
ALIPAY_NOTIFY_URL=https://regex.ststudio.top/api/pay/alipay/notify
ALIPAY_PAY_MOCK=0

NEXT_PUBLIC_APP_URL=https://regex.ststudio.top
```

## Rollout order

1. `/cn` shell + Chinese copy + link from global header  
2. Schema + period-end Pro  
3. WeChat Native + mock + `/cn/pricing`  
4. Alipay create/notify/status + second button  
5. Real merchant credentials  

## References

- [WeChat Native 快速开始](https://pay.weixin.qq.com/doc/v3/merchant/4015614538)  
- [Native 下单](https://pay.weixin.qq.com/doc/v3/merchant/4012791877)  
- [支付回调](https://pay.weixin.qq.com/doc/v3/merchant/4012791882)  
