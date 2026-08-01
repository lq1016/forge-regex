/** Absolute site origin for SEO (sitemap, canonical, OG). */
export function siteOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://regex.ststudio.top";
  return raw.replace(/\/$/, "");
}

export function absoluteUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${siteOrigin()}${p === "/" ? "" : p}` || siteOrigin();
}

/** hreflang alternates for a logical page (EN path + CN path). */
export function localeAlternates(enPath: string, zhPath: string) {
  return {
    canonical: absoluteUrl(enPath),
    languages: {
      en: absoluteUrl(enPath),
      "zh-CN": absoluteUrl(zhPath),
      "x-default": absoluteUrl(enPath),
    },
  };
}

export function cnLocaleAlternates(enPath: string, zhPath: string) {
  return {
    canonical: absoluteUrl(zhPath),
    languages: {
      en: absoluteUrl(enPath),
      "zh-CN": absoluteUrl(zhPath),
      "x-default": absoluteUrl(enPath),
    },
  };
}

/** Default Chinese Open Graph / Twitter for /cn pages. */
export function cnSocialMeta(input: {
  title: string;
  description: string;
  path: string;
}) {
  const url = absoluteUrl(input.path);
  return {
    openGraph: {
      type: "website" as const,
      locale: "zh_CN",
      url,
      siteName: "Forge Regex",
      title: input.title,
      description: input.description,
    },
    twitter: {
      card: "summary_large_image" as const,
      title: input.title,
      description: input.description,
    },
  };
}
