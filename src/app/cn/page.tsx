import type { Metadata } from "next";
import { ForgeHome } from "@/components/ForgeHome";
import { JsonLd } from "@/components/JsonLd";
import { faqLd, softwareApplicationLd, websiteLd } from "@/lib/jsonld";
import { cnLocaleAlternates, cnSocialMeta } from "@/lib/seo";

const title = "Forge Regex 中国版 — 用中文生成正则表达式";
const description =
  "用中文描述规则，得到可用正则。支持实时测试、逐段解释、替换预览与代码导出。微信 / 支付宝开通 Pro。";

export const metadata: Metadata = {
  title: {
    absolute: title,
  },
  description,
  alternates: cnLocaleAlternates("/", "/cn"),
  ...cnSocialMeta({
    title: "Forge Regex 中国版 — 用中文生成正则",
    description:
      "别再死磕正则语法。说出你要匹配什么——Forge 帮你锻造可用表达式。",
    path: "/cn",
  }),
};

export default function CnHome() {
  return (
    <>
      <JsonLd
        data={[websiteLd("zh"), softwareApplicationLd("zh"), faqLd("zh")]}
      />
      <ForgeHome locale="zh" basePath="/cn" />
    </>
  );
}
