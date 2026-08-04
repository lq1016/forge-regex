# Forge Regex CN real pay — Implementation Plan

> **For Claude:** Implement task-by-task; deploy to home server when done.

**Goal:** Replace mock unlock with WeChat Native + Alipay page.pay on `www.ststudio.top`.

**Architecture:** Port Forge’s pay crypto into Flask services; orders stay in `forge_regex_orders/`; notify grants `forge-regex-pro`.

**Tech Stack:** Flask, cryptography / stdlib openssl, existing ststudio auth entitlements.

---

### Task 1: `app/services/wechat_pay.py` + `alipay_pay.py`
Port create native / decrypt notify / page.pay sign+verify from forge-regex TS.

### Task 2: Extend `forge_regex_pay.py`
- Order fields: `channel`, `transactionId`
- `create_order(user_id, channel)` calls real prepay when mock off
- `mark_paid` idempotent

### Task 3: `forge_regex_api.py` routes
create(channel), status(+optional wechat query), wechat/alipay notify, alipay return; gate mock-pay.

### Task 4: Pricing template
Channel buttons, QR, Alipay form submit; no auto mock-pay unless `mock:true`.

### Task 5: Server env + deploy
Copy WECHAT_/ALIPAY_ into `/opt/ststudio/app/forge-regex.env`, MOCK=0, restart, smoke create (no grant without pay).
