export type PatternLocale = "en" | "zh";

export type PatternPage = {
  /** URL slug (ASCII), shared across locales when paired */
  slug: string;
  /** CN-only slug when different; defaults to slug */
  slugZh?: string;
  en: {
    title: string;
    description: string;
    h1: string;
    prompt: string;
    body: string[];
    sample: string;
  };
  zh: {
    title: string;
    description: string;
    h1: string;
    prompt: string;
    body: string[];
    sample: string;
  };
  pattern: string;
  flags: string;
  explanation: { token: string; descriptionEn: string; descriptionZh: string }[];
};

export const PATTERNS: PatternPage[] = [
  {
    slug: "email",
    en: {
      title: "Email Regex — Generate & Test Online | Forge Regex",
      description:
        "Working email address regex with live test samples. Generate email patterns from plain English with Forge Regex.",
      h1: "Email address regex",
      prompt: "match email addresses",
      body: [
        "Email patterns look simple until you hit plus-tags, subdomains, or country TLDs.",
        "Use the expression below as a practical starting point, then open Forge to tweak flags, test your own corpus, and export to JS or Python.",
      ],
      sample:
        "Contact alice@example.com or bob.smith+dev@acme.co.uk today. Skip not-an-email and the bare @domain.com.",
    },
    zh: {
      title: "邮箱正则表达式在线生成与测试 | Forge Regex",
      description:
        "可用的邮箱地址正则，支持实时样例测试。用中文描述即可在 Forge Regex 生成并导出。",
      h1: "邮箱地址正则",
      prompt: "匹配邮箱地址",
      body: [
        "邮箱正则看起来简单，但加上号别名、子域、国家后缀后很容易写漏。",
        "下面给出实用起点；可在 Forge 里继续改标志位、贴自己的文本测试，并导出 JS / Python。",
      ],
      sample:
        "发到 zhang@qq.com 或 hello.dev@company.cn。跳过 not-an-email 和 @domain。",
    },
    pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
    flags: "g",
    explanation: [
      {
        token: "[a-zA-Z0-9._%+-]+",
        descriptionEn: "Local part",
        descriptionZh: "邮箱本地部分",
      },
      { token: "@", descriptionEn: "Separator", descriptionZh: "@ 分隔符" },
      {
        token: "[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
        descriptionEn: "Domain + TLD",
        descriptionZh: "域名与后缀",
      },
    ],
  },
  {
    slug: "url",
    en: {
      title: "URL Regex — Extract Links from Text | Forge Regex",
      description:
        "Regex to match http/https URLs. Test live and generate variants from plain language.",
      h1: "URL / link regex",
      prompt: "match http and https URLs in text",
      body: [
        "Useful for crawlers, log cleaning, and chat scrapers when you need a quick URL pull without a full HTML parser.",
        "This pattern favors http(s) absolute links; open Forge if you also need www-only or markdown links.",
      ],
      sample:
        "See https://example.com/a?x=1 and http://news.cn/path. Ignore example.com without a scheme.",
    },
    zh: {
      title: "URL 链接正则 — 从文本提取网址 | Forge Regex",
      description:
        "匹配 http/https 链接的正则，可在线测试。适合爬虫与日志清洗的快速抽取。",
      h1: "URL / 链接正则",
      prompt: "匹配文本中的 http 和 https 链接",
      body: [
        "适合爬虫、日志清洗、聊天记录抽链——不想上完整 HTML 解析器时的快刀。",
        "本模式偏向带协议的绝对链接；若还要 www 或 Markdown 链接，可在 Forge 用中文再生成一版。",
      ],
      sample:
        "参见 https://example.com/a?x=1 与 http://news.cn/path。忽略没有协议的 example.com。",
    },
    pattern:
      "https?:\\/\\/[^\\s\"'<>\\u4e00-\\u9fff\\u3000-\\u303f\\uff00-\\uffef]+(?<![.,;:!?])",
    flags: "gi",
    explanation: [
      {
        token: "https?",
        descriptionEn: "http or https",
        descriptionZh: "http 或 https",
      },
      {
        token: ":\\/\\/",
        descriptionEn: "Scheme separator",
        descriptionZh: "协议分隔",
      },
      {
        token: "[^\\s\"'<>…]+(?<![.,;:])",
        descriptionEn: "URL body; no CJK / trailing punctuation",
        descriptionZh: "URL 主体；不含中文与尾部标点",
      },
    ],
  },
  {
    slug: "ipv4",
    en: {
      title: "IPv4 Regex — Match IP Addresses | Forge Regex",
      description:
        "Regex for IPv4 addresses (0–255 octets). Generate and test with Forge Regex.",
      h1: "IPv4 address regex",
      prompt: "match IPv4 addresses",
      body: [
        "Validates four octets in the 0–255 range—better than a naive \\d+\\.\\d+ pattern that accepts 999.1.1.1.",
      ],
      sample:
        "Servers at 192.168.1.1, 10.0.0.42, and 8.8.8.8. Invalid: 999.1.1.1 and 1.2.3.",
    },
    zh: {
      title: "IPv4 正则表达式 — 匹配 IP 地址 | Forge Regex",
      description: "匹配合法 IPv4（每段 0–255）的正则，可在线测试与导出。",
      h1: "IPv4 地址正则",
      prompt: "匹配 IPv4 地址",
      body: [
        "校验四段 0–255，比简单的 \\d+\\.\\d+ 更稳，不会把 999.1.1.1 当成合法 IP。",
      ],
      sample:
        "服务器 192.168.1.1、10.0.0.42、8.8.8.8。无效：999.1.1.1、1.2.3。",
    },
    pattern:
      "\\b(?:(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)\\b",
    flags: "g",
    explanation: [
      {
        token: "(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)",
        descriptionEn: "One octet 0–255",
        descriptionZh: "一段 0–255",
      },
    ],
  },
  {
    slug: "iso-date",
    en: {
      title: "ISO Date Regex (YYYY-MM-DD) | Forge Regex",
      description:
        "Match ISO-8601 calendar dates YYYY-MM-DD with a tested regular expression.",
      h1: "ISO date (YYYY-MM-DD) regex",
      prompt: "match ISO dates YYYY-MM-DD",
      body: [
        "Anchored-style date matching for logs and filenames. Does not validate all calendar edge cases (e.g. Feb 30).",
      ],
      sample:
        "Shipped on 2024-03-15, due 2025-12-01. Ignore 03/15/2024 and 2024-13-40.",
    },
    zh: {
      title: "ISO 日期正则 YYYY-MM-DD | Forge Regex",
      description: "匹配 ISO 日期 YYYY-MM-DD 的正则，适合日志与文件名抽取。",
      h1: "ISO 日期（YYYY-MM-DD）正则",
      prompt: "匹配 ISO 日期 YYYY-MM-DD",
      body: [
        "适合日志、文件名。不保证排斥所有非法日历日（如 2 月 30 日）。",
      ],
      sample:
        "发货 2024-03-15，到期 2025-12-01。忽略 03/15/2024 与 2024-13-40。",
    },
    pattern:
      "\\b(?:19|20)\\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])\\b",
    flags: "g",
    explanation: [
      {
        token: "(?:19|20)\\d{2}",
        descriptionEn: "Year 1900–2099",
        descriptionZh: "年份 1900–2099",
      },
      {
        token: "(?:0[1-9]|1[0-2])",
        descriptionEn: "Month 01–12",
        descriptionZh: "月份 01–12",
      },
      {
        token: "(?:0[1-9]|[12]\\d|3[01])",
        descriptionEn: "Day 01–31",
        descriptionZh: "日期 01–31",
      },
    ],
  },
  {
    slug: "us-phone",
    en: {
      title: "US Phone Number Regex | Forge Regex",
      description:
        "Regular expression for US phone numbers with optional +1 and separators.",
      h1: "US phone number regex",
      prompt: "match US phone numbers",
      body: [
        "Covers common (415) 555-0132 / 415-555-0198 / +1 forms. Not a carrier-grade validator.",
      ],
      sample:
        "Call (415) 555-0132, or 415-555-0198, or +1 212 555 0100. Not a phone: 12345.",
    },
    zh: {
      title: "美国电话号码正则 | Forge Regex",
      description: "匹配美式电话号码的正则（可选 +1 与常见分隔符）。",
      h1: "美国电话号码正则",
      prompt: "匹配美国电话号码",
      body: ["覆盖常见格式；不是运营商级校验。国内手机号请看「中国手机号」页。"],
      sample:
        "Call (415) 555-0132, or 415-555-0198, or +1 212 555 0100. Not: 12345.",
    },
    pattern:
      "(?:\\+1[-.\\s]?)?(?:\\(?\\d{3}\\)?[-.\\s]?)\\d{3}[-.\\s]?\\d{4}",
    flags: "g",
    explanation: [
      {
        token: "(?:\\+1[-.\\s]?)?",
        descriptionEn: "Optional +1",
        descriptionZh: "可选国家码 +1",
      },
    ],
  },
  {
    slug: "html-href",
    slugZh: "html-href",
    en: {
      title: "Extract HTML href Regex (a tags) | Forge Regex",
      description:
        "Regex to extract href values from anchor tags, supporting single and double quotes.",
      h1: "HTML a[href] extractor regex",
      prompt: "extract href from HTML a tags, single or double quotes",
      body: [
        "A classic crawler helper. Prefer a real HTML parser for messy DOM; use regex for quick list-page link grabs.",
      ],
      sample: `<a href="https://example.com/a">A</a>
<a href='/rel'>B</a>
<span>href=notquoted</span>`,
    },
    zh: {
      title: "提取 HTML a 标签 href 的正则 | Forge Regex",
      description:
        "从 a 标签提取 href，兼容单双引号。适合列表页爬虫快速抽链。",
      h1: "HTML a[href] 提取正则",
      prompt: "从 HTML 提取 a 标签的 href，兼容单双引号",
      body: [
        "爬虫经典需求。复杂嵌套 DOM 请用解析器；列表页批量抽链用正则更快。",
      ],
      sample: `<a href="https://example.com/a">A</a>
<a href='/rel'>B</a>
<span>href=notquoted</span>`,
    },
    pattern: "(?<=href\\s*=\\s*['\"])[^'\"]+",
    flags: "gi",
    explanation: [
      {
        token: "(?<=href\\s*=\\s*['\"])",
        descriptionEn: "After href= and opening quote (lookbehind)",
        descriptionZh: "紧跟 href= 与开引号之后（后行断言）",
      },
      {
        token: "[^'\"]+",
        descriptionEn: "Full match is the URL value",
        descriptionZh: "整段匹配即为 URL 值",
      },
    ],
  },
  {
    slug: "strip-html",
    en: {
      title: "Strip HTML Tags Regex | Forge Regex",
      description:
        "Remove HTML tags with a simple regex—useful for rough article cleanup after crawling.",
      h1: "Strip HTML tags regex",
      prompt: "remove all HTML tags leave plain text",
      body: [
        "Replace matches with an empty string. Strip script/style blocks first on hostile pages. Not a sanitizer.",
      ],
      sample: "<p>Hello <em>world</em></p><div>Next</div>",
    },
    zh: {
      title: "去除 HTML 标签正则 | Forge Regex",
      description: "用正则去掉 HTML 标签、粗清洗爬虫正文。替换为空即可。",
      h1: "去除 HTML 标签正则",
      prompt: "去掉所有 HTML 标签只保留纯文本",
      body: [
        "匹配后替换为空字符串。恶意页请先去掉 script/style。这不是 XSS 过滤器。",
      ],
      sample: "<p>你好 <em>世界</em></p><div>下一段</div>",
    },
    pattern: "<[^>]+>",
    flags: "g",
    explanation: [
      {
        token: "<[^>]+>",
        descriptionEn: "Any tag",
        descriptionZh: "任意标签",
      },
    ],
  },
  {
    slug: "cn-mobile",
    slugZh: "china-mobile",
    en: {
      title: "China Mobile Phone Regex | Forge Regex",
      description:
        "Regex for mainland China mobile numbers (11 digits, optional +86).",
      h1: "China mobile number regex",
      prompt: "match China mainland mobile phone numbers",
      body: [
        "Matches common 1[3-9]********* forms with optional +86 prefix.",
      ],
      sample:
        "Contact 13812345678 or +86 15900001111. Invalid: 12345, 12800001111.",
    },
    zh: {
      title: "中国手机号正则表达式 | Forge Regex",
      description:
        "匹配中国大陆 11 位手机号（可选 +86）的正则，在线测试与中文生成。",
      h1: "中国手机号正则",
      prompt: "匹配中国大陆手机号",
      body: ["覆盖常见 1[3-9] 号段，支持可选 +86 前缀。"],
      sample:
        "联系 13812345678、+86 15900001111。无效：12345、12800001111。",
    },
    pattern: "(?:\\+?86[-\\s]?)?1[3-9]\\d{9}",
    flags: "g",
    explanation: [
      {
        token: "(?:\\+?86[-\\s]?)?",
        descriptionEn: "Optional +86",
        descriptionZh: "可选国家码",
      },
      {
        token: "1[3-9]\\d{9}",
        descriptionEn: "11-digit mobile",
        descriptionZh: "11 位手机号",
      },
    ],
  },
  {
    slug: "cn-id",
    slugZh: "china-id-card",
    en: {
      title: "China ID Card Regex | Forge Regex",
      description: "Regex for 18-digit mainland China resident ID numbers.",
      h1: "China ID card regex",
      prompt: "match China 18-digit national ID numbers",
      body: [
        "Structural match for 18-char IDs ending in digit or X. Does not verify the checksum digit.",
      ],
      sample:
        "IDs: 11010119900307891X, 44030119851212001X. Invalid: 123456, 1101011990030789123.",
    },
    zh: {
      title: "身份证号正则表达式 | Forge Regex",
      description: "匹配中国大陆 18 位身份证号的正则（末位数字或 X）。",
      h1: "身份证号正则",
      prompt: "匹配中国大陆 18 位身份证号",
      body: ["结构匹配；不含校验位算法验证。避免把更长数字串的前 18 位当成证件号。"],
      sample:
        "证件：11010119900307891X、44030119851212001X。无效：123456、1101011990030789123。",
    },
    pattern:
      "(?<!\\d)[1-9]\\d{5}(?:19|20)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx](?!\\d)",
    flags: "g",
    explanation: [
      {
        token: "[1-9]\\d{5}",
        descriptionEn: "Region code",
        descriptionZh: "地区码",
      },
      {
        token: "(?<!\\d)…(?!\\d)",
        descriptionEn: "Not part of a longer digit run",
        descriptionZh: "避免匹配更长数字串的前缀",
      },
    ],
  },
  {
    slug: "img-src",
    en: {
      title: "Extract img src / data-src Regex | Forge Regex",
      description:
        "Pull image URLs from HTML img tags including lazy-loaded data-src.",
      h1: "HTML img src / data-src regex",
      prompt: "extract img src and data-src from HTML",
      body: [
        "Handy for scrapers dealing with lazy-loaded carousels. Capture group holds the URL.",
      ],
      sample: `<img src="https://cdn.example.com/a.jpg" />
<img data-src='https://cdn.example.com/lazy.webp' class="lazy" />`,
    },
    zh: {
      title: "提取 img src / data-src 正则 | Forge Regex",
      description: "从 HTML 提取图片地址，兼容 src 与懒加载 data-src。",
      h1: "img src / data-src 提取正则",
      prompt: "从 HTML 提取 img 的 src 和 data-src",
      body: ["适合懒加载列表页。捕获组为图片 URL。"],
      sample: `<img src="https://cdn.example.com/a.jpg" />
<img data-src='https://cdn.example.com/lazy.webp' class="lazy" />`,
    },
    pattern: "(?<=(?:data-src|src)\\s*=\\s*['\"])[^'\"]+",
    flags: "gi",
    explanation: [
      {
        token: "(?<=(?:data-src|src)\\s*=\\s*['\"])",
        descriptionEn: "After src or data-src quote (lookbehind)",
        descriptionZh: "紧跟 src / data-src 引号后",
      },
      {
        token: "[^'\"]+",
        descriptionEn: "Full match is the image URL",
        descriptionZh: "整段匹配即为图片 URL",
      },
    ],
  },
  {
    slug: "meta-description",
    en: {
      title: "Meta Description Regex — Extract from HTML | Forge Regex",
      description:
        "Regex to pull meta name=description content from HTML. Test live and refine in Forge.",
      h1: "HTML meta description regex",
      prompt: "extract meta description content from HTML",
      body: [
        "Useful when scraping SEO snippets from listing pages. Prefer matching the content value only.",
        "Open Forge to tighten quote styles or swap to og:description variants.",
      ],
      sample: `<meta name="description" content="Ship regex faster." />
<meta name='description' content='Alternate quotes work too.' />
<meta name="viewport" content="width=device-width" />`,
    },
    zh: {
      title: "提取 meta description 正则 | Forge Regex",
      description: "从 HTML 抽取 meta description 的 content 值，可在 Forge 在线测试与改写。",
      h1: "meta description 提取正则",
      prompt: "从 HTML 提取 meta description 的 content",
      body: [
        "适合列表页/详情页抓 SEO 摘要。优先让整段匹配就是 content 值。",
        "可在 Forge 里收紧引号写法，或改成 og:description。",
      ],
      sample: `<meta name="description" content="更快写出可用正则。" />
<meta name='description' content='单引号也可。' />
<meta name="viewport" content="width=device-width" />`,
    },
    pattern: "(?<=name\\s*=\\s*['\"]description['\"][^>]*content\\s*=\\s*['\"])[^'\"]+",
    flags: "i",
    explanation: [
      {
        token: "(?<=name\\s*=\\s*['\"]description['\"][^>]*content\\s*=\\s*['\"])",
        descriptionEn: "After description meta's content quote",
        descriptionZh: "紧跟 description 的 content 引号后",
      },
      {
        token: "[^'\"]+",
        descriptionEn: "Full match is the description text",
        descriptionZh: "整段匹配即为描述文案",
      },
    ],
  },
  {
    slug: "next-page",
    slugZh: "next-page",
    en: {
      title: "Next Page Link Regex — Crawl Pagination | Forge Regex",
      description:
        "Match pagination next links (rel=next or common next text) for crawlers.",
      h1: "Next-page / pagination link regex",
      prompt: "extract next page href from HTML pagination",
      body: [
        "Crawlers often need the next list URL. This starting point looks for rel=next; refine in Forge for site-specific copy like 「下一页」.",
      ],
      sample: `<link rel="next" href="/page/2" />
<a rel='next' href='/items?page=3'>Next</a>
<a href="/page/2">Skip me</a>`,
    },
    zh: {
      title: "下一页链接正则 — 爬虫翻页 | Forge Regex",
      description: "匹配分页下一页链接（rel=next 等），可在 Forge 按站点文案改写。",
      h1: "下一页 / 翻页链接正则",
      prompt: "从 HTML 分页里提取下一页的 href",
      body: [
        "列表爬虫常要下一页 URL。起点优先 rel=next；站点写「下一页」时可在 Forge 一键改写。",
      ],
      sample: `<link rel="next" href="/page/2" />
<a rel='next' href='/items?page=3'>下一页</a>
<a href="/page/2">普通链接</a>`,
    },
    pattern: "(?<=rel\\s*=\\s*['\"]next['\"][^>]*href\\s*=\\s*['\"])[^'\"]+",
    flags: "i",
    explanation: [
      {
        token: "(?<=rel\\s*=\\s*['\"]next['\"][^>]*href\\s*=\\s*['\"])",
        descriptionEn: "After rel=next … href quote",
        descriptionZh: "紧跟 rel=next 的 href 引号后",
      },
      {
        token: "[^'\"]+",
        descriptionEn: "Full match is the next URL",
        descriptionZh: "整段匹配即为下一页 URL",
      },
    ],
  },
];

export function patternPath(p: PatternPage, locale: PatternLocale): string {
  if (locale === "zh") {
    const slug = p.slugZh || p.slug;
    return `/cn/patterns/${slug}`;
  }
  return `/patterns/${p.slug}`;
}

export function getPatternBySlug(
  slug: string,
  locale: PatternLocale
): PatternPage | undefined {
  return PATTERNS.find((p) => {
    if (locale === "zh") return (p.slugZh || p.slug) === slug || p.slug === slug;
    return p.slug === slug;
  });
}

export function allPatternSlugs(locale: PatternLocale): string[] {
  return PATTERNS.map((p) =>
    locale === "zh" ? p.slugZh || p.slug : p.slug
  );
}
