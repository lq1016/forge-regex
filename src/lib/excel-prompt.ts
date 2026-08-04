export type ExcelDialect = "excel365" | "excel2016" | "wps" | "gsheets";

export const EXCEL_DIALECTS: ExcelDialect[] = [
  "excel365",
  "excel2016",
  "wps",
  "gsheets",
];

const DIALECT_LABEL: Record<ExcelDialect, string> = {
  excel365: "Excel 365 / Excel 2021+",
  excel2016: "Excel 2016 / 2019",
  wps: "WPS 表格",
  gsheets: "Google Sheets",
};

/** Functions forbidden for the target dialect (uppercase). */
const BLOCKED: Record<ExcelDialect, ReadonlySet<string>> = {
  excel365: new Set(),
  excel2016: new Set([
    "XLOOKUP",
    "XMATCH",
    "FILTER",
    "SORT",
    "SORTBY",
    "UNIQUE",
    "SEQUENCE",
    "RANDARRAY",
    "TEXTSPLIT",
    "TEXTBEFORE",
    "TEXTAFTER",
    "TEXTJOIN",
    "LET",
    "LAMBDA",
    "BYROW",
    "BYCOL",
    "MAP",
    "REDUCE",
    "SCAN",
    "MAKEARRAY",
    "VSTACK",
    "HSTACK",
    "TOCOL",
    "TOROW",
    "WRAPROWS",
    "WRAPCOLS",
    "TAKE",
    "DROP",
    "CHOOSEROWS",
    "CHOOSECOLS",
    "EXPAND",
  ]),
  // WPS lags Microsoft 365 dynamic arrays; keep conservative.
  wps: new Set([
    "XLOOKUP",
    "FILTER",
    "SORT",
    "UNIQUE",
    "SEQUENCE",
    "LET",
    "LAMBDA",
    "TEXTSPLIT",
  ]),
  gsheets: new Set(["XLOOKUP", "LET", "LAMBDA"]), // Sheets has FILTER/SORT/UNIQUE; avoid Excel-only
};

export function isExcelDialect(v: unknown): v is ExcelDialect {
  return typeof v === "string" && (EXCEL_DIALECTS as string[]).includes(v);
}

export function buildExcelSystemPrompt(dialect: ExcelDialect): string {
  const blocked = [...BLOCKED[dialect]];
  const avoid =
    blocked.length === 0
      ? "- Prefer modern Excel 365 functions when helpful (XLOOKUP, FILTER, etc.)."
      : `- Target: ${DIALECT_LABEL[dialect]}. NEVER use: ${blocked.join(", ")}. Use older equivalents (VLOOKUP/INDEX+MATCH, COUNTIF, CONCATENATE, etc.).`;

  return `Excel formula expert. Return ONLY JSON:
{"formula":"=...","assumptions":"...","explanation":[{"token":"...","description":"..."}],"impossible":false}
or {"formula":null,"assumptions":"...","explanation":[],"impossible":true} if one formula cannot do it.

Rules:
- One formula only, must start with =. Argument separator is comma (not semicolon).
- Max 5 short explanation items; descriptions in Simplified Chinese.
- "assumptions" required, Simplified Chinese, state column/row meanings (e.g. A列=大区).
- Prefer common spreadsheet interpretation when ambiguous.
${avoid}
- Do not invent VBA, Power Query, or pivot steps.`;
}

/** Strip double-quoted string literals so paren/func scan ignores them. */
function stripStrings(formula: string): string {
  return formula.replace(/"(?:[^"]|"")*"/g, '""');
}

function extractFunctions(formula: string): string[] {
  const body = stripStrings(formula).toUpperCase();
  const names: string[] = [];
  const re = /\b([A-Z][A-Z0-9._]*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    names.push(m[1]);
  }
  return names;
}

function balanced(formula: string): boolean {
  const body = stripStrings(formula);
  let depth = 0;
  for (const ch of body) {
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

export function validateFormula(
  formula: string,
  dialect: ExcelDialect
):
  | { ok: true; blocked: string[] }
  | {
      ok: false;
      kind: "structural" | "dialect";
      reason: string;
      blocked: string[];
    } {
  if (typeof formula !== "string" || !formula.trim()) {
    return {
      ok: false,
      kind: "structural",
      reason: "empty",
      blocked: [],
    };
  }
  const f = formula.trim();
  if (!f.startsWith("=")) {
    return {
      ok: false,
      kind: "structural",
      reason: "must_start_with_equals",
      blocked: [],
    };
  }
  if (f.length > 500) {
    return {
      ok: false,
      kind: "structural",
      reason: "too_long",
      blocked: [],
    };
  }
  if ((f.match(/"/g) || []).length % 2 !== 0) {
    return {
      ok: false,
      kind: "structural",
      reason: "unbalanced_quotes",
      blocked: [],
    };
  }
  if (!balanced(f)) {
    return {
      ok: false,
      kind: "structural",
      reason: "unbalanced_parens",
      blocked: [],
    };
  }

  const used = extractFunctions(f);
  const blocked = [
    ...new Set(used.filter((n) => BLOCKED[dialect].has(n))),
  ];
  // Dialect hits are warnings at the route layer; still return ok:true with blocked list.
  return { ok: true, blocked };
}

export function dialectWarning(
  blocked: string[],
  dialect: ExcelDialect
): string {
  return `这个公式用到了 ${blocked.join("、")}，${DIALECT_LABEL[dialect]} 可能不支持。可切换版本或改写需求后再试。`;
}
