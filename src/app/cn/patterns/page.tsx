import type { Metadata } from "next";
import { PatternIndex } from "@/components/PatternPages";
import { JsonLd } from "@/components/JsonLd";
import { PATTERNS, patternPath } from "@/lib/patterns";
import { absoluteUrl, cnLocaleAlternates, cnSocialMeta } from "@/lib/seo";

const title = "常用正则库 | Forge Regex 中国版";
const description =
  "邮箱、手机号、身份证、URL、HTML 抽链与去标签等高频正则，带样例测试与中文生成入口。";

export const metadata: Metadata = {
  title,
  description,
  alternates: cnLocaleAlternates("/patterns", "/cn/patterns"),
  ...cnSocialMeta({
    title: "常用正则库 | Forge Regex",
    description: "可测的高频正则起点，在 Forge 用中文继续改写。",
    path: "/cn/patterns",
  }),
};

export default function CnPatternsIndexPage() {
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Forge Regex 常用正则库",
    itemListElement: PATTERNS.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.zh.h1,
      url: absoluteUrl(patternPath(p, "zh")),
    })),
  };
  return (
    <>
      <JsonLd data={itemList} />
      <PatternIndex locale="zh" />
    </>
  );
}
