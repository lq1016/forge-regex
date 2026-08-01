import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PatternArticle } from "@/components/PatternPages";
import {
  allPatternSlugs,
  getPatternBySlug,
  patternPath,
} from "@/lib/patterns";
import { localeAlternates } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return allPatternSlugs("en").map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = getPatternBySlug(slug, "en");
  if (!p) return {};
  return {
    title: p.en.title,
    description: p.en.description,
    alternates: localeAlternates(patternPath(p, "en"), patternPath(p, "zh")),
    openGraph: {
      title: p.en.title,
      description: p.en.description,
    },
  };
}

export default async function PatternPage({ params }: Props) {
  const { slug } = await params;
  const p = getPatternBySlug(slug, "en");
  if (!p) notFound();
  return <PatternArticle pattern={p} locale="en" />;
}
