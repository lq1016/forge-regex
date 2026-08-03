export type HistoryItem = {
  id: string;
  savedAt: string;
  prompt: string;
  pattern: string;
  flags: string;
  testText: string;
  explanation: { token: string; description: string }[];
};

export const LOCAL_HISTORY_KEY = "forge-regex-history-v1";
export const LOCAL_HISTORY_MAX = 30;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function loadLocalHistory(): HistoryItem[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(LOCAL_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (row): row is HistoryItem =>
          !!row &&
          typeof row === "object" &&
          typeof (row as HistoryItem).id === "string" &&
          typeof (row as HistoryItem).pattern === "string"
      )
      .slice(0, LOCAL_HISTORY_MAX);
  } catch {
    return [];
  }
}

export function saveLocalHistory(items: HistoryItem[]): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(
      LOCAL_HISTORY_KEY,
      JSON.stringify(items.slice(0, LOCAL_HISTORY_MAX))
    );
  } catch {
    // quota / private mode
  }
}

/** Upsert by pattern+flags+prompt fingerprint; newest first. */
export function pushLocalHistory(
  entry: Omit<HistoryItem, "id" | "savedAt"> & { id?: string; savedAt?: string }
): HistoryItem[] {
  const id =
    entry.id ||
    `l_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const savedAt = entry.savedAt || new Date().toISOString();
  const nextItem: HistoryItem = {
    id,
    savedAt,
    prompt: entry.prompt || "",
    pattern: entry.pattern,
    flags: entry.flags || "",
    testText: entry.testText || "",
    explanation: Array.isArray(entry.explanation) ? entry.explanation : [],
  };

  const prev = loadLocalHistory().filter(
    (h) =>
      !(
        h.pattern === nextItem.pattern &&
        h.flags === nextItem.flags &&
        h.prompt === nextItem.prompt
      )
  );
  const next = [nextItem, ...prev].slice(0, LOCAL_HISTORY_MAX);
  saveLocalHistory(next);
  return next;
}
