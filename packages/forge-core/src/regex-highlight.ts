/**
 * Split text into highlight parts for a RegExp.
 * When the pattern has capturing groups, prefer highlighting the last
 * non-empty capture (typical for href=(['"])(url)\1 extractors).
 */
export type HighlightPart = { text: string; match: boolean };

function withGlobal(flags: string): string {
  return flags.includes("g") ? flags : `${flags}g`;
}

function withIndices(flags: string): string {
  const g = withGlobal(flags);
  return g.includes("d") ? g : `${g}d`;
}

/** Index of the last capturing group with length > 0, or -1. */
function preferredGroupIndex(match: RegExpExecArray | RegExpMatchArray): number {
  let best = -1;
  for (let i = 1; i < match.length; i++) {
    const g = match[i];
    if (typeof g === "string" && g.length > 0) best = i;
  }
  return best;
}

export function buildHighlightParts(
  text: string,
  pattern: string,
  flags: string
): HighlightPart[] | null {
  try {
    const regex = new RegExp(pattern, withIndices(flags));
    const parts: HighlightPart[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let guard = 0;

    while ((match = regex.exec(text)) !== null && guard++ < 500) {
      if (match[0] === "") {
        regex.lastIndex++;
        continue;
      }

      const fullStart = match.index;
      const fullEnd = fullStart + match[0].length;
      const gi = preferredGroupIndex(match);

      let hiStart = fullStart;
      let hiEnd = fullEnd;

      if (gi > 0) {
        const indices = (
          match as RegExpExecArray & {
            indices?: Array<[number, number] | undefined>;
          }
        ).indices;
        const range = indices?.[gi];
        if (range) {
          hiStart = range[0];
          hiEnd = range[1];
        } else {
          const g = match[gi]!;
          const offset = match[0].indexOf(g);
          if (offset >= 0) {
            hiStart = fullStart + offset;
            hiEnd = hiStart + g.length;
          }
        }
      }

      if (hiStart > lastIndex) {
        parts.push({ text: text.slice(lastIndex, hiStart), match: false });
      }
      if (hiEnd > hiStart) {
        parts.push({ text: text.slice(hiStart, hiEnd), match: true });
      }
      // Include any remainder of the full match as non-highlight (e.g. closing quote)
      if (fullEnd > hiEnd && fullEnd > lastIndex) {
        const from = Math.max(hiEnd, lastIndex);
        if (fullEnd > from) {
          parts.push({ text: text.slice(from, fullEnd), match: false });
        }
      }

      lastIndex = Math.max(fullEnd, regex.lastIndex);
      if (regex.lastIndex <= fullStart) regex.lastIndex = fullEnd;
    }

    if (lastIndex < text.length) {
      parts.push({ text: text.slice(lastIndex), match: false });
    }
    return parts;
  } catch {
    return null;
  }
}

export function countHighlightMatches(
  text: string,
  pattern: string,
  flags: string
): number {
  const parts = buildHighlightParts(text, pattern, flags);
  return parts?.filter((p) => p.match).length ?? 0;
}
