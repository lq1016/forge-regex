# Export / Replace / Share — Design

**Date:** 2026-07-27  
**Status:** Approved (UI mockup + scheme 1)

## Goals

1. **Replace** — free: replacement string + live preview + copy
2. **Export** — free: JS / Python / Go / Java / .NET snippets + copy
3. **Share** — Pro only to create ` /r/{id} `; anyone can view; payload = prompt, pattern, flags, explanation, testText

## Non-goals (v1)

- Full favorites sidebar
- Multi-engine execution (snippets are syntax only; runtime stays JS)
- Anonymous share creation

## Data

SQLite `shares`:

| column | type |
|--------|------|
| id | TEXT PK (8–10 char url-safe) |
| email | TEXT NOT NULL |
| prompt | TEXT |
| pattern | TEXT NOT NULL |
| flags | TEXT |
| explanation_json | TEXT |
| test_text | TEXT |
| created_at | TEXT |

## API

- `POST /api/shares` — Pro session required; body = share payload; returns `{ id, url }`
- `GET /api/shares` — list current user’s shares
- `GET /api/shares/[id]` — public
- `DELETE /api/shares/[id]` — owner only

## UI

Homepage result stack: Regex (+ Share) → Test → Replace (fold) → Export (fold).  
`/r/[id]` read-only + Open in Forge.  
`/shares` My shares list for Pro.
