/**
 * Shared proxy helpers for IH Playwright scripts (home server mihomo).
 *
 * Env (first match wins):
 *   IH_PROXY | HTTPS_PROXY | HTTP_PROXY | ALL_PROXY
 * Default when unset: null (no proxy). Cron install sets these explicitly.
 */

export function resolveProxy() {
  const raw = (
    process.env.IH_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.ALL_PROXY ||
    ""
  ).trim();
  return raw || null;
}

/** Ensure Node fetch / undici also use the proxy. */
export function applyProxyEnv() {
  const server = resolveProxy();
  if (!server) return null;
  for (const k of [
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "http_proxy",
    "https_proxy",
    "all_proxy",
  ]) {
    if (!process.env[k]) process.env[k] = server;
  }
  if (!process.env.NO_PROXY && !process.env.no_proxy) {
    process.env.NO_PROXY = "localhost,127.0.0.1,::1";
    process.env.no_proxy = process.env.NO_PROXY;
  }
  return server;
}

/** Playwright launch option fragment. */
export function playwrightProxyOption() {
  const server = resolveProxy();
  return server ? { server } : undefined;
}
