"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import {
  translate,
  type Locale,
  type MessageKey,
} from "@/lib/i18n";

type LocaleContextValue = {
  locale: Locale;
  /** "" for global, "/cn" for China edition */
  basePath: string;
  /** Pro / quota edition — does not cross-purchase */
  edition: "cn" | "global";
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  href: (path: string) => string;
  /** Headers for API calls that need regional Pro */
  editionHeaders: () => Record<string, string>;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  locale,
  basePath,
  children,
}: {
  locale: Locale;
  basePath: string;
  children: ReactNode;
}) {
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  const value = useMemo<LocaleContextValue>(() => {
    const normalized = basePath.replace(/\/$/, "");
    const edition = normalized === "/cn" || locale === "zh" ? "cn" : "global";
    return {
      locale,
      basePath: normalized,
      edition,
      t: (key, vars) => translate(locale, key, vars),
      href: (path: string) => {
        if (path.startsWith("http") || path.startsWith("mailto:")) return path;
        const p = path.startsWith("/") ? path : `/${path}`;
        if (!normalized) return p;
        if (p === "/") return normalized || "/";
        return `${normalized}${p}`;
      },
      editionHeaders: () => ({ "X-Forge-Edition": edition }),
    };
  }, [locale, basePath]);

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    // Fallback for pages not yet wrapped (English global)
    return {
      locale: "en",
      basePath: "",
      edition: "global",
      t: (key, vars) => translate("en", key, vars),
      href: (path) => path,
      editionHeaders: () => ({ "X-Forge-Edition": "global" }),
    };
  }
  return ctx;
}
