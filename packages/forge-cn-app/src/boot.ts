export type ForgeCnBoot = {
  authenticated: boolean;
  hasPro: boolean;
  loginUrl: string;
  pricingUrl: string;
  apiBase: string;
};

declare global {
  interface Window {
    __FORGE_CN__?: Partial<ForgeCnBoot>;
  }
}

export function getBoot(): ForgeCnBoot {
  const b = window.__FORGE_CN__ || {};
  return {
    authenticated: Boolean(b.authenticated),
    hasPro: Boolean(b.hasPro),
    loginUrl: b.loginUrl || "/user?next=/works/forge-regex",
    pricingUrl: b.pricingUrl || "/works/forge-regex/pricing",
    apiBase: b.apiBase || "/api/forge-regex",
  };
}
