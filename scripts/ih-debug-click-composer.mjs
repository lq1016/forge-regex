import { chromium } from "playwright";
import { existsSync } from "fs";
import { join } from "path";

const chrome =
  process.env.IH_CHROME_PATH ||
  join(process.env.HOME || "", "apps/chrome/opt/google/chrome/google-chrome");

const ctx = await chromium.launchPersistentContext("data/ih-auth/user-data", {
  headless: true,
  executablePath: existsSync(chrome) ? chrome : undefined,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = ctx.pages()[0] || (await ctx.newPage());
const url =
  process.argv[2] ||
  "https://www.indiehackers.com/post/building-a-shopify-bundles-app-for-stores-with-real-fulfillment-heres-the-wedge-f2e73344cd";
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(1000);

const before = await page.locator(".comment-box").first().getAttribute("class");
console.log("before class", before);

await page.locator("a.comment-box__textarea").first().click({ force: true });
await page.waitForTimeout(2000);

const after = await page.locator(".comment-box").first().getAttribute("class");
const html = await page.locator(".comment-box").first().innerHTML();
console.log("after class", after);
console.log("html", html.slice(0, 2000));
console.log(
  "textarea count",
  await page.locator("textarea").count(),
  "contenteditable",
  await page.locator("[contenteditable=true]").count(),
);

// try typing into focused element
await page.keyboard.type("hello from debug " + Date.now());
await page.waitForTimeout(500);
const html2 = await page.locator(".comment-box").first().innerHTML();
console.log("after type html", html2.slice(0, 2000));

await ctx.close();
