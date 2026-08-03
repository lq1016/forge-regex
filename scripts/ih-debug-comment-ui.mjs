import { chromium } from "playwright";
import { existsSync } from "fs";
import { join } from "path";

const chrome =
  process.env.IH_CHROME_PATH ||
  join(process.env.HOME || "", "apps/chrome/opt/google/chrome/google-chrome");
const userData = "data/ih-auth/user-data";
const url =
  process.argv[2] ||
  "https://www.indiehackers.com/post/32-commits-later-the-biggest-improvement-wasnt-technical-98c9a2bc84";

const ctx = await chromium.launchPersistentContext(userData, {
  headless: true,
  executablePath: existsSync(chrome) ? chrome : undefined,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(8000);
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

const info = await page.evaluate(() => {
  const buttons = [...document.querySelectorAll("button,a")]
    .map((el) => (el.innerText || "").trim())
    .filter((t) => /comment|post|sign|log|join|privilege|can't/i.test(t))
    .slice(0, 40);
  const editables = [
    ...document.querySelectorAll(
      "[contenteditable], textarea, input, .comment-box, [class*=comment]",
    ),
  ]
    .map((el) => ({
      tag: el.tagName,
      class: String(el.className).slice(0, 100),
      ph: el.placeholder || null,
      text: (el.innerText || "").slice(0, 80),
    }))
    .slice(0, 40);
  const body = document.body.innerText;
  const idx = body.search(/Post Comment|Say something|can't create|special privileges/i);
  const snippet = idx >= 0 ? body.slice(Math.max(0, idx - 180), idx + 220) : body.slice(-600);
  return { buttons, editables, snippet, avatar: !!document.querySelector('img[alt="User Avatar"]') };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: "/tmp/ih-post.png", fullPage: true });
console.log("screenshot=/tmp/ih-post.png");
await ctx.close();
