export type RedosCode =
  | "nestedQuantifier"
  | "adjacentOverlap"
  | "optionalPlusStar"
  | null;

export type RedosResult = { risk: boolean; code: RedosCode };

/** Lightweight static heuristics — advisory only. */
export function analyzeRedosRisk(pattern: string): RedosResult {
  if (!pattern) return { risk: false, code: null };

  // optional wrapper around open quantifier: (a+)? (a*)?
  if (/\((?:[^()\\]|\\.)*[+*][?]?(?:[^()\\]|\\.)*\)\?/.test(pattern)) {
    return { risk: true, code: "optionalPlusStar" };
  }

  // (…quantifier…)quantifier  e.g. (a+)+  (a*)*  (foo)?+
  if (/\((?:[^()\\]|\\.)*[+*][?]?(?:[^()\\]|\\.)*\)[+*?]/.test(pattern)) {
    return { risk: true, code: "nestedQuantifier" };
  }
  if (/\((?:[^()\\]|\\.)*\{[\d,]+\}(?:[^()\\]|\\.)*\)[+*?]/.test(pattern)) {
    return { risk: true, code: "nestedQuantifier" };
  }

  // adjacent greedy overlap: \w+\w*  .*.+  [a-z]+[a-z]*
  if (
    /(?:\.\*|\\.[\w]*\*|\\[wWdDsS]\*|\[(?:\\.|[^\]])+\]\*)(?:\.\+|\\.[\w]*\+|\\[wWdDsS]\+|\[(?:\\.|[^\]])+\]\+)/.test(
      pattern
    ) ||
    /(?:\.\+|\\.[\w]*\+|\\[wWdDsS]\+|\[(?:\\.|[^\]])+\]\+)(?:\.\*|\\.[\w]*\*|\\[wWdDsS]\*|\[(?:\\.|[^\]])+\]\*)/.test(
      pattern
    )
  ) {
    return { risk: true, code: "adjacentOverlap" };
  }

  return { risk: false, code: null };
}
