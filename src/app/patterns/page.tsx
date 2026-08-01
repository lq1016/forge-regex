import type { Metadata } from "next";
import { PatternIndex } from "@/components/PatternPages";
import { JsonLd } from "@/components/JsonLd";
import { PATTERNS, patternPath } from "@/lib/patterns";
import { absoluteUrl, localeAlternates } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Regex Pattern Library | Forge Regex",
  description:
    "Ready-to-use regex patterns for email, URL, IPv4, dates, HTML scraping, and more—with live samples.",
  alternates: localeAlternates("/patterns", "/cn/patterns"),
  openGraph: {
    title: "Regex Pattern Library | Forge Regex",
    description:
      "Tested regex starting points for common developer tasks. Tweak any pattern in Forge.",
  },
};

export default function PatternsIndexPage() {
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Forge Regex pattern library",
    itemListElement: PATTERNS.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.en.h1,
      url: absoluteUrl(patternPath(p, "en")),
    })),
  };
  return (
    <>
      <JsonLd data={itemList} />
      <PatternIndex locale="en" />
    </>
  );
}
