# 写爬虫时我懒得再手搓正则了

写爬虫时我经常干这种蠢事：

跟 ChatGPT 要一条抽 `href` 的正则 → 粘到测试站 → 单引号挂了，或者懒加载的 `data-src` 根本没匹配到 → 再改一版 prompt → 再粘。来回几趟，半天没写业务逻辑。

元字符其实就那点东西。烦的是对着真实脏 HTML，能不能快点收敛。后来我干脆把「生成 + 贴样例 + 看匹配」塞进同一页，少切窗口。下面几个场景是我自己写爬虫时用得最多的。

![首页](./assets/01-home-cn.png)

---

## 正则到底能不能啃 HTML？

能扛这些活：

- 列表页批量抽链接、图片、meta  
- 粗清洗标签、抽 URL、抽 title  
- script 里埋的简单键值  

别指望它处理任意嵌套、标签不闭合、前端动态拼出来的烂 DOM。那种请上 cheerio / lxml / BeautifulSoup。下面都是我觉得正则更划算的场景。

---

## 抽所有 a 的 href（单双引号）

我会这么描述需求（给自己或给生成器用都行）：

> 从 HTML 提取所有 a 标签的 href 属性值，兼容单引号和双引号

出来一般长这样：

```regex
/(?<=href\s*=\s*['"])[^'"]+/gi
```

样例：

```html
<a href="https://example.com/a">A</a>
<a href='https://news.cn/path?x=1'>B</a>
<a class="x" href="/relative/page">C</a>
<span>假的 href=notquoted</span>
```

贴到同页测试区会高亮匹配，确认没误伤再拷进爬虫：

![抽 href 并实时匹配](./assets/03-href-live-match.png)

导出成 JS / Python 也省得手改 flags：

```js
const re = /(?<=href\s*=\s*['"])[^'"]+/gi;
const hrefs = html.match(re) || [];
```

```python
import re
hrefs = re.findall(r"(?<=href\s*=\s*['\"])[^'\"]+", html, flags=re.I)
```

---

## 粗暴去标签，洗正文

描述：

> 去掉所有 HTML 标签只保留纯文本

常见结果：

```regex
/<[^>]+>/g
```

关键一步：替换成**空字符串**（别填 `$&`，那等于没删）。洗完再处理 `&nbsp;`、`&amp;` 之类。

![去标签](./assets/06-strip-tags.png)

这招会拆掉所有标签。脚本、style 没先抠掉的话，可能脏一脸——正经站点最好先定位正文容器再洗。

---

## 图片 src + 懒加载 data-src

列表页常见：

```html
<img src="https://cdn.example.com/a.jpg" />
<img data-src='https://cdn.example.com/lazy.webp' class="lazy" />
<img src="/local/pic.png" alt="x">
```

描述：

> 从 HTML 提取 img 的 src，兼容单双引号，以及 data-src 懒加载属性

类似：

```regex
/(?<=(?:data-src|src)\s*=\s*['"])[^'"]+/gi
```

![抽图片地址](./assets/07-img-src.png)

---

## title，以及更多脏活

抽标题：

```regex
/<title[^>]*>([\s\S]*?)<\/title>/i
```

也有人直接扔中文需求，比如：

- 「匹配包含下一页三个字的 a 标签并捕获 href」  
- 「从 script 里提取 listApi 冒号后面的接口路径」

绝对 URL、meta、注释、中文段落粗筛之类，我另整理了份速查（同目录 `cheatsheet-crawler-regex.md`），需要可以自己翻。

---

## 和「ChatGPT + 另开测试站」比什么

| | ChatGPT 来回粘 | 同页生成+测试 |
|--|----------------|---------------|
| 生成 | 有 | 有，中文描述也行 |
| 同页测真实 HTML | 无 | 有高亮 |
| 替换预览 | 无 | 有 |
| 导出多语言 | 自己抄 | 省一步 |

本质就一点：少切窗口，对着脏样例当场打回车。

---

## 我自己写爬虫时的习惯

1. 提示词把边界写死：单双引号？懒加载？要不要捕获组？  
2. 样例故意放点脏数据，看会不会误伤。  
3. 能解析 DOM 就别硬刚正则——正则适合干脏活、干快活。  
4. 生成完先看「如何理解 / 逐 token」，别盲目信一条「看起来很厉害」的表达式。

以上场景我都塞进自己做的小工具里自用了（Forge Regex，中文页）。文章重点是正则用法，不展开商业细节；有人想对着真实页面练手，搜索站名或看我主页置顶即可。

有坑欢迎评论区拍砖，尤其是你们写爬虫时最常翻车的那一类 HTML。
