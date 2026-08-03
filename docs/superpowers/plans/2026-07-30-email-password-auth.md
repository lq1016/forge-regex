# Email+Password Auth Implementation Plan

> **For agentic workers:** Implement task-by-task. Checkboxes track progress.

**Goal:** Replace magic-link auth with email + password + email verification codes.

**Architecture:** SQLite `users` + `auth_codes`; scrypt password hashes; keep `forge-session` JWT. AuthButton becomes login/register/forgot with code step.

**Tech Stack:** Next.js App Router, node:crypto scrypt, existing Resend `sendEmail`, SQLite.

---

### Task 1: Schema + auth helpers
- [ ] Add `users` / `auth_codes` to `db.ts`
- [ ] Rewrite `auth.ts`: password hash/verify, create/consume codes, user CRUD; remove magic tokens

### Task 2: API routes
- [ ] `register`, `verify-register`, `login`, `forgot`, `reset`
- [ ] Remove/disable `request` + token `verify`; simplify `/auth/verify` page

### Task 3: AuthButton UI + i18n
- [ ] Login / Register / Forgot / code steps
- [ ] EN + ZH copy

### Task 4: Verify + deploy
- [ ] `tsc`, build, deploy, smoke register/login in log mode
