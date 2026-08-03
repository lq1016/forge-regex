"""Capture fresh CN site screenshots for Xiaohongshu (3:4), review only — do not publish.

Usage:
  cd forge-regex
  ../jiyi/github-to-xhs/.venv/bin/python scripts/capture_xhs_shots.py
"""

from __future__ import annotations

from pathlib import Path

from playwright.sync_api import Page, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "content" / "cn-marketing" / "assets"
BASE = "https://regex.ststudio.top/cn"
# 小红书常用 3:4，稍高清
VW, VH = 810, 1080
SCALE = 2


def shot(page: Page, name: str) -> Path:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    page.wait_for_timeout(400)
    page.screenshot(path=str(path), type="png", full_page=False)
    print(f"wrote {path} ({path.stat().st_size // 1024}KB)")
    return path


def fill_and_generate(page: Page, prompt: str) -> None:
    box = page.locator("#pattern-prompt")
    box.click()
    box.fill(prompt)
    page.get_by_role("button", name="生成").click()
    page.get_by_text("生成的正则", exact=False).first.wait_for(state="visible", timeout=45000)
    page.wait_for_timeout(800)


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": VW, "height": VH},
            device_scale_factor=SCALE,
            locale="zh-CN",
        )
        page = context.new_page()

        # 1) 首页空态
        page.goto(BASE, wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(1000)
        shot(page, "xhs-01-home.png")

        # 2) 抽 href：结果 + 高亮匹配
        fill_and_generate(page, "从 HTML 提取 a 的 href，兼容单双引号")
        page.locator("text=用文本测试").first.scroll_into_view_if_needed()
        page.wait_for_timeout(500)
        # 把视口锚到结果区上方一点，露出提示词+正则+测试
        page.evaluate(
            """() => {
              const el = document.querySelector('#pattern-prompt');
              if (el) el.scrollIntoView({ block: 'start' });
              window.scrollBy(0, -8);
            }"""
        )
        page.wait_for_timeout(400)
        shot(page, "xhs-02-href.png")

        # 3) 去标签 + 替换预览（替换为空 → 清洗正文）
        page.goto(BASE, wait_until="networkidle", timeout=60000)
        fill_and_generate(page, "去掉所有 HTML 标签只保留纯文本")
        replace_input = page.locator("label:has-text('替换为')").locator(
            "xpath=following-sibling::input[1]"
        )
        if replace_input.count() == 0:
            replace_input = page.locator("section").filter(has_text="替换为").locator("input").first
        replace_input.wait_for(state="visible", timeout=10000)
        replace_input.click()
        replace_input.fill("")
        page.wait_for_timeout(500)
        page.locator("text=用文本测试").first.scroll_into_view_if_needed()
        page.wait_for_timeout(300)
        page.evaluate("window.scrollBy(0, 140)")
        shot(page, "xhs-03-replace.png")

        # 4) 导出多语言代码（Python）
        page.evaluate(
            """() => {
              const h = [...document.querySelectorAll('h2')].find(n => n.textContent?.includes('导出'));
              if (h) {
                h.closest('section')?.scrollIntoView({ block: 'start' });
                window.scrollBy(0, -16);
              }
            }"""
        )
        page.wait_for_timeout(200)
        py = page.get_by_role("button", name="Python")
        if py.count():
            py.first.click()
            page.wait_for_timeout(300)
        shot(page, "xhs-04-export.png")

        # 5) 定价
        page.goto(f"{BASE}/pricing", wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(1000)
        page.evaluate("window.scrollTo(0, 0)")
        shot(page, "xhs-05-price.png")

        browser.close()

    print("done — review files in content/cn-marketing/assets/xhs-*.png (not published)")


if __name__ == "__main__":
    main()
