"use client";

import {
  buildMatchRows,
  maxGroupCount,
  type MatchRow,
} from "@/lib/regex-matches";
import { useLocale } from "@/components/LocaleProvider";

function cell(v: string | undefined, dash: string): string {
  if (v === undefined) return dash;
  if (v === "") return '""';
  return v;
}

export function CaptureGroupsTable({
  pattern,
  flags,
  testText,
}: {
  pattern: string;
  flags: string;
  testText: string;
}) {
  const { t } = useLocale();
  const rows = buildMatchRows(testText, pattern, flags);
  if (!rows || rows.length === 0) return null;
  const gCount = maxGroupCount(rows);
  const hasNamed = rows.some((r) => Object.keys(r.named).length > 0);

  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-border">
      <div className="px-3 py-2 text-xs font-semibold text-ink bg-surface-raised border-b border-border">
        {t("capturesTitle")}
      </div>
      <table className="w-full text-xs font-mono text-left">
        <thead>
          <tr className="text-subtle border-b border-border">
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">$0</th>
            {Array.from({ length: gCount }, (_, i) => (
              <th key={i} className="px-3 py-2 font-medium">{`$${i + 1}`}</th>
            ))}
            {hasNamed ? (
              <th className="px-3 py-2 font-medium">named</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r: MatchRow, i) => (
            <tr key={`${r.index}-${i}`} className="border-b border-border/70 last:border-0">
              <td className="px-3 py-2 text-subtle">{i + 1}</td>
              <td className="px-3 py-2 text-ink max-w-[14rem] truncate" title={r.full}>
                {r.full}
              </td>
              {Array.from({ length: gCount }, (_, gi) => (
                <td
                  key={gi}
                  className="px-3 py-2 text-muted max-w-[12rem] truncate"
                  title={r.groups[gi] ?? ""}
                >
                  {cell(r.groups[gi], t("captureDash"))}
                </td>
              ))}
              {hasNamed ? (
                <td className="px-3 py-2 text-muted">
                  {Object.entries(r.named)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(" · ") || t("captureDash")}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
