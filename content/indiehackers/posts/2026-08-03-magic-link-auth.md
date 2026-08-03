# Day 7 — Magic-link auth

**Status:** ready  
**Group:** Building  
**Post window:** America/New_York 8:00–10:00 AM  
**Calendar date:** 2026-08-03

## Title

```text
No passwords: magic-link login for a $9 Pro indie SaaS
```

## Body

```text
Hey IH —

For Forge Regex Pro I skipped passwords entirely: email magic links via Resend.

Flow:
1. User enters email
2. Server stores a short-lived token
3. Email link → `/auth/verify` → session cookie
4. Pro entitlement keyed to email (Paddle webhook + activate)

## Why
- Password reset support is unpaid work
- Buyers already type an email at checkout
- Cross-device Pro needs identity, not “hope the cookie survives”

## Lessons
- From-address / domain auth matters; invalid API keys fail silently from the user’s POV
- Link expiry (15 min) needs clear UI copy
- Don’t rely on checkout cookie alone — login is the source of truth

## Ask
For a tiny B2C/dev tool, is magic link enough, or do people still demand Google OAuth on day one?
```
