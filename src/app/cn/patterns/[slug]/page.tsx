import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PatternArticle } from "@/components/PatternPages";
import {
  allPatternSlugs,
  getPatternBySlug,
  patternPath,
} from "@/lib/patterns";
import { cnLocaleAlternates } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return allPatternSlugs("zh").map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = getPatternBySlug(slug, "zh");
  if (!p) return {};
  return {
    title: p.zh.title,
    description: p.zh.description,
    alternates: cnLocaleAlternates(patternPath(p, "en"), patternPath(p, "zh")),
    openGraph: {
      title: p.zh.title,
      description: p.zh.description,
    },
  };
}

export default async function CnPatternPage({ params }: Props) {
  const { slug } = await params;
  const p = getPatternBySlug(slug, "zh");
  if (!p) notFound();
  return <PatternArticle pattern={p} locale="zh" />;
}
