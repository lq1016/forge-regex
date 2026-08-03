# forge-cn-app

Chinese Forge Regex SPA embedded at `https://www.ststudio.top/works/forge-regex`.

## Build & copy

From repo root:

```bash
pnpm install
pnpm --filter @forge-regex/cn-app build
```

Build writes Vite `dist/`, then `scripts/copy-to-ststudio.mjs` copies into:

`../ststudio.top/app/static/works/forge-regex/`

Stable asset names: `assets/index.js`, `assets/index.css` (referenced by Flask template).

## Dev

```bash
pnpm --filter @forge-regex/cn-app dev
```

Set `window.__FORGE_CN__` in the Vite HTML or proxy against a local Flask instance for auth/API.
