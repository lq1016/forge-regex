import type { Metadata } from "next";
import { LocaleProvider } from "@/components/LocaleProvider";
import { absoluteUrl, cnSocialMeta } from "@/lib/seo";

const cnTitle = "Forge Regex 中国版 — 用中文生成正则表达式";
const cnDescription =
  "用中文描述规则，得到可用正则。支持实时测试、逐段解释、替换预览与代码导出。微信 / 支付宝开通 Pro。";

export const metadata: Metadata = {
  title: {
    default: cnTitle,
    template: "%s | Forge Regex 中国版",
  },
  description: cnDescription,
  ...cnSocialMeta({
    title: "Forge Regex 中国版 — 用中文生成正则",
    description:
      "别再死磕正则语法。说出你要匹配什么——Forge 帮你锻造可用表达式。",
    path: "/cn",
  }),
  alternates: {
    canonical: absoluteUrl("/cn"),
    languages: {
      en: absoluteUrl("/"),
      "zh-CN": absoluteUrl("/cn"),
      "x-default": absoluteUrl("/"),
    },
  },
};

export default function CnLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <LocaleProvider locale="zh" basePath="/cn">
      {children}
    </LocaleProvider>
  );
}
