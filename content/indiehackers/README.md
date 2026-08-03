# Indie Hackers content pipeline

**Cadence:** every **3 days** (auto on home server)  
**Window:** 北京约 **22:00–23:15**（UTC 14:30 + jitter）  
**Report email:** `34310374@qq.com`

## Auto-publish (server)

Home server cron reads `calendar.md`, publishes the next **ready** draft when ≥3 days since the last live post, emails you the URL, and marks the row **published**.

```bash
# on server
bash scripts/ih-install-cron.sh
IH_SKIP_JITTER=1 node scripts/ih-publish-queue.mjs --dry-run
```

Safety: max 1 post/run · `IH_POST_MIN_GAP_DAYS=3` · honeypot field never filled · auto-reseed auth.

## Manual remind (optional)

```bash
pnpm ih:remind:dry
pnpm ih:remind -- --date 2026-07-28
```

## Daily comments (server cron)

| Command | Purpose |
|---------|---------|
| `node scripts/ih-daily-comment.mjs --dry-run` | Draft 2 comments, do not submit |
| `node scripts/ih-daily-comment.mjs` | Headless submit + email |
| `bash scripts/ih-install-cron.sh` | Install comment + post crons |

Comments: 22:00 北京 + jitter, 2/day. Posts: 22:30 北京 + jitter, every ≥3 days when queue has `ready`.  
Notify: **every hour** at :15 — emails new replies / follows / mentions to `34310374@qq.com` (`scripts/ih-notify-poll.mjs`).

Auth: `data/ih-auth/`. Logs: `data/ih-comments/`.

## Skip rule

If there’s nothing true to say that cycle, mark the draft skipped in `calendar.md` — empty promo posts hurt more than silence.
