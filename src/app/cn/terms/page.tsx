import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { cnLocaleAlternates, cnSocialMeta } from "@/lib/seo";

const title = "服务条款";
const description = "Forge Regex 中国版服务使用条款。";

export const metadata: Metadata = {
  title,
  description,
  alternates: cnLocaleAlternates("/terms", "/cn/terms"),
  ...cnSocialMeta({
    title: `${title} — Forge Regex 中国版`,
    description,
    path: "/cn/terms",
  }),
};

export default function CnTermsPage() {
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
          服务条款
        </h1>
        <p className="text-sm text-subtle mb-10">最近更新：2026 年 7 月 30 日</p>

        <div className="space-y-8 text-[15px] text-muted leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-ink mb-2">1. 服务说明</h2>
            <p>
              Forge Regex 是一项在线工具，可帮助您用自然语言描述生成并测试正则表达式。使用本网站即表示您同意本条款。
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              2. 账号与免费额度
            </h2>
            <p>
              您可在未登录时使用有限试用次数；登录后可获得每日免费额度。我们可能调整额度以保护服务稳定与公平使用。
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">3. 付费与开通</h2>
            <p className="mb-3">
              <span className="text-ink font-medium">中国版（/cn）</span>
              ：通过微信、支付宝等支付开通 Pro（通常按约 31 天计，可叠加）。价格以购买页展示为准。
            </p>
            <p>
              <span className="text-ink font-medium">海外英文站</span>
              ：订阅可能由 Paddle.com 作为 Merchant of Record 处理结账与税务。中国版购买与海外订阅相互独立，不互通权益。
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">4. 合理使用</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>不得滥用、爬取或规避额度限制</li>
              <li>不得将服务用于违法用途</li>
              <li>不得提交您无权处理的内容</li>
              <li>
                生成的正则按「现状」提供；您有责任在自己的系统中验证后再使用
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">5. 知识产权</h2>
            <p>
              Forge Regex 名称、品牌与站点软件归我们所有。在遵守本条款的前提下，您可将为您生成的正则用于自有项目。
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">6. 免责声明</h2>
            <p>
              服务按「现状」提供，不作任何明示或默示保证。AI 生成结果可能不完整或不正确。在法律允许的最大范围内，我们不对因依赖生成结果产生的损失承担责任。
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">7. 变更</h2>
            <p>
              我们可能不时更新本条款。变更后继续使用，即视为接受更新后的条款。
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">8. 联系</h2>
            <p>
              支持邮箱：{" "}
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
