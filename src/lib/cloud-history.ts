import { randomBytes } from "crypto";
import { getDb } from "@/lib/db";

export type CloudHistoryItem = {
  id: string;
  email: string;
  prompt: string;
  pattern: string;
  flags: string;
  testText: string;
  explanation: { token: string; description: string }[];
  createdAt: string;
};

type Row = {
  id: string;
  email: string;
  prompt: string;
  pattern: string;
  flags: string;
  test_text: string;
  explanation_json: string;
  created_at: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function rowToItem(row: Row): CloudHistoryItem {
  let explanation: CloudHistoryItem["explanation"] = [];
  try {
    const parsed = JSON.parse(row.explanation_json) as CloudHistoryItem["explanation"];
    if (Array.isArray(parsed)) explanation = parsed;
  } catch {
    explanation = [];
  }
  return {
    id: row.id,
    email: row.email,
    prompt: row.prompt,
    pattern: row.pattern,
    flags: row.flags,
    testText: row.test_text,
    explanation,
    createdAt: row.created_at,
  };
}

function newId(): string {
  return randomBytes(8).toString("base64url").slice(0, 12);
}

export function listCloudHistory(email: string, limit = 50): CloudHistoryItem[] {
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT id, email, prompt, pattern, flags, test_text, explanation_json, created_at
       FROM user_history WHERE email = ? ORDER BY created_at DESC LIMIT ?`
    )
    .all(normalizeEmail(email), limit) as Row[];
  return rows.map(rowToItem);
}

/** Replace user's cloud history with the provided items (newest-first, capped). */
export function replaceCloudHistory(
  email: string,
  items: Array<{
    prompt: string;
    pattern: string;
    flags: string;
    testText: string;
    explanation: { token: string; description: string }[];
    createdAt?: string;
  }>,
  max = 50
): CloudHistoryItem[] {
  const database = getDb();
  const em = normalizeEmail(email);
  const tx = database.prepare("DELETE FROM user_history WHERE email = ?");
  tx.run(em);

  const insert = database.prepare(
    `INSERT INTO user_history
      (id, email, prompt, pattern, flags, test_text, explanation_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const sliced = items.slice(0, max);
  for (const item of sliced) {
    if (!item.pattern || typeof item.pattern !== "string") continue;
    insert.run(
      newId(),
      em,
      (item.prompt || "").slice(0, 2000),
      item.pattern.slice(0, 4000),
      (item.flags || "").slice(0, 16),
      (item.testText || "").slice(0, 8000),
      JSON.stringify(
        Array.isArray(item.explanation) ? item.explanation.slice(0, 8) : []
      ),
      item.createdAt || new Date().toISOString()
    );
  }

  return listCloudHistory(em, max);
}
