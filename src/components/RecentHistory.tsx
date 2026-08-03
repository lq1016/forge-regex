"use client";

import { useLocale } from "@/components/LocaleProvider";
import type { HistoryItem } from "@/lib/local-history";
import Link from "next/link";

export function RecentHistory({
  items,
  isPro,
  syncing,
  onRestore,
  onSync,
}: {
  items: HistoryItem[];
  isPro: boolean;
  syncing?: boolean;
  onRestore: (item: HistoryItem) => void;
  onSync: () => void;
}) {
  const { t, href } = useLocale();
  if (items.length === 0) return null;

  return (
    <section className="mb-4 rounded-xl border border-border bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-subtle">
          {t("recentTitle")}
        </h2>
        {isPro ? (
          <button
            type="button"
            disabled={syncing}
            onClick={onSync}
            className="text-xs font-medium text-accent hover:text-accent-hover disabled:opacity-50"
          >
            {syncing ? t("historySyncing") : t("historySync")}
          </button>
        ) : (
          <Link
            href={href("/pricing")}
            className="text-xs font-medium text-accent hover:text-accent-hover"
          >
            {t("historySyncPro")}
          </Link>
        )}
      </div>
      <ul className="space-y-1.5">
        {items.slice(0, 8).map((item) => {
          const label =
            item.prompt.trim() ||
            `/${item.pattern.slice(0, 40)}${item.pattern.length > 40 ? "…" : ""}/${item.flags}`;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onRestore(item)}
                className="w-full text-left text-sm text-muted hover:text-ink hover:bg-surface-raised rounded-lg px-2 py-1.5 transition-colors truncate"
                title={label}
              >
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
