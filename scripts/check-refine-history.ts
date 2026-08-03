import assert from "node:assert/strict";
import { buildRefineUserMessage, isRefineMode } from "../packages/forge-core/src/refine";
import {
  LOCAL_HISTORY_MAX,
  loadLocalHistory,
  pushLocalHistory,
  saveLocalHistory,
} from "../packages/forge-core/src/local-history";

assert.equal(isRefineMode("tighten"), true);
assert.equal(isRefineMode("nope"), false);

const zh = buildRefineUserMessage({
  locale: "zh",
  mode: "tighten",
  basePrompt: "抽 href",
  pattern: "href=.+",
  flags: "g",
});
assert.match(zh, /收紧/);
assert.match(zh, /href=\.\+/);

const en = buildRefineUserMessage({
  locale: "en",
  mode: "captureValue",
  basePrompt: "extract href",
  pattern: "href=(['\"])(.*?)\\1",
  flags: "gi",
});
assert.match(en, /Capture-value/);
console.log("refine: ok");

const mem = new Map<string, string>();
(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k, v) => {
    mem.set(k, String(v));
  },
  removeItem: (k) => {
    mem.delete(k);
  },
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;

saveLocalHistory([]);
assert.equal(loadLocalHistory().length, 0);
const once = pushLocalHistory({
  prompt: "emails",
  pattern: "a@b.c",
  flags: "g",
  testText: "a@b.c",
  explanation: [],
});
assert.equal(once.length, 1);
const twice = pushLocalHistory({
  prompt: "emails",
  pattern: "a@b.c",
  flags: "g",
  testText: "a@b.c x",
  explanation: [],
});
assert.equal(twice.length, 1, "dedupe same prompt+pattern+flags");
assert.ok(LOCAL_HISTORY_MAX >= 20);
console.log("local-history: ok");
