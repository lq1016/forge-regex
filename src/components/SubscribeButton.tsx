"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";

const PADDLE_SCRIPT = "https://cdn.paddle.com/paddle/v2/paddle.js";

type PaddleCheckoutEvent = {
  name?: string;
  data?: {
    transaction_id?: string;
    transactionId?: string;
    id?: string;
  };
};

type PaddleInstance = {
  Checkout: {
    open: (opts: {
      items: { priceId: string; quantity: number }[];
      settings?: {
        successUrl?: string;
        theme?: string;
        locale?: string;
      };
    }) => void;
  };
  Initialize: (opts: {
    token: string;
    eventCallback?: (event: PaddleCheckoutEvent) => void;
    checkout?: {
      settings?: {
        theme?: string;
        locale?: string;
      };
    };
  }) => void;
};

declare global {
  interface Window {
    Paddle?: PaddleInstance;
    __forgePaddleReady?: boolean;
  }
}

function loadPaddleScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Paddle) return Promise.resolve();

  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${PADDLE_SCRIPT}"]`
  );

  if (existing) {
    return new Promise((resolve, reject) => {
      const done = () => {
        if (window.Paddle) {
          resolve();
          return true;
        }
        return false;
      };
      if (done()) return;

      const onLoad = () => {
        if (!done()) reject(new Error("Paddle.js loaded but unavailable"));
      };
      existing.addEventListener("load", onLoad);
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Paddle.js"))
      );

      // Script may already be loaded (load event already fired)
      let tries = 0;
      const poll = window.setInterval(() => {
        tries += 1;
        if (done() || tries > 100) {
          window.clearInterval(poll);
          existing.removeEventListener("load", onLoad);
          if (!window.Paddle) {
            reject(new Error("Timed out waiting for Paddle.js"));
          }
        }
      }, 50);
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PADDLE_SCRIPT;
    script.async = true;
    script.onload = () => {
      if (window.Paddle) resolve();
      else reject(new Error("Paddle.js loaded but unavailable"));
    };
    script.onerror = () => reject(new Error("Failed to load Paddle.js"));
    document.head.appendChild(script);
  });
}

async function activatePro(transactionId: string): Promise<void> {
  const res = await fetch("/api/paddle/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transactionId }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Could not activate Pro");
  }
}

function initPaddle(token: string): void {
  if (!window.Paddle) throw new Error("Paddle.js unavailable");
  if (window.__forgePaddleReady) return;

  window.Paddle.Initialize({
    token,
    checkout: {
      settings: {
        theme: "light",
        locale: "en",
      },
    },
    eventCallback: async (event) => {
      if (
        event.name !== "checkout.completed" &&
        event.name !== "checkout.completed.warning"
      ) {
        return;
      }
      const transactionId =
        event.data?.transaction_id ||
        event.data?.transactionId ||
        (event.data?.id?.startsWith("txn_") ? event.data.id : undefined);
      if (!transactionId?.startsWith("txn_")) return;
      try {
        await activatePro(transactionId);
        window.location.href = `/?upgraded=1&txn=${encodeURIComponent(transactionId)}`;
      } catch (err) {
        console.error("[paddle activate]", err);
        // Still redirect with txn so homepage can retry activation
        window.location.href = `/?upgraded=1&txn=${encodeURIComponent(transactionId)}`;
        window.dispatchEvent(
          new CustomEvent("forge-paddle-error", {
            detail:
              err instanceof Error ? err.message : "Activation failed",
          })
        );
      }
    },
  });
  window.__forgePaddleReady = true;
}

export function SubscribeButton({ label }: { label?: string } = {}) {
  const { t } = useLocale();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);

  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  const priceId = process.env.NEXT_PUBLIC_PADDLE_PRICE_ID;

  useEffect(() => {
    const onActivateError = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      setError(detail || "Activation failed");
      setBusy(false);
    };
    window.addEventListener("forge-paddle-error", onActivateError);
    return () =>
      window.removeEventListener("forge-paddle-error", onActivateError);
  }, []);

  useEffect(() => {
    if (!token || !priceId) return;
    let cancelled = false;

    (async () => {
      setError(null);
      try {
        await loadPaddleScript();
        if (cancelled) return;
        initPaddle(token);
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) {
          setReady(false);
          setError(
            err instanceof Error
              ? err.message
              : "Checkout failed to load. Refresh and try again."
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, priceId, loadKey]);

  const onClick = useCallback(() => {
    setError(null);
    if (!token || !priceId) {
      setError("Checkout is not configured yet.");
      return;
    }
    if (!window.Paddle || !ready) {
      setError("Checkout is still loading. Try again in a moment.");
      return;
    }
    setBusy(true);
    try {
      window.Paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        settings: {
          theme: "light",
          locale: "en",
          // Homepage reads txn / _ptxn and calls /api/paddle/activate
          successUrl: `${window.location.origin}/?upgraded=1`,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open checkout");
    } finally {
      setBusy(false);
    }
  }, [token, priceId, ready]);

  if (!token || !priceId) {
    return (
      <button
        type="button"
        disabled
        className="w-full px-4 py-2.5 rounded-xl bg-ink/15 text-ink/45 text-sm font-semibold cursor-not-allowed"
      >
        {t("checkoutNotConfigured")}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onClick}
        disabled={busy || !ready}
        className="btn-press w-full px-4 py-3 rounded-2xl bg-ink text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-wait"
      >
        {busy ? "…" : ready ? label || t("payGo") : t("loadingCheckout")}
      </button>
      {error && (
        <div className="text-center space-y-1">
          <p className="text-xs text-danger">{error}</p>
          <button
            type="button"
            className="text-xs text-accent underline underline-offset-2"
            onClick={() => {
              window.__forgePaddleReady = false;
              setReady(false);
              setLoadKey((k) => k + 1);
            }}
          >
            Retry loading checkout
          </button>
        </div>
      )}
    </div>
  );
}
