"use client";

import { useLocale } from "@/components/LocaleProvider";
import type { RefineMode } from "@/lib/refine";

const PRESETS: { mode: RefineMode; labelKey: "refineTighten" | "refineLoosen" | "refineCapture" }[] =
  [
    { mode: "tighten", labelKey: "refineTighten" },
    { mode: "loosen", labelKey: "refineLoosen" },
    { mode: "captureValue", labelKey: "refineCapture" },
  ];

export function RefineBar({
  disabled,
  onRefine,
}: {
  disabled?: boolean;
  onRefine: (mode: RefineMode) => void;
}) {
  const { t } = useLocale();
  return (
    <div className="px-5 pb-3 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-subtle">{t("refineLabel")}</span>
        {PRESETS.map((p) => (
          <button
            key={p.mode}
            type="button"
            disabled={disabled}
            onClick={() => onRefine(p.mode)}
            className="btn-press text-xs font-semibold px-2.5 py-1 rounded-md border border-border bg-surface-raised text-muted hover:border-accent/40 hover:text-ink disabled:opacity-50 disabled:pointer-events-none transition-colors"
          >
            {t(p.labelKey)}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-subtle leading-snug">{t("refineQuotaHint")}</p>
    </div>
  );
}
