import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { cnLocaleAlternates, cnSocialMeta } from "@/lib/seo";

const title = "退款政策";
const description = "Forge Regex 中国版 Pro 的取消与退款说明。";

export const metadata: Metadata = {
  title,
  description,
  alternates: cnLocaleAlternates("/refund", "/cn/refund"),
  ...cnSocialMeta({
    title: `${title} — Forge Regex 中国版`,
    description,
    path: "/cn/refund",
  }),
};

export default function CnRefundPage() {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="px-5 sm:px-6 py-4 max-w-3xl mx-auto w-full">
        <Link
          href="/cn"
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          ← Forge Regex 中国版
        </Link>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-5 sm:px-6 pb-16">
        <h1 className="font-display text-3xl font-semibold text-ink tracking-tight mb-2">
          退款政策
        </h1>
        <p className="text-sm text-subtle mb-10">最近更新：2026 年 7 月 30 日</p>

        <div className="space-y-8 text-[15px] text-muted leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-ink mb-2">概述</h2>
            <p>
              Forge Regex Pro 为数字服务。中国版通常通过微信 / 支付宝支付开通；海外英文站可能通过
              Paddle 订阅。本政策说明取消与退款的一般规则。
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">有效期与再次购买</h2>
            <p>
              中国版 Pro 按购买时长计费（通常约 31
              天，可叠加）。到期后可再次购买续期。当前中国版多为单次开通/续期，而非自动扣款订阅。
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">退款</h2>
            <p className="mb-3">
              因服务在支付成功后立即开通，退款将视情况个案处理。一般会考虑在首次购买后{" "}
              <span className="text-ink font-medium">14 天内</span>
              提出、且 Pro 功能使用较少的申请。
            </p>
            <p>
              若存在错扣、重复扣款或未授权支付，请尽快联系我们，我们会协助核查处理。
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">如何申请</h2>
            <p>
              请发送邮件至{" "}
              <a
                className="text-accent hover:underline"
                href="mailto:coderlau@live.com"
              >
                coderlau@live.com
              </a>
              ，并注明：购买邮箱、支付渠道（微信 / 支付宝 / Paddle）、大致支付时间与订单号（如有）。
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">免费版</h2>
            <p>免费额度不涉及付费，不适用退款。</p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
