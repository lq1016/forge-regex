import assert from "node:assert/strict";
import { isValidRegExp } from "../src/lib/regex-valid";

assert.equal(isValidRegExp("a+"), true);
assert.equal(isValidRegExp("[a-z]+", "gi"), true);
assert.equal(isValidRegExp("(unclosed"), false);
assert.equal(isValidRegExp("*"), false);
assert.equal(isValidRegExp(""), true); // empty pattern is valid RegExp
console.log("regex-valid: ok");
