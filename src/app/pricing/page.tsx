import type { Metadata } from "next";
import { PricingClient } from "./PricingClient";
import { localeAlternates } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Pricing — Forge Regex",
  description:
    "Free and Pro plans for Forge Regex. Subscribe with Paddle — card, PayPal, and more.",
  alternates: localeAlternates("/pricing", "/cn/pricing"),
};

export default function PricingPage() {
  return <PricingClient />;
}
