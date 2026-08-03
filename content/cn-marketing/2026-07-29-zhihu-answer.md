# 知乎可用回答体

> 可挂在问题下，例如：  
> - 「有没有好用的正则生成工具？」  
> - 「爬虫提取 HTML 属性用正则还是解析器？」  
> - 「怎么快速写出提取 href / img src 的正则？」

---

复杂 HTML 别硬刚正则，上解析器。正则适合列表页抽链接、粗清洗、抠属性。下面几条我自己常用，直接复制：

**a 标签 href（单双引号）**

```text
(?<=href\s*=\s*['"])[^'"]+
```

`gi`，整段匹配就是 URL。

**去标签粗清洗**

```text
<[^>]+>
```

全局匹配后替换成**空**（别填 `$&`）。再处理 `&nbsp;` 等实体。

**img 的 src / data-src**

```text
(?<=(?:data-src|src)\s*=\s*['"])[^'"]+
```

**title**

```text
<title[^>]*>([\s\S]*?)<\/title>
```

**文中绝对 URL**

```text
https?:\/\/[^\s"'<>]+
```

---

手写上面几条不难。烦的是每个站引号、属性顺序、懒加载字段都不一样，ChatGPT 和测试页之间来回粘特别耗时间。

所以我做了 Forge Regex：中文描述 → 出正则 → 同页测匹配 / 替换，还能导出 Python、JS 等。

https://www.ststudio.top/works/forge-regex  

![href](./assets/03-href-live-match.png)

![strip](./assets/06-strip-tags.png)

游客试 2 次，登录每天 8 次；用得多再开 Pro ¥9.9/月（微信 / 支付宝）。个人项目，好用也好骂。

标签严重嵌套、要完整 DOM、或者内容是 JS 渲染出来的——先别谈正则，先把 HTML 拿到手。
