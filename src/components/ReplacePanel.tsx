"use client";

import { useMemo, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";

function applyReplace(pattern: string, flags: string, text: string, replacement: string): string {
  try {
    const re = new RegExp(pattern, flags.includes("g") ? flags : `${flags}g`);
    return text.replace(re, replacement);
  } catch {
    return text;
  }
}

export function ReplacePanel({
  pattern,
  flags,
  testText,
}: {
  pattern: string;
  flags: string;
  testText: string;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(true);
  const [replacement, setReplacement] = useState("$&");
  const [copied, setCopied] = useState(false);

  const preview = useMemo(
    () => applyReplace(pattern, flags, testText, replacement),
    [pattern, flags, testText, replacement]
  );

  async function copy() {
    await navigator.clipboard.writeText(preview);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="animate-enter-delay-1 bg-surface rounded-2xl border border-border shadow-[0_1px_2px_rgba(17,19,24,0.04)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-surface-raised/80 transition-colors"
        aria-expanded={open}
      >
        <h2 className="text-sm font-semibold text-ink">{t("replaceTitle")}</h2>
        <span
          className={`text-subtle transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-3 border-t border-border pt-4">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-subtle">
            {t("replaceLabel")}
          </label>
          <input
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm font-mono text-ink bg-surface-raised outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-ring)]"
            spellCheck={false}
            placeholder="$1"
          />
          <div className="p-3.5 bg-surface-raised rounded-xl text-sm leading-relaxed text-muted font-mono border border-border whitespace-pre-wrap break-words min-h-[3rem]">
            {preview || (
              <span className="text-subtle italic font-sans">{t("replaceEmpty")}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => void copy()}
            className="btn-press inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent-soft text-accent hover:bg-accent hover:text-white transition-colors"
          >
            {copied ? t("copied") : t("replaceCopy")}
          </button>
        </div>
      )}
    </section>
  );
}
