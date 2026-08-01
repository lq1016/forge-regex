import type { Metadata } from "next";
import "./globals.css";
import { siteOrigin } from "@/lib/seo";

const origin = siteOrigin();

const googleVerify = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
const baiduVerify = process.env.NEXT_PUBLIC_BAIDU_SITE_VERIFICATION?.trim();
const bingVerify = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION?.trim();

const otherVerification: Record<string, string> = {
  ...(baiduVerify ? { "baidu-site-verification": baiduVerify } : {}),
  ...(bingVerify ? { "msvalidate.01": bingVerify } : {}),
};

export const metadata: Metadata = {
  metadataBase: new URL(origin),
  title: {
    default: "Forge Regex — AI-Powered Regex Builder",
    template: "%s | Forge Regex",
  },
  description:
    "Describe your pattern in plain language. Forge Regex writes the regular expression for you, with real-time testing and clear explanations.",
  applicationName: "Forge Regex",
  keywords: [
    "regex",
    "regular expression",
    "AI regex generator",
    "regex builder",
    "regex tester",
    "自然语言正则",
    "正则生成器",
  ],
  authors: [{ name: "Forge Regex" }],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/brand/forge-regex-logo-minimal.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["zh_CN"],
    url: origin,
    siteName: "Forge Regex",
    title: "Forge Regex — AI-Powered Regex Builder",
    description:
      "Stop debugging regex. Describe your pattern and get working regular expressions instantly.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Forge Regex — AI-Powered Regex Builder",
    description:
      "Describe your pattern in plain language and get a working regex with live tests.",
  },
  alternates: {
    canonical: origin,
    languages: {
      en: origin,
      "zh-CN": `${origin}/cn`,
      "x-default": origin,
    },
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    ...(googleVerify ? { google: googleVerify } : {}),
    ...(Object.keys(otherVerification).length
      ? { other: otherVerification }
      : {}),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-dvh flex flex-col font-sans">{children}</body>
    </html>
  );
}
