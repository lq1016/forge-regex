export type MatchRow = {
  index: number;
  full: string;
  groups: Array<string | undefined>;
  named: Record<string, string>;
};

const MAX_ROWS = 50;

function withGlobal(flags: string): string {
  return flags.includes("g") ? flags : `${flags}g`;
}

export function buildMatchRows(
  text: string,
  pattern: string,
  flags: string
): MatchRow[] | null {
  try {
    const re = new RegExp(pattern, withGlobal(flags));
    const rows: MatchRow[] = [];
    let m: RegExpExecArray | null;
    let guard = 0;
    while ((m = re.exec(text)) !== null && guard++ < MAX_ROWS) {
      if (m[0] === "") {
        re.lastIndex++;
        continue;
      }
      const groups: Array<string | undefined> = [];
      for (let i = 1; i < m.length; i++) groups.push(m[i]);
      const named: Record<string, string> = {};
      if (m.groups) {
        for (const [k, v] of Object.entries(m.groups)) {
          if (v !== undefined) named[k] = v;
        }
      }
      rows.push({ index: m.index, full: m[0], groups, named });
      if (!re.global) break;
    }
    return rows;
  } catch {
    return null;
  }
}

export function maxGroupCount(rows: MatchRow[]): number {
  return rows.reduce((n, r) => Math.max(n, r.groups.length), 0);
}
