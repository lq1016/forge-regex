# Forge Regex CN real pay (ststudio) — Design

**Date:** 2026-08-04  
**Status:** Approved  
**Approach:** A — Flask 内官方微信 Native + 支付宝 page.pay  
**Depends on:** `2026-08-03-cn-embed-ststudio-design.md`

## Goals

1. CN Pro（`forge-regex-pro`，¥9.9）走**真收款**，不再一点即开。
2. 支持 **微信扫码** 与 **支付宝网页支付**。
3. 复用 Forge EN 已开通的微信商户 + 支付宝应用密钥。
4. 异步通知落在 **`https://www.ststudio.top`**。

## Non-goals

- 易支付 / 虎皮椒 / Paddle 用于 CN
- 与 EN Paddle 权益互通
- 修改 EN 站现有支付（notify 仍可保留原 URL；CN 订单用独立 notify）

## Flow

```text
定价页 → POST /api/forge-regex/pay/create { channel }
  wechat → code_url → 页内二维码 → poll status
  alipay → payFormHtml / 跳转收银台 → return → poll status
微信/支付宝 → POST …/pay/{wechat|alipay}/notify → mark paid → grant_entitlement
```

## APIs

| Method | Path | Notes |
|--------|------|--------|
| POST | `/api/forge-regex/pay/create` | `channel`: `wechat` \| `alipay`；金额服务端 990 分 |
| GET | `/api/forge-regex/pay/status?orderId=` | 已付则幂等授权益；微信可主动 query 兜底 |
| POST | `/api/forge-regex/pay/wechat/notify` | 解密 resource；`trade_state=SUCCESS` |
| POST | `/api/forge-regex/pay/alipay/notify` | RSA2 验签；`TRADE_SUCCESS` / `FINISHED` |
| GET | `/api/forge-regex/pay/alipay/return` | 回跳定价页；不开通（靠 notify/status） |
| POST | `/api/forge-regex/pay/mock-pay` | 仅 `*_PAY_MOCK=1` |

Notify URLs（写入下单请求）:

- `https://www.ststudio.top/api/forge-regex/pay/wechat/notify`
- `https://www.ststudio.top/api/forge-regex/pay/alipay/notify`

Return: `https://www.ststudio.top/works/forge-regex/pricing?orderId=…`

## Config (`forge-regex.env`)

复用 Forge 密钥路径（同机）+ 关掉 mock：

```bash
WECHAT_PAY_MOCK=0
ALIPAY_PAY_MOCK=0
WECHAT_APPID=…
WECHAT_MCHID=…
WECHAT_API_V3_KEY=…
WECHAT_MCH_SERIAL_NO=…
WECHAT_MCH_PRIVATE_KEY_PATH=/home/liuq/apps/forge-regex/secrets/apiclient_key.pem
WECHAT_NOTIFY_URL=https://www.ststudio.top/api/forge-regex/pay/wechat/notify
ALIPAY_APP_ID=…
ALIPAY_PRIVATE_KEY_PATH=…/alipay_private.pem
ALIPAY_PUBLIC_KEY_PATH=…/alipay_public.pem
ALIPAY_NOTIFY_URL=https://www.ststudio.top/api/forge-regex/pay/alipay/notify
```

## UI

定价页：微信 / 支付宝二选一；微信展示 QR；支付宝提交官方 form；无 mock 时禁止自动 `mock-pay`。

## Success

- Mock 关闭后无法一键开通
- 微信扫码、支付宝跳转均可授 `forge-regex-pro`
- 重复通知不重复加权益
