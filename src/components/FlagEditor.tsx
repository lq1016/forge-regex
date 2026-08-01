"use client";

import { FLAG_CHIPS, hasFlag, toggleFlag, type FlagChip } from "@/lib/regex-flags";
import { useLocale } from "@/components/LocaleProvider";

export function FlagEditor({
  flags,
  onChange,
}: {
  flags: string;
  onChange: (next: string) => void;
}) {
  const { t } = useLocale();
  return (
    <div className="flex flex-wrap items-center gap-2 px-5 pb-3">
      <span className="text-xs font-medium text-subtle">{t("flagsLabel")}</span>
      <div className="flex flex-wrap gap-1.5">
        {FLAG_CHIPS.map((flag) => {
          const on = hasFlag(flags, flag);
          return (
            <button
              key={flag}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(toggleFlag(flags, flag as FlagChip))}
              className={`btn-press min-w-8 px-2 py-1 rounded-md font-mono text-xs font-semibold border transition-colors ${
                on
                  ? "bg-accent-soft text-accent border-accent/30"
                  : "bg-surface-raised text-muted border-border hover:border-accent/40"
              }`}
            >
              {flag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
