import type { Metadata } from "next";
import { ShareView } from "./ShareView";

export const metadata: Metadata = {
  title: "Shared regex — Forge Regex",
  description: "A shared regular expression from Forge Regex.",
};

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ShareView id={id} />;
}
