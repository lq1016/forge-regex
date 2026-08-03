export type StstudioMe = {
  authenticated: boolean;
  user: { id: number; email: string; displayName: string } | null;
  products?: { forgeRegexPro?: boolean; littleFoxCollection?: boolean };
};

export async function fetchMe(): Promise<StstudioMe> {
  const res = await fetch("/api/auth/me", { credentials: "same-origin" });
  if (!res.ok) {
    return { authenticated: false, user: null, products: {} };
  }
  return res.json();
}
