const FP_KEY = "forge-cn-fp-v1";

/** Stable guest fingerprint for CN quota (localStorage). */
export function getCnFingerprint(): string {
  try {
    const existing = localStorage.getItem(FP_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,128}$/.test(existing)) return existing;
    const next = `cn_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 12)}`;
    localStorage.setItem(FP_KEY, next);
    return next;
  } catch {
    return `cn_tmp_${Math.random().toString(36).slice(2, 14)}`;
  }
}
