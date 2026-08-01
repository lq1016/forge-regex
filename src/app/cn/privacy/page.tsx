import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { cnLocaleAlternates, cnSocialMeta } from "@/lib/seo";

const title = "隐私政策";
const description = "Forge Regex 中国版如何收集、使用与保护您的信息。";

export const metadata: Metadata = {
  title,
  description,
  alternates: cnLocaleAlternates("/privacy", "/cn/privacy"),
  ...cnSocialMeta({
    title: `${title} — Forge Regex 中国版`,
    description,
    path: "/cn/privacy",
  }),
};

export default function CnPrivacyPage() {
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
          隐私政策
        </h1>
        <p className="text-sm text-subtle mb-10">最近更新：2026 年 7 月 30 日</p>

        <div className="prose-legal space-y-8 text-[15px] text-muted leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-ink mb-2">概述</h2>
            <p>
              Forge Regex（「我们」）通过本网站提供 AI 辅助的正则表达式生成服务。本政策说明我们收集哪些信息以及如何使用。
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">我们收集的信息</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <span className="text-ink">使用提示词</span>
                — 您为生成正则而提交的自然语言描述。
              </li>
              <li>
                <span className="text-ink">账号信息</span>
                — 注册/登录使用的邮箱，以及经哈希处理的密码（我们不以明文保存密码）。
              </li>
              <li>
                <span className="text-ink">使用额度</span>
                — 用于统计免费次数的会话 Cookie、设备指纹（仅用于防滥用）与服务端计数。
              </li>
              <li>
                <span className="text-ink">技术日志</span>
                — 常规服务器日志（IP、User-Agent、时间戳），用于安全与稳定性。
              </li>
              <li>
                <span className="text-ink">支付相关</span>
                — 中国版通过微信 / 支付宝收款；海外版可能通过 Paddle。我们不在自有服务器保存完整银行卡号。订单邮箱与支付渠道订单号会用于开通 Pro。
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">信息用途</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>按您的请求生成并返回正则表达式</li>
              <li>执行免费额度限制并防止滥用</li>
              <li>运营、保障与改进服务</li>
              <li>处理订阅/开通 Pro，以及客户支持</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">第三方处理方</h2>
            <p>
              我们使用基础设施与 AI 模型服务商运行产品。您提交的提示词可能被发送至 AI 服务商，仅用于完成您的生成请求。支付由微信、支付宝或 Paddle 等合作方处理。
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">Cookie</h2>
            <p>
              我们使用必要的登录与额度 Cookie。不使用第三方广告 Cookie。
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">保存期限</h2>
            <p>
              额度相关数据按日统计；服务器日志仅在安全与运维所需期限内保留。如需删除账号相关数据，可通过下方邮箱联系我们。
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">联系我们</h2>
            <p>
              隐私相关问题：{" "}
              <a
                className="text-accent hover:underline"
                href="mailto:coderlau@live.com"
              >
                coderlau@live.com
              </a>
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
