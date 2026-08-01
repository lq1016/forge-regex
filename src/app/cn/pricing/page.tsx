import type { Metadata } from "next";
import { CnPricingClient } from "./PricingClient";
import { cnLocaleAlternates, cnSocialMeta } from "@/lib/seo";

const title = "定价 — Forge Regex 中国版";
const description =
  "Forge Regex 中国版：微信扫码 / 支付宝网站支付 ¥9.9/月 Pro。";

export const metadata: Metadata = {
  title,
  description,
  alternates: cnLocaleAlternates("/pricing", "/cn/pricing"),
  ...cnSocialMeta({
    title: "定价 — Forge Regex 中国版",
    description,
    path: "/cn/pricing",
  }),
};

export default function CnPricingPage() {
  return <CnPricingClient />;
}
