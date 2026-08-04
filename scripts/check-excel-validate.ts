import {
  validateFormula,
  type ExcelDialect,
} from "../src/lib/excel-prompt";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const d2016: ExcelDialect = "excel2016";
const d365: ExcelDialect = "excel365";

assert(validateFormula("SUM(A1)", d365).ok === false, "missing =");
assert(
  (validateFormula("SUM(A1)", d365) as { kind: string }).kind === "structural",
  "structural"
);
assert(validateFormula("=SUM(A1", d365).ok === false, "unbalanced (");
assert(validateFormula('=A1&"hi("', d365).ok === true, "paren in string ok");

const xl = validateFormula("=XLOOKUP(A1,B:B,C:C)", d2016);
assert(xl.ok === true, "dialect still ok");
assert(xl.ok && xl.blocked.includes("XLOOKUP"), "blocked XLOOKUP");

const safe = validateFormula("=SUMIF(A:A,\"华东\",C:C)", d2016);
assert(safe.ok === true && safe.blocked.length === 0, "SUMIF ok on 2016");

const lit = validateFormula('="XLOOKUP("&A1', d2016);
assert(lit.ok === true && lit.blocked.length === 0, "name only in string");

console.log("check-excel-validate: ok");
