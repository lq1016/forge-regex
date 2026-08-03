# Day 3 — Paddle as Merchant of Record

**Status:** ready  
**Group:** Building  
**Post window:** America/New_York 8:00–10:00 AM  
**Calendar date:** 2026-07-30

## Title

```text
China-based indie selling overseas: why I picked Paddle as Merchant of Record
```

## Body

```text
Hey IH —

I’m building Forge Regex (https://regex.ststudio.top) from China, selling a $9/mo Pro plan to overseas developers.

## The constraint
I needed card + PayPal (and local methods by region) without becoming a tax/compliance expert on day one. Stripe / Lemon Squeezy paths were painful for my setup. Paddle-as-MoR was the path that actually let me ship checkout.

## What I implemented
- Paddle.js overlay checkout from the pricing page
- Webhook → activate subscription in SQLite
- Client “activate” call after checkout for faster UX
- Magic-link email login so Pro isn’t stuck to one browser cookie

## Footguns I hit
1. UI said $9 while env still pointed at a $1 test Price ID.
2. “I paid but I’m not Pro” = webhook lag + cookie-only entitlement. Email session fixed it.
3. MoR means your refund / tax copy must match Paddle’s role — I updated Terms / Refund pages accordingly.

## Ask
If you’re a non-US indie selling globally: did you stay on MoR (Paddle/LS) or fight for Stripe? What broke first for you?
```
