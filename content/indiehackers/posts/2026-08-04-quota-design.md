# Day 8 — Quota design

**Status:** ready  
**Group:** Building  
**Post window:** America/New_York 8:00–10:00 AM  
**Calendar date:** 2026-08-04

## Title

```text
Designing a 5/day free quota without making the product feel broken
```

## Body

```text
Hey IH —

Forge Regex free tier is 5 AI generations per day. Everything after “generate” (test, replace, export) is unlimited.

## Goals
1. Let someone solve a real regex task without signing up
2. Stop unbounded LLM cost
3. Make Pro feel like relief, not ransom

## Rules I chose
- Count generations, not page views
- Reset daily (simple mental model)
- Show remaining count in the UI
- Don’t blank out testing when quota hits zero — only block new generates

## Open questions
- Per-IP vs account: anonymous free is friendlier and easier to abuse
- Soft cap vs hard cap messaging
- Should failed generations refund a credit?

## Ask
What free quota have you seen convert best for AI wrappers — daily caps, monthly caps, or watermarked output?
```
