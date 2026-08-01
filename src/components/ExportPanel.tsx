"use client";

import { useMemo, useState } from "react";
import {
  EXPORT_LANGS,
  buildExportSnippet,
  type ExportLang,
} from "@/lib/export-snippets";
import { useLocale } from "@/components/LocaleProvider";

export function ExportPanel({
  pattern,
  flags,
}: {
  pattern: string;
  flags: string;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(true);
  const [lang, setLang] = useState<ExportLang>("js");
  const [copied, setCopied] = useState(false);

  const snippet = useMemo(
    () => buildExportSnippet(lang, pattern, flags),
    [lang, pattern, flags]
  );

  async function copy() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="animate-enter-delay-2 bg-surface rounded-2xl border border-border shadow-[0_1px_2px_rgba(17,19,24,0.04)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-surface-raised/80 transition-colors"
        aria-expanded={open}
      >
        <h2 className="text-sm font-semibold text-ink">{t("exportTitle")}</h2>
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
          <div className="flex flex-wrap gap-1.5">
            {EXPORT_LANGS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setLang(item.id)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                  lang === item.id
                    ? "bg-ink text-white border-ink"
                    : "bg-surface-raised text-muted border-border hover:border-border-strong"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <pre className="font-mono text-[12px] sm:text-[13px] leading-relaxed bg-ink text-[#e8eaed] rounded-xl px-4 py-3.5 overflow-x-auto whitespace-pre">
            {snippet}
          </pre>
          <button
            type="button"
            onClick={() => void copy()}
            className="btn-press inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent-soft text-accent hover:bg-accent hover:text-white transition-colors"
          >
            {copied ? t("copied") : t("exportCopy")}
          </button>
        </div>
      )}
    </section>
  );
}
