"use client";

import FingerprintJS from "@fingerprintjs/fingerprintjs";

const CACHE_KEY = "forge_fp_v1";

let cached: string | null = null;
let inflight: Promise<string> | null = null;

/**
 * Stable-ish browser visitor id (FingerprintJS open source).
 * Survives most private/incognito sessions on the same browser+device;
 * clearing site data alone usually does not mint a fresh id.
 */
export async function getDeviceFingerprint(): Promise<string> {
  if (cached) return cached;
  if (typeof window === "undefined") return "";

  try {
    const fromStore = window.localStorage.getItem(CACHE_KEY);
    if (fromStore && fromStore.length >= 8) {
      cached = fromStore;
      return fromStore;
    }
  } catch {
    // private mode / blocked storage
  }

  if (!inflight) {
    inflight = (async () => {
      const agent = await FingerprintJS.load();
      const result = await agent.get();
      const id = result.visitorId || "";
      cached = id;
      try {
        if (id) window.localStorage.setItem(CACHE_KEY, id);
      } catch {
        // ignore
      }
      return id;
    })().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}
