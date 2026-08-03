# Export / Replace / Share Implementation Plan

> **For agentic workers:** Implement task-by-task.

**Goal:** Ship Replace + Export (free) and Pro-only Share links with public `/r/[id]` and My shares.

**Architecture:** Client panels on homepage; shares persisted in SQLite; gated by existing session + Pro helpers.

**Tech Stack:** Next.js App Router, React client components, node:sqlite

---

### Task 1: DB + shares lib
- Schema `shares` in `db.ts`; `src/lib/shares.ts` CRUD + id generator

### Task 2: Share APIs
- `POST/GET /api/shares`, `GET/DELETE /api/shares/[id]`

### Task 3: Export snippets helper + ExportPanel / ReplacePanel / ShareButton
- Pure snippet builders; fold UI matching mockup

### Task 4: Wire homepage
- Pass prompt/result/testText; Pro gate for Share

### Task 5: `/r/[id]` + `/shares` pages
- Public view + Open in Forge; owner list/delete

### Task 6: Copy strings + deploy smoke
