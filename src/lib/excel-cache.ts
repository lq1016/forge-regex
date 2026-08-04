import { createHash } from "crypto";
import { getDb } from "@/lib/db";
import type { ExcelDialect } from "@/lib/excel-prompt";

export type CachedExcel = {
  formula: string;
  dialect: ExcelDialect;
  assumptions: string;
  explanation: { token: string; description: string }[];
  warning: string | null;
};

function normalizePrompt(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, " ");
}

function cacheKey(prompt: string, dialect: ExcelDialect): string {
  return createHash("sha256")
    .update(`v1:${dialect}:${normalizePrompt(prompt)}`)
    .digest("hex");
}

export function getCachedExcel(
  prompt: string,
  dialect: ExcelDialect
): CachedExcel | null {
  const db = getDb();
  const key = cacheKey(prompt, dialect);
  const row = db
    .prepare(
      `SELECT payload_json
       FROM excel_cache
       WHERE cache_key = ?`
    )
    .get(key) as { payload_json: string } | undefined;
  if (!row) return null;

  db.prepare(
    `UPDATE excel_cache SET hit_count = hit_count + 1 WHERE cache_key = ?`
  ).run(key);

  try {
    return JSON.parse(row.payload_json) as CachedExcel;
  } catch {
    return null;
  }
}

export function setCachedExcel(
  prompt: string,
  dialect: ExcelDialect,
  payload: CachedExcel
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO excel_cache
       (cache_key, prompt, dialect, payload_json, created_at, hit_count)
     VALUES (?, ?, ?, ?, ?, 0)
     ON CONFLICT(cache_key) DO UPDATE SET
       payload_json = excluded.payload_json,
       created_at = excluded.created_at`
  ).run(
    cacheKey(prompt, dialect),
    normalizePrompt(prompt),
    dialect,
    JSON.stringify(payload),
    new Date().toISOString()
  );
}
