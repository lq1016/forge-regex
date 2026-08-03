# Day 4 — Self-hosting Next.js

**Status:** ready  
**Group:** Tech  
**Post window:** America/New_York 8:00–10:00 AM  
**Calendar date:** 2026-07-31

## Title

```text
Self-hosting a Next.js SaaS on a home server with PM2 – what actually bit me
```

## Body

```text
Hey IH —

Forge Regex (https://regex.ststudio.top) runs on my home server: Next.js + PM2 + SQLite.

Why self-host early: cost control, full control of SQLite files, and I already had a box on the LAN.

## What works fine
- `pnpm build` + `pm2 restart`
- rsync deploy of `src/` (careful with `--delete`)
- SQLite for auth sessions, quotas, subscriptions, shares

## What bit me
1. Orphan `next-server` holding :3000 after a bad restart → EADDRINUSE. Fix: stop PM2, `fuser -k 3000/tcp`, restart.
2. Broad `rsync --delete` once wiped `ecosystem.config.cjs` while PM2 still “remembered” the process.
3. Mixing server-only `.env.production` with local secrets — never sync env blindly.

## Tradeoff
Self-host is great until DNS / power / upload bandwidth becomes the product problem. I’m accepting that while validating demand.

## Ask
At what MRR (or pain level) would you move this off a home server to a VPS / PaaS?
```
