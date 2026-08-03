export const REFINE_MODES = ["tighten", "loosen", "captureValue"] as const;
export type RefineMode = (typeof REFINE_MODES)[number];

export function isRefineMode(value: unknown): value is RefineMode {
  return (
    typeof value === "string" &&
    (REFINE_MODES as readonly string[]).includes(value)
  );
}

/** Build the user message sent to the LLM for a refine pass. */
export function buildRefineUserMessage(input: {
  locale: "en" | "zh";
  mode: RefineMode;
  basePrompt: string;
  pattern: string;
  flags: string;
}): string {
  const base = input.basePrompt.trim() || "(none)";
  const literal = `/${input.pattern}/${input.flags}`;

  if (input.locale === "zh") {
    const intent =
      input.mode === "tighten"
        ? "收紧：减少误匹配，尽量保持召回；优先更具体的字符类与边界。"
        : input.mode === "loosen"
          ? "放宽：覆盖更多合理变体，避免过度严格。"
          : "只要目标值：整段匹配应直接是要抽取的值（优先 lookbehind / 捕获组取最后一组）。";
    return `请改写这条 JS 正则（不要另起炉灶无关需求）。
原始需求：${base}
当前正则：${literal}
改写目标：${intent}
仍返回同一 JSON 结构；sample 要能测出新正则。`;
  }

  const intent =
    input.mode === "tighten"
      ? "Tighten: fewer false positives while keeping recall; prefer tighter classes and boundaries."
      : input.mode === "loosen"
        ? "Loosen: cover more realistic variants; avoid over-strict anchors."
        : "Capture-value only: the full match should BE the extracted value (prefer lookbehind / last capturing group).";

  return `Rewrite this JavaScript RegExp (keep the same intent).
Original request: ${base}
Current pattern: ${literal}
Goal: ${intent}
Return the same JSON shape; sample must exercise the new pattern.`;
}
