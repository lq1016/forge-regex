"use client";

import type { RedosCode } from "@/lib/regex-redos";
import { useLocale } from "@/components/LocaleProvider";
import type { MessageKey } from "@/lib/i18n";

const CODE_KEY: Record<Exclude<RedosCode, null>, MessageKey> = {
  nestedQuantifier: "redosNested",
  adjacentOverlap: "redosAdjacent",
  optionalPlusStar: "redosOptional",
};

export function RedosWarning({ code }: { code: Exclude<RedosCode, null> }) {
  const { t } = useLocale();
  return (
    <div
      role="status"
      className="mx-5 mb-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3.5 py-3 text-sm text-ink"
    >
      <p className="font-medium">{t("redosTitle")}</p>
      <p className="mt-1 text-muted leading-snug">{t(CODE_KEY[code])}</p>
    </div>
  );
}
