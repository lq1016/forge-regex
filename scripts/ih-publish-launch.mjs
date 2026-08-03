#!/usr/bin/env node
/**
 * Publish the Forge Regex launch story to Indie Hackers (server Chrome + ih-auth).
 *
 *   CONFIRM_POST=1 node scripts/ih-publish-launch.mjs
 *   (without CONFIRM_POST: fill only, dump screenshot, exit)
 */
import { chromium } from "playwright";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { applyProxyEnv, playwrightProxyOption } from "./ih-proxy.mjs";
import { reseedIhAuth } from "./ih-reseed-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outDir = join(root, "data", "ih-comments");
mkdirSync(outDir, { recursive: true });

const TITLE =
  "I built an AI regex tool for overseas users – here’s the stack and what’s working so far";

const BODY = `Hey IH 👋

I built Forge Regex: describe a pattern in plain English → get a working regex, with live testing, explanations, replace preview, and code export.

🔗 https://regex.ststudio.top

## Why I built it
I was tired of the “ChatGPT writes regex → paste into regex101 → tweak → repeat” loop. I wanted one place that both generates and lets you verify.

## What’s live
- NL → JS-compatible regex (DeepSeek)
- Live match highlighting + short explanations
- Replace preview
- Export to JS / Python / Go / Java / .NET
- Free: 5 gens/day
- Pro: $9/mo via Paddle (MoR) – unlimited + share links
- Email magic-link login to keep Pro across devices

## Stack
Next.js, DeepSeek, Paddle Billing, SQLite, Resend, self-hosted

## What’s hard / what I learned
1. Payment for a China-based indie: Stripe / Lemon Squeezy were painful; Paddle worked better as MoR.
2. Checkout price bugs are easy: UI said $9 while Price ID still pointed at a $1 test price. Always verify the live Price ID.
3. “Paid but plan not showing” needs email login + webhook sync, not only a browser cookie.
4. Shipping CN WeChat/Alipay early was a distraction – I’m focusing on overseas customers first.

## Where I need feedback
- Is $9/mo reasonable vs free 5/day?
- What’s the #1 feature you’d need before paying?
- Any dealbreakers vs regex101 + ChatGPT?

Thanks – happy to share more on Paddle, quota design, or SEO.`;

const confirm = process.env.CONFIRM_POST === "1";

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
  viewport: { width: 1440, height: 1100 },
  proxy,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = context.pages()[0] || (await context.newPage());

try {
  await page.goto("https://www.indiehackers.com/new-post", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(4000);

  const formDump = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll("input, textarea, [contenteditable=true]")]
      .slice(0, 40)
      .map((el) => ({
        tag: el.tagName,
        type: el.getAttribute("type"),
        name: el.getAttribute("name"),
        id: el.id,
        className: String(el.className || "").slice(0, 120),
        placeholder: el.getAttribute("placeholder"),
        role: el.getAttribute("role"),
        contentEditable: el.getAttribute("contenteditable"),
      }));
    const buttons = [...document.querySelectorAll("button, a.button, input[type=submit]")]
      .map((el) => (el.innerText || el.value || "").trim())
      .filter(Boolean)
      .slice(0, 30);
    return { inputs, buttons, url: location.href, title: document.title };
  });
  writeFileSync(
    join(outDir, "new-post-form.json"),
    JSON.stringify(formDump, null, 2),
  );
  console.log("Form dump:", JSON.stringify(formDump, null, 2));

  // Title field
  const titleSelectors = [
    'input[placeholder*="Title" i]',
    'textarea[placeholder*="Title" i]',
    'input[name="title"]',
    'textarea[name="title"]',
    ".ember-text-field",
    "main input[type='text']",
    "main textarea",
  ];
  let titleFilled = false;
  for (const sel of titleSelectors) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) === 0) continue;
    if (!(await loc.isVisible().catch(() => false))) continue;
    await loc.click({ timeout: 10_000 });
    await loc.fill(TITLE);
    titleFilled = true;
    console.log("Filled title via", sel);
    break;
  }
  if (!titleFilled) throw new Error("Could not find title field");

  // Body editor — IH often uses a large textarea or contenteditable after title
  const bodySelectors = [
    'textarea[placeholder*="Write" i]',
    'textarea[placeholder*="body" i]',
    'textarea[name="body"]',
    "textarea.ember-text-area",
    ".ProseMirror",
    '[contenteditable="true"]',
    "main textarea",
  ];
  let bodyFilled = false;
  for (const sel of bodySelectors) {
    const locs = page.locator(sel);
    const n = await locs.count();
    for (let i = 0; i < n; i++) {
      const loc = locs.nth(i);
      if (!(await loc.isVisible().catch(() => false))) continue;
      // Skip if this is the same as title (short single-line)
      const ph = (await loc.getAttribute("placeholder").catch(() => "")) || "";
      if (/title/i.test(ph)) continue;
      await loc.click({ timeout: 10_000 });
      const tag = await loc.evaluate((el) => el.tagName.toLowerCase());
      if (tag === "textarea" || tag === "input") {
        await loc.fill(BODY);
      } else {
        await page.keyboard.press("Control+A");
        await page.keyboard.insertText(BODY);
      }
      bodyFilled = true;
      console.log("Filled body via", sel, "index", i);
      break;
    }
    if (bodyFilled) break;
  }
  if (!bodyFilled) throw new Error("Could not find body editor");

  await page.screenshot({
    path: join(outDir, "launch-before-submit.png"),
    fullPage: true,
  });

  if (!confirm) {
    console.log("Dry fill only. Re-run with CONFIRM_POST=1 to submit.");
  } else {
    // Prefer SUBMIT POST over SAVE AS DRAFT
    const submit = page.getByRole("button", { name: /submit post/i });
    if (await submit.count()) {
      await submit.first().click();
    } else {
      const alt = page
        .locator('button:has-text("SUBMIT POST"), button:has-text("Submit Post")')
        .first();
      await alt.click({ timeout: 15_000 });
    }

    await page.waitForTimeout(8000);
    for (let i = 0; i < 20; i++) {
      if (!page.url().includes("/new-post")) break;
      await page.waitForTimeout(1000);
    }

    const finalUrl = page.url();
    await page.screenshot({
      path: join(outDir, "launch-after-submit.png"),
      fullPage: true,
    });
    console.log("Published URL:", finalUrl);

    if (!/\/post\//.test(finalUrl)) {
      const text = await page.evaluate(() =>
        (document.body?.innerText || "").replace(/\s+/g, " ").slice(0, 800),
      );
      console.error("Unexpected URL after submit. Snippet:", text);
      process.exitCode = 2;
    } else {
      writeFileSync(
        join(outDir, "launch-published.json"),
        JSON.stringify(
          { at: new Date().toISOString(), url: finalUrl, title: TITLE },
          null,
          2,
        ),
      );
    }
  }
} finally {
  await context.close();
}
