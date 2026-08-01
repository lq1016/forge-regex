import { absoluteUrl, siteOrigin } from "@/lib/seo";

type JsonLd = Record<string, unknown>;

export function softwareApplicationLd(locale: "en" | "zh"): JsonLd {
  const isZh = locale === "zh";
  const url = isZh ? absoluteUrl("/cn") : siteOrigin();
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: isZh ? "Forge Regex 中国版" : "Forge Regex",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    url,
    description: isZh
      ? "用中文描述规则，生成可用正则表达式，支持实时测试、解释与代码导出。"
      : "Describe a pattern in plain language and get a working regex with live testing, explanations, and code export.",
    offers: [
      {
        "@type": "Offer",
        price: "0",
        priceCurrency: isZh ? "CNY" : "USD",
        description: isZh ? "免费：未登录试用 2 次，登录后每天 8 次" : "Free: 2 tries as guest, 8/day after sign-in",
      },
      {
        "@type": "Offer",
        price: isZh ? "9.9" : "9",
        priceCurrency: isZh ? "CNY" : "USD",
        description: isZh
          ? "Pro：¥9.9/月（按 31 天计）"
          : "Pro: $9/month via Paddle",
      },
    ],
    inLanguage: isZh ? "zh-CN" : "en",
  };
}

export function faqLd(locale: "en" | "zh"): JsonLd {
  const isZh = locale === "zh";
  const faqs = isZh
    ? [
        {
          q: "Forge Regex 是什么？",
          a: "一个用自然语言（支持中文）生成正则表达式的在线工具，带实时匹配测试、逐段解释、替换预览和多语言代码导出。",
        },
        {
          q: "免费版有什么限制？",
          a: "未登录可试用 2 次 AI 生成；登录后每天 8 次。实时测试与解释可用。需要无限生成可开通 Pro。",
        },
        {
          q: "国内如何付费？",
          a: "中国版 /cn 支持微信扫码与支付宝电脑网站支付开通 Pro，¥9.9/月（按 31 天计，可叠加）。",
        },
        {
          q: "正则能完整解析复杂 HTML 吗？",
          a: "复杂嵌套 DOM 请用 HTML 解析器。正则更适合抽链接、属性、粗清洗正文等场景；站内正则库提供了常用起点。",
        },
      ]
    : [
        {
          q: "What is Forge Regex?",
          a: "An AI regex builder: describe what you want to match in plain language, then test, explain, replace, and export the expression.",
        },
        {
          q: "Is there a free plan?",
          a: "Yes. Try 2 AI generations without signing in; free accounts get 8 per day after email sign-in, plus live testing and explanations. Pro unlocks unlimited generation.",
        },
        {
          q: "How does pricing work?",
          a: "The global site uses Paddle at $9/month. The China edition (/cn) uses WeChat QR and Alipay website checkout at ¥9.9 per month (billed as 31 days, stackable).",
        },
        {
          q: "Should I parse HTML with regex?",
          a: "For messy nested DOM, prefer a real HTML parser. Regex is great for quick href/src extraction and rough cleanup—see our pattern library for starters.",
        },
      ];

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}

export function websiteLd(locale: "en" | "zh"): JsonLd {
  const isZh = locale === "zh";
  const url = isZh ? absoluteUrl("/cn") : siteOrigin();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: isZh ? "Forge Regex 中国版" : "Forge Regex",
    url,
    inLanguage: isZh ? "zh-CN" : "en",
    potentialAction: {
      "@type": "SearchAction",
      target: `${url}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}
