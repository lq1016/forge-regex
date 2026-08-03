"use client";

import { isValidRegExp } from "@/lib/regex-valid";
import { useLocale } from "@/components/LocaleProvider";

export function PatternEditor({
  pattern,
  flags,
  onChange,
}: {
  pattern: string;
  flags: string;
  onChange: (next: string) => void;
}) {
  const { t } = useLocale();
  const valid = isValidRegExp(pattern, flags);

  return (
    <div className="mx-5 mb-4">
      <label htmlFor="forge-pattern-edit" className="sr-only">
        {t("patternEditLabel")}
      </label>
      <div
        className={`flex items-start gap-0 font-mono text-[13px] sm:text-sm leading-relaxed bg-ink text-[#e8eaed] rounded-xl px-4 py-3.5 overflow-x-auto selection:bg-accent/40 border ${
          valid ? "border-transparent" : "border-amber-500/60"
        }`}
      >
        <span className="text-teal-300 shrink-0 select-none" aria-hidden>
          /
        </span>
        <textarea
          id="forge-pattern-edit"
          value={pattern}
          spellCheck={false}
          rows={1}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 bg-transparent text-[#f4f5f7] outline-none resize-y min-h-[1.25rem] field-sizing-content"
          aria-invalid={!valid}
        />
        <span className="text-teal-300 shrink-0 select-none" aria-hidden>
          /{flags}
        </span>
      </div>
      {!valid ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400 px-0.5">
          {t("patternInvalid")}
        </p>
      ) : null}
    </div>
  );
}
