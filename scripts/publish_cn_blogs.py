#!/usr/bin/env python3
"""Publish Forge Regex soft articles to platforms with available Edge login cookies.

Currently:
  - Zhihu zhuanlan (logged in)
  - Toutiao MP (logged in)

Juejin / CSDN / V2EX / Cnblogs: no login cookies → skipped with reason.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import browser_cookie3 as bc
import httpx
import markdown as md

ROOT = Path(__file__).resolve().parents[1]
MARKETING = ROOT / "content" / "cn-marketing"
EDGE_COOKIES = Path.home() / "Library/Application Support/Microsoft Edge/Default/Cookies"

TITLE = "写爬虫时，我再也不想手搓正则了：用中文描述，直接出能测的表达式"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def edge_cookies(domain: str) -> dict[str, str]:
    return {c.name: c.value for c in bc.edge(cookie_file=str(EDGE_COOKIES), domain_name=domain)}


def load_article_md() -> str:
    text = (MARKETING / "2026-07-29-juejin-crawler-regex.md").read_text(encoding="utf-8")
    # strip frontmatter-ish first heading line metadata block comments at top? keep body
    # remove leading meta lines starting with >
    lines = text.splitlines()
    out: list[str] = []
    for i, line in enumerate(lines):
        if i < 8 and (line.startswith(">") or line.strip() == "---" or line.startswith("# ")):
            if line.startswith("# "):
                continue  # title separate
            if line.strip() == "---":
                continue
            if line.startswith(">"):
                continue
        out.append(line)
    body = "\n".join(out).strip()
    # rewrite relative image paths to absolute raw-ish note — keep as site promo instead
    body = re.sub(
        r"!\[([^\]]*)\]\(\./assets/[^\)]+\)",
        r"（截图见产品页：https://regex.ststudio.top/cn）",
        body,
    )
    return body


def md_to_html(text: str) -> str:
    return md.markdown(
        text,
        extensions=["fenced_code", "tables", "nl2br"],
        output_format="html",
    )


def publish_zhihu(title: str, body_md: str) -> dict:
    cookies = edge_cookies("zhihu.com")
    if "z_c0" not in cookies:
        return {"ok": False, "platform": "zhihu", "error": "未登录（缺 z_c0）"}

    headers = {
        "User-Agent": UA,
        "Referer": "https://zhuanlan.zhihu.com/write",
        "x-requested-with": "fetch",
        "x-xsrftoken": cookies.get("_xsrf", ""),
        "Content-Type": "application/json",
    }
    client = httpx.Client(cookies=cookies, headers=headers, timeout=60, follow_redirects=True)

    # 1) create draft
    r = client.post("https://zhuanlan.zhihu.com/api/articles/drafts", json={"title": title, "delta_time": 0})
    r.raise_for_status()
    draft_id = str(r.json()["id"])

    html = md_to_html(body_md)
    # 2) update draft content
    r = client.patch(
        f"https://zhuanlan.zhihu.com/api/articles/{draft_id}/draft",
        json={
            "title": title,
            "content": html,
            "delta_time": 0,
            "is_title_image_full_screen": False,
        },
    )
    if r.status_code >= 400:
        # alternate endpoint
        r = client.put(
            f"https://zhuanlan.zhihu.com/api/articles/{draft_id}/draft",
            json={"title": title, "content": html, "delta_time": 0},
        )
    if r.status_code >= 400:
        return {
            "ok": False,
            "platform": "zhihu",
            "draft_id": draft_id,
            "error": f"update draft HTTP {r.status_code}: {r.text[:300]}",
        }

    # 3) topics (optional but often required)
    for topic_name, topic_id in (("正则表达式", "19555442"), ("爬虫", "19551464"), ("独立开发", "21374278")):
        try:
            client.post(
                f"https://zhuanlan.zhihu.com/api/articles/{draft_id}/topics",
                json={"topic_id": topic_id},
            )
        except Exception:
            pass

    # 4) publish
    r = client.put(
        f"https://zhuanlan.zhihu.com/api/articles/{draft_id}/publish",
        json={
            "column": None,
            "commentPermission": "anyone",
            "disclaimer_status": "close",
            "disclaimer_type": "none",
            "table_of_contents": False,
        },
    )
    if r.status_code >= 400:
        # newer content publish API
        r2 = client.post(
            "https://www.zhihu.com/api/v4/content/publish",
            json={
                "action": "article",
                "data": {
                    "draft": {"id": draft_id, "title": title, "content": html},
                },
            },
        )
        if r2.status_code >= 400:
            return {
                "ok": False,
                "platform": "zhihu",
                "draft_id": draft_id,
                "error": f"publish failed {r.status_code}/{r2.status_code}: {r.text[:200]} | {r2.text[:200]}",
            }
        data = r2.json()
    else:
        data = r.json()

    url = data.get("url") or f"https://zhuanlan.zhihu.com/p/{draft_id}"
    return {"ok": True, "platform": "zhihu", "draft_id": draft_id, "url": url, "raw_keys": list(data.keys())[:20]}


def publish_toutiao(title: str, body_md: str) -> dict:
    cookies = edge_cookies("toutiao.com")
    if "sessionid" not in cookies:
        return {"ok": False, "platform": "toutiao", "error": "未登录（缺 sessionid）"}

    headers = {
        "User-Agent": UA,
        "Referer": "https://mp.toutiao.com/profile_v4/graphic/publish",
        "Origin": "https://mp.toutiao.com",
        "Content-Type": "application/json",
    }
    client = httpx.Client(cookies=cookies, headers=headers, timeout=60, follow_redirects=True)

    # content as plain text with newlines; toutiao often wants HTML
    html = md_to_html(body_md)
    # try common publish endpoint
    payload = {
        "title": title[:30],  # toutiao title limit often 30
        "content": html,
        "article_type": 0,
        "save": 0,  # 0 publish? varies
        "draft": False,
    }
    endpoints = [
        "https://mp.toutiao.com/mp/agw/article/publish?source=mp&type=article",
        "https://mp.toutiao.com/mp/agw/article/publish",
    ]
    last = ""
    for url in endpoints:
        r = client.post(url, json=payload)
        last = f"{r.status_code} {r.text[:400]}"
        if r.status_code < 400:
            data = r.json()
            code = data.get("code", data.get("status"))
            if code in (0, "0", None) or data.get("data"):
                item_id = None
                d = data.get("data") or {}
                if isinstance(d, dict):
                    item_id = d.get("item_id") or d.get("pgc_id") or d.get("id")
                return {
                    "ok": True,
                    "platform": "toutiao",
                    "item_id": item_id,
                    "url": f"https://www.toutiao.com/article/{item_id}/" if item_id else None,
                    "raw": data,
                }
    return {"ok": False, "platform": "toutiao", "error": last}


def main() -> int:
    # ensure markdown lib
    body = load_article_md()
    results = []
    print("Publishing Zhihu…")
    z = publish_zhihu(TITLE, body)
    print(json.dumps(z, ensure_ascii=False, indent=2)[:2000])
    results.append(z)

    print("Publishing Toutiao…")
    # shorter title for toutiao
    t_title = "中文出正则+同页测试：爬虫别再手搓了"
    t = publish_toutiao(t_title, body)
    print(json.dumps(t, ensure_ascii=False, indent=2)[:2000])
    results.append(t)

    skipped = [
        {"ok": False, "platform": "juejin", "error": "Edge/Chrome 无登录 Cookie"},
        {"ok": False, "platform": "csdn", "error": "Edge/Chrome 无登录 Cookie"},
        {"ok": False, "platform": "cnblogs", "error": "Edge/Chrome 无登录 Cookie"},
        {"ok": False, "platform": "v2ex", "error": "Edge/Chrome 无登录 Cookie"},
        {"ok": False, "platform": "segmentfault", "error": "Edge/Chrome 无登录 Cookie"},
    ]
    results.extend(skipped)

    out = MARKETING / "publish-results.json"
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", out)
    return 0 if any(r.get("ok") for r in results) else 1


if __name__ == "__main__":
    # install markdown if needed
    try:
        import markdown  # noqa: F401
    except ImportError:
        import subprocess

        subprocess.check_call([sys.executable, "-m", "pip", "install", "markdown", "-q"])
    raise SystemExit(main())
