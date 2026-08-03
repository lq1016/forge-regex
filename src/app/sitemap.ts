import type { MetadataRoute } from "next";
import { PATTERNS, patternPath } from "@/lib/patterns";
import { siteOrigin } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  const now = new Date();

  // EN host only — CN lives on www.ststudio.top/works/forge-regex
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: origin, lastModified: now, changeFrequency: "weekly", priority: 1 },
    {
      url: `${origin}/pricing`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${origin}/patterns`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${origin}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${origin}/refund`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];

  const patternRoutes: MetadataRoute.Sitemap = PATTERNS.map((p) => ({
    url: `${origin}${patternPath(p, "en")}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.85,
  }));

  return [...staticRoutes, ...patternRoutes];
}
