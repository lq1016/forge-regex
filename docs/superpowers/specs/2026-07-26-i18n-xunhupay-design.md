# Forge Regex — i18n + Triple Checkout Design

**Date:** 2026-07-26  
**Status:** Approved

## Goals

1. **UI bilingual:** Chinese / English toggle only affects copy. Does not force a payment method.
2. **Three payment methods on pricing:** Paddle (existing MoR), WeChat Pay, Alipay.
3. **CN rails via aggregator:** 虎皮椒 (Xunhuupay) for WeChat + Alipay; activate the same Pro entitlement as Paddle.

## Non-goals

- Geo-IP language/payment forcing
- Deep Chinese tax invoicing
- Second aggregator (易支付) in v1 — only a provider interface so it can be added later

## i18n

- Client locale: `en` | `zh`, stored in `localStorage` + cookie `forge-locale`
- Default: browser `Accept-Language` / `navigator.language` (zh* → zh, else en)
- Toggle in header: `中文 | EN`
- String dictionary module (`src/lib/i18n/messages.ts` + `LocaleProvider`)
- Pages: home, pricing, auth modal/verify, footer, terms/privacy/refund (full or substantial)
- Generate API: optional `locale` on request; if `zh`, system prompt may allow Chinese explanations

## Payments

### Shared Pro model

- Pro = `subscriptions.status = active` keyed by email (existing SQLite)
- Session magic-link still required for cross-browser Pro
- CN checkout requires email before creating an order (bind Pro to that email)

### Pricing page UI

Three equal CTAs (order configurable):

| Method | Processor | Price (config) |
|--------|-----------|----------------|
| Card / international | Paddle | `NEXT_PUBLIC_PADDLE_PRICE` display + existing price id |
| 微信支付 | Xunhuupay WeChat appid | `CN_PRICE_CNY` (default 68) |
| 支付宝 | Xunhuupay Alipay appid | same CNY |

Language does not hide any method.

### Xunhuupay flow

1. User enters/confirms email → chooses WeChat or Alipay
2. `POST /api/pay/xunhu/create` creates row in `cn_orders`, calls 虎皮椒 `payment/do.html`
3. Response: show `url_qrcode` (desktop) and/or redirect `url` (mobile)
4. `POST /api/pay/xunhu/notify` verifies hash; on `status=OD` marks order paid + `upsertSubscription({ email, status: active, … })`
5. Client polls `GET /api/pay/xunhu/status?orderId=` or lands on `return_url` → activate session / Pro cookie

### Env

```
XUNHUPAY_WECHAT_APPID=
XUNHUPAY_WECHAT_APPSECRET=
XUNHUPAY_ALIPAY_APPID=
XUNHUPAY_ALIPAY_APPSECRET=
XUNHUPAY_GATEWAY=https://api.xunhupay.com/payment/do.html
CN_PRICE_CNY=68
NEXT_PUBLIC_APP_URL=https://regex.ststudio.top
```

Paddle vars unchanged. If CN env missing, WeChat/Alipay buttons show “即将开通” disabled state.

### DB

```sql
CREATE TABLE cn_orders (
  trade_order_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  channel TEXT NOT NULL, -- wechat | alipay
  total_fee TEXT NOT NULL,
  status TEXT NOT NULL, -- pending | paid | failed
  transaction_id TEXT,
  created_at TEXT NOT NULL,
  paid_at TEXT
);
```

## Security

- Verify notify hash with channel secret; respond plain `success`
- Do not trust client “I paid” without DB paid flag
- Rate-limit create endpoint lightly

## Rollout

1. Ship i18n + pricing UI with three buttons
2. Wire Xunhuupay when credentials present
3. Keep Paddle path untouched for existing Pro users
