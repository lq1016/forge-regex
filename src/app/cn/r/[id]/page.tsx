import type { Metadata } from "next";
import { ShareView } from "@/app/r/[id]/ShareView";

export const metadata: Metadata = {
  title: "分享的正则",
  description: "来自 Forge Regex 的分享链接。",
};

export default async function CnSharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ShareView id={id} />;
}
