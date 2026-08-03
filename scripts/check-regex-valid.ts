import assert from "node:assert/strict";
import { isValidRegExp } from "../packages/forge-core/src/regex-valid";

assert.equal(isValidRegExp("a+"), true);
assert.equal(isValidRegExp("[a-z]+", "gi"), true);
assert.equal(isValidRegExp("(unclosed"), false);
assert.equal(isValidRegExp("*"), false);
assert.equal(isValidRegExp(""), true);
console.log("regex-valid: ok");
