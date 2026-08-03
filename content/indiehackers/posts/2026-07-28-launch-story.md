# Day 1 — Launch story

**Status:** published  
**Group:** Building  
**Post window:** America/New_York 8:00–10:00 AM  
**Calendar date:** 2026-07-28  
**URL:** https://www.indiehackers.com/post/i-built-an-ai-regex-tool-for-overseas-users-here-s-the-stack-and-what-s-working-so-far-17be6669e0

## Title

```text
I built an AI regex tool for overseas users – here’s the stack and what’s working so far
```

## Body

```text
Hey IH 👋

I built Forge Regex: describe a pattern in plain English → get a working regex, with live testing, explanations, replace preview, and code export.

🔗 https://regex.ststudio.top

## Why I built it
I was tired of the “ChatGPT writes regex → paste into regex101 → tweak → repeat” loop. I wanted one place that both generates and lets you verify.

## What’s live
- NL → JS-compatible regex (DeepSeek)
- Live match highlighting + short explanations
- Replace preview
- Export to JS / Python / Go / Java / .NET
- Free: 5 gens/day
- Pro: $9/mo via Paddle (MoR) – unlimited + share links
- Email magic-link login to keep Pro across devices

## Stack
Next.js, DeepSeek, Paddle Billing, SQLite, Resend, self-hosted

## What’s hard / what I learned
1. Payment for a China-based indie: Stripe / Lemon Squeezy were painful; Paddle worked better as MoR.
2. Checkout price bugs are easy: UI said $9 while Price ID still pointed at a $1 test price. Always verify the live Price ID.
3. “Paid but plan not showing” needs email login + webhook sync, not only a browser cookie.
4. Shipping CN WeChat/Alipay early was a distraction – I’m focusing on overseas customers first.

## Where I need feedback
- Is $9/mo reasonable vs free 5/day?
- What’s the #1 feature you’d need before paying?
- Any dealbreakers vs regex101 + ChatGPT?

Thanks – happy to share more on Paddle, quota design, or SEO.
```
