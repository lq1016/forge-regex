# CN sync checklist (every EN core change)

After changing shared regex / refine / history behavior:

- [ ] `pnpm --filter @forge-regex/core` consumers: `npm run check:regex-tester` / `check:regex-valid` / `check:refine-history`
- [ ] EN app still imports from `@forge-regex/core` (or shims)
- [ ] `pnpm --filter @forge-regex/cn-app build` (copies into `ststudio.top/app/static/works/forge-regex/`)
- [ ] Commit built static assets in **ststudio.top** when shipping CN UI
- [ ] Smoke `www` `/works/forge-regex`: generate, refine, flags, editable pattern, local history, login gate, pricing mock pay
- [ ] Confirm `regex.ststudio.top/cn` → 301 works URL

## Env (prod)

**ststudio.top**

- `FORGE_GENERATE_ORIGIN` — internal Forge Node base (e.g. `http://127.0.0.1:3000`)
- `FORGE_CN_PROXY_SECRET` — shared secret (must match Forge)
- `WECHAT_PAY_MOCK=1` for staging mock unlock

**forge-regex (Node)**

- `FORGE_CN_PROXY_SECRET` — same value
- `DEEPSEEK_API_KEY` — generate still runs here
