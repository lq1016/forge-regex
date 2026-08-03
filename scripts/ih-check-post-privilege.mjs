#!/usr/bin/env node
/** Check whether the logged-in IH account can open the new-post composer. */
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { applyProxyEnv, playwrightProxyOption } from "./ih-proxy.mjs";
import { reseedIhAuth } from "./ih-reseed-lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
applyProxyEnv();
const proxy = playwrightProxyOption();
const chrome =
  process.env.IH_CHROME_PATH ||
  join(process.env.HOME || "", "apps/chrome/opt/google/chrome/google-chrome");
const userData = join(root, "data/ih-auth/user-data");

await reseedIhAuth({ root, chromePath: chrome });

const context = await chromium.launchPersistentContext(userData, {
  headless: true,
  executablePath: existsSync(chrome) ? chrome : undefined,
  viewport: { width: 1440, height: 1000 },
  proxy,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = context.pages()[0] || (await context.newPage());

const urls = [
  "https://www.indiehackers.com/new-post",
  "https://www.indiehackers.com/post/new",
  "https://www.indiehackers.com/contribute",
];

const pages = {};
for (const url of urls) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(4000);
  pages[url] = await page.evaluate(() => {
    const text = document.body?.innerText || "";
    const gates = [
      "comment thoughtfully",
      "posting privileges",
      "IH+",
      "not able to create",
      "before you can post",
      "earn the right",
      "become a member",
    ].filter((g) => text.toLowerCase().includes(g.toLowerCase()));

    return {
      finalUrl: location.href,
      title: document.title,
      h1: document.querySelector("h1")?.innerText || null,
      gates,
      titleInput: !!document.querySelector(
        'input[name="title"], input[placeholder*="title" i], textarea[placeholder*="Title" i]',
      ),
      editor: !!document.querySelector(
        '[contenteditable="true"], textarea.body, .ProseMirror, .ql-editor, textarea[name="body"]',
      ),
      snippet: text.replace(/\s+/g, " ").slice(0, 700),
    };
  });
}

await page.goto("https://www.indiehackers.com/", {
  waitUntil: "domcontentloaded",
  timeout: 60_000,
});
await page.waitForTimeout(3000);
const header = await page.evaluate(() => {
  const avatar = document
    .querySelector('header img[alt^="Avatar for"]')
    ?.getAttribute("alt");
  const join = !!document.querySelector('header a[href="/sign-up"]');
  const newPost = [...document.querySelectorAll("a, button")]
    .map((el) => ({
      text: (el.innerText || "").trim(),
      href: el.getAttribute("href") || "",
    }))
    .filter((x) => /new post|write|contribute|create post/i.test(x.text + x.href))
    .slice(0, 10);
  return { avatar, join, newPost };
});

const canPost = Object.values(pages).some(
  (p) =>
    (p.titleInput || p.editor) &&
    !p.gates.some((g) => /privileges|thoughtfully|before you can post/i.test(g)),
);
const blocked = Object.values(pages).some((p) =>
  p.gates.some((g) => /privileges|thoughtfully|before you can post|IH\+/i.test(g)),
);

console.log(
  JSON.stringify(
    {
      verdict: canPost ? "CAN_POST" : blocked ? "BLOCKED" : "UNCLEAR",
      header,
      pages,
    },
    null,
    2,
  ),
);

await context.close();
process.exit(canPost ? 0 : blocked ? 2 : 3);
