import { randomBytes } from "crypto";
import { getDb } from "@/lib/db";

export type ShareExplanation = { token: string; description: string };

export type ShareRecord = {
  id: string;
  email: string;
  prompt: string;
  pattern: string;
  flags: string;
  explanation: ShareExplanation[];
  testText: string;
  createdAt: string;
};

type ShareRow = {
  id: string;
  email: string;
  prompt: string;
  pattern: string;
  flags: string;
  explanation_json: string;
  test_text: string;
  created_at: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function rowToRecord(row: ShareRow): ShareRecord {
  let explanation: ShareExplanation[] = [];
  try {
    const parsed = JSON.parse(row.explanation_json) as ShareExplanation[];
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
    explanation,
    testText: row.test_text,
    createdAt: row.created_at,
  };
}

/** Short url-safe id (10 chars). */
export function createShareId(): string {
  return randomBytes(8).toString("base64url").slice(0, 10);
}

export function createShare(input: {
  email: string;
  prompt: string;
  pattern: string;
  flags: string;
  explanation: ShareExplanation[];
  testText: string;
}): ShareRecord {
  const database = getDb();
  const email = normalizeEmail(input.email);
  const createdAt = new Date().toISOString();

  let id = createShareId();
  for (let i = 0; i < 5; i++) {
    const existing = database
      .prepare("SELECT id FROM shares WHERE id = ?")
      .get(id) as { id: string } | undefined;
    if (!existing) break;
    id = createShareId();
  }

  database
    .prepare(
      `
      INSERT INTO shares (
        id, email, prompt, pattern, flags, explanation_json, test_text, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
    .run(
      id,
      email,
      input.prompt.slice(0, 4000),
      input.pattern.slice(0, 4000),
      input.flags.slice(0, 32),
      JSON.stringify(input.explanation.slice(0, 40)),
      input.testText.slice(0, 20000),
      createdAt
    );

  return {
    id,
    email,
    prompt: input.prompt,
    pattern: input.pattern,
    flags: input.flags,
    explanation: input.explanation,
    testText: input.testText,
    createdAt,
  };
}

export function getShareById(id: string): ShareRecord | null {
  const row = getDb()
    .prepare("SELECT * FROM shares WHERE id = ?")
    .get(id) as ShareRow | undefined;
  return row ? rowToRecord(row) : null;
}

export function listSharesByEmail(email: string): ShareRecord[] {
  const rows = getDb()
    .prepare(
      `
      SELECT * FROM shares
      WHERE email = ?
      ORDER BY created_at DESC
      LIMIT 100
    `
    )
    .all(normalizeEmail(email)) as ShareRow[];
  return rows.map(rowToRecord);
}

export function deleteShare(id: string, email: string): boolean {
  const result = getDb()
    .prepare("DELETE FROM shares WHERE id = ? AND email = ?")
    .run(id, normalizeEmail(email));
  return Number(result.changes ?? 0) > 0;
}
