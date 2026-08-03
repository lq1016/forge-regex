# Day 9 — Model choice

**Status:** ready  
**Group:** Tech  
**Post window:** America/New_York 8:00–10:00 AM  
**Calendar date:** 2026-08-05

## Title

```text
Why Forge Regex uses DeepSeek for NL → regex (for now)
```

## Body

```text
Hey IH —

Forge Regex turns plain English into JS-compatible regex. Model today: DeepSeek.

## Why it fit my stage
- Cost for a freemium tool with 5 free gens/day
- Good enough structured output for patterns + short explanations
- I can swap providers later if quality or latency forces it

## Product constraints that matter more than the brand of model
- Output must run in JS `RegExp`
- Need a short explanation users can trust
- Prefer a sample test string with the result
- Cache identical prompts when possible (SQLite)

## What I’ll watch
- Broken patterns / catastrophic backtracking risk
- Users editing the pattern after generate (signal of quality gaps)
- Cost per paying user vs free users

## Ask
For codegen-ish tools, do you expose model choice to users early, or keep one default until complaints pile up?
```
