# 分站点 Pro 权益隔离

**日期：** 2026-07-30  
**状态：** 已上线  

## 规则

| 购买渠道 | 中文站 `/cn` | 英文站 `/` |
|---------|-------------|-----------|
| 微信 / 支付宝（`cn:email`） | Pro | 否 |
| Paddle（非 `cn:`） | 否 | Pro |

两边完全隔离（方案 1）。

## 实现要点

- `isPro(edition)` / 配额 / 分享 / `auth/me` 按 edition 过滤订阅行。
- edition 由请求 `Referer` 路径判定：`/cn…` → `cn`，否则 → `global`（防止伪造 header 蹭国内价）。
- 登录时只把 **global（Paddle）** 写入 `forge-pro` cookie；CN Pro 仅依赖 session + edition。
