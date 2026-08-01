export type ExportLang = "js" | "python" | "go" | "java" | "dotnet";

export const EXPORT_LANGS: { id: ExportLang; label: string }[] = [
  { id: "js", label: "JavaScript" },
  { id: "python", label: "Python" },
  { id: "go", label: "Go" },
  { id: "java", label: "Java" },
  { id: "dotnet", label: ".NET" },
];

function jsLiteral(pattern: string, flags: string): string {
  const body = pattern.replace(/\\/g, "\\\\").replace(/`/g, "\\`");
  // Prefer slash form when flags are simple; fall back to RegExp ctor if needed
  if (!/[/\n\r]/.test(pattern)) {
    const escaped = pattern.replace(/\//g, "\\/");
    return `/${escaped}/${flags}`;
  }
  return `new RegExp(${JSON.stringify(pattern)}, ${JSON.stringify(flags)})`;
}

export function buildExportSnippet(
  lang: ExportLang,
  pattern: string,
  flags: string
): string {
  const hasI = flags.includes("i");
  const hasM = flags.includes("m");
  const hasS = flags.includes("s");

  switch (lang) {
    case "js":
      return `const re = ${jsLiteral(pattern, flags)};\nconst matches = text.match(re);`;
    case "python": {
      const opts: string[] = [];
      if (hasI) opts.push("re.I");
      if (hasM) opts.push("re.M");
      if (hasS) opts.push("re.S");
      const flagsExpr = opts.length ? `, ${opts.join(" | ")}` : "";
      return `import re\n\npattern = re.compile(r"""${pattern.replace(/"""/g, '\\"\\"\\"')}"""${flagsExpr})\nmatches = pattern.findall(text)`;
    }
    case "go": {
      let p = pattern;
      if (hasI) p = `(?i)${p}`;
      if (hasM) p = `(?m)${p}`;
      if (hasS) p = `(?s)${p}`;
      return `import "regexp"\n\nre := regexp.MustCompile(\`${p.replace(/`/g, "` + \"`\" + `")}\`)\nmatches := re.FindAllString(text, -1)`;
    }
    case "java": {
      const opts: string[] = [];
      if (hasI) opts.push("Pattern.CASE_INSENSITIVE");
      if (hasM) opts.push("Pattern.MULTILINE");
      if (hasS) opts.push("Pattern.DOTALL");
      const second = opts.length ? `, ${opts.join(" | ")}` : "";
      const esc = pattern.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return `import java.util.regex.Pattern;\n\nPattern pattern = Pattern.compile("${esc}"${second});\nvar matcher = pattern.matcher(text);`;
    }
    case "dotnet": {
      const opts: string[] = [];
      if (hasI) opts.push("RegexOptions.IgnoreCase");
      if (hasM) opts.push("RegexOptions.Multiline");
      if (hasS) opts.push("RegexOptions.Singleline");
      const second = opts.length ? `, ${opts.join(" | ")}` : "";
      const esc = pattern.replace(/"/g, '""');
      return `using System.Text.RegularExpressions;\n\nvar re = new Regex(@"${esc}"${second});\nvar matches = re.Matches(text);`;
    }
  }
}
