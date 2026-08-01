import type { Metadata } from "next";
import { ForgeHome } from "@/components/ForgeHome";
import { JsonLd } from "@/components/JsonLd";
import { faqLd, softwareApplicationLd, websiteLd } from "@/lib/jsonld";
import { localeAlternates, siteOrigin } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    absolute: "Forge Regex — AI-Powered Regex Builder",
  },
  description:
    "Describe your pattern in plain English. Get a working regex with live testing, explanations, replace preview, and code export.",
  alternates: localeAlternates("/", "/cn"),
  openGraph: {
    url: siteOrigin(),
    title: "Forge Regex — AI-Powered Regex Builder",
    description:
      "Stop wrestling with regex syntax. Say what you want to match — we'll forge a working expression.",
  },
};

export default function Home() {
  return (
    <>
      <JsonLd
        data={[websiteLd("en"), softwareApplicationLd("en"), faqLd("en")]}
      />
      <ForgeHome locale="en" basePath="" />
    </>
  );
}
