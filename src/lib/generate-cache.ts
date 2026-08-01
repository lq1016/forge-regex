import { createHash } from "crypto";
import { getDb } from "@/lib/db";

export type CachedRegex = {
  pattern: string;
  flags: string;
  explanation: { token: string; description: string }[];
  sample?: string;
};

function normalizePrompt(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, " ");
}

function cacheKey(prompt: string): string {
  // bump version when generation rules change so bad cached answers expire
  return createHash("sha256")
    .update(`v3:${normalizePrompt(prompt)}`)
    .digest("hex");
}

function ensureSampleColumn(): void {
  const db = getDb();
  try {
    db.exec(`ALTER TABLE generate_cache ADD COLUMN sample_text TEXT`);
  } catch {
    // column already exists
  }
}

let sampleColumnReady = false;

export function getCachedRegex(prompt: string): CachedRegex | null {
  const db = getDb();
  if (!sampleColumnReady) {
    ensureSampleColumn();
    sampleColumnReady = true;
  }
  const key = cacheKey(prompt);
  const row = db
    .prepare(
      `SELECT pattern, flags, explanation_json, sample_text
       FROM generate_cache
       WHERE prompt_hash = ?`
    )
    .get(key) as
    | {
        pattern: string;
        flags: string;
        explanation_json: string;
        sample_text: string | null;
      }
    | undefined;

  if (!row) return null;

  db.prepare(
    `UPDATE generate_cache SET hit_count = hit_count + 1 WHERE prompt_hash = ?`
  ).run(key);

  try {
    const explanation = JSON.parse(
      row.explanation_json
    ) as CachedRegex["explanation"];
    return {
      pattern: row.pattern,
      flags: row.flags,
      explanation: Array.isArray(explanation) ? explanation : [],
      sample: row.sample_text || undefined,
    };
  } catch {
    return null;
  }
}

export function setCachedRegex(prompt: string, value: CachedRegex): void {
  const db = getDb();
  if (!sampleColumnReady) {
    ensureSampleColumn();
    sampleColumnReady = true;
  }
  db.prepare(
    `INSERT INTO generate_cache
       (prompt_hash, prompt, pattern, flags, explanation_json, sample_text, created_at, hit_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(prompt_hash) DO UPDATE SET
       pattern = excluded.pattern,
       flags = excluded.flags,
       explanation_json = excluded.explanation_json,
       sample_text = excluded.sample_text,
       created_at = excluded.created_at`
  ).run(
    cacheKey(prompt),
    normalizePrompt(prompt),
    value.pattern,
    value.flags || "",
    JSON.stringify(value.explanation ?? []),
    value.sample || "",
    new Date().toISOString()
  );
}
