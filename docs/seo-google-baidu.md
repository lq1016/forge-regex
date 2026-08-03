# SEO — Google / Baidu

## Already on the site

- `https://regex.ststudio.top/sitemap.xml`
- `https://regex.ststudio.top/robots.txt`
- hreflang EN ↔ `/cn`
- Pattern library: `/patterns`, `/cn/patterns`
- JSON-LD: WebSite + SoftwareApplication + FAQ on home; ItemList on pattern index

## Search Console setup

### Google

Site is hosted in CN (`111.228.49.167`, Tianjin). Google’s crawlers often **time out** on HTML tag / HTML file verification. Prefer **DNS TXT**.

1. [Search Console](https://search.google.com/search-console) → property `https://regex.ststudio.top` (or domain `ststudio.top`)
2. Verification method → **域名提供商 / DNS 记录** (not HTML 标记)
3. Copy the TXT value Google shows (usually `google-site-verification=…`)
4. At DNS (NS: `freens1.jdgslb.com` / 京东云):
   - Host: `@` for `ststudio.top`, or `regex` if verifying only the subdomain
   - Type: `TXT`
   - Value: paste Google’s string
5. Wait for propagation (`dig TXT ststudio.top` or `dig TXT regex.ststudio.top`), then Verify
6. Submit sitemap: `https://regex.ststudio.top/sitemap.xml`

HTML meta is already wired (`NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`) but **will keep failing while Google cannot reach the origin**. Use DNS.

### Baidu

1. [百度搜索资源平台](https://ziyuan.baidu.com/) → 添加网站
2. Prefer **HTML 标签** verification → copy the code
3. Set:

```bash
NEXT_PUBLIC_BAIDU_SITE_VERIFICATION=粘贴content值
```

4. Redeploy, verify, then submit the same sitemap
5. If Baidu asks for an **HTML 文件** instead: download it and place under `public/` (e.g. `public/baidu_verify_code-xxxx.html`), redeploy so it is served at `https://regex.ststudio.top/baidu_verify_code-xxxx.html`

### Optional Bing

```bash
NEXT_PUBLIC_BING_SITE_VERIFICATION=...
```

## After verify

- Soft posts should link to concrete pages (`/cn/patterns/html-href`), not only `/`
- Re-check GSC / 百度「收录」 weekly; add pattern pages for queries that appear
