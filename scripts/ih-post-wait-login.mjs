/**
 * Wait for user to log into IH in the CDP Edge window, then publish.
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

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

const OUT = join(homedir(), ".cache", "ih-edge-profile");
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function isLoggedIn(page) {
  const join = page.locator('a[href*="sign"], a:has-text("Join"), a:has-text("Log in"), a:has-text("Sign in")');
  // Prefer positive signals
  const avatar = page.locator(
    'img[alt*="avatar" i], a[href*="/settings"], button:has-text("Sign out"), a:has-text("Sign out"), [data-testid*="avatar"]',
  );
  if ((await avatar.count()) > 0) return true;
  // On /post, logged-out users usually see Join or redirect to auth
  const url = page.url();
  if (url.includes("sign") || url.includes("login") || url.includes("auth")) return false;
  // If Join is clearly in header nav
  const joinCount = await page.locator('header a:has-text("Join"), nav a:has-text("Join")').count();
  if (joinCount > 0) return false;
  return true;
}

async function main() {
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const context = browser.contexts()[0];
  const page = await context.newPage();

  console.log("Opening Indie Hackers — please LOG IN in this Edge window…");
  await page.goto("https://www.indiehackers.com/sign-in", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  }).catch(async () => {
    await page.goto("https://www.indiehackers.com/", { waitUntil: "domcontentloaded" });
  });

  const deadline = Date.now() + 5 * 60_000;
  while (Date.now() < deadline) {
    // Periodically revisit home to check session
    if (!(page.url().includes("indiehackers.com"))) {
      await page.goto("https://www.indiehackers.com/", { waitUntil: "domcontentloaded" });
    }
    const logged = await isLoggedIn(page);
    console.log(new Date().toISOString(), "loggedIn=", logged, "url=", page.url());
    if (logged) break;
    await sleep(5000);
  }

  if (!(await isLoggedIn(page))) {
    await page.screenshot({ path: join(OUT, "still-logged-out.png"), fullPage: true });
    throw new Error("Still not logged in after 5 minutes");
  }

  console.log("Login detected — opening composer…");
  await page.goto("https://www.indiehackers.com/post", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await sleep(2500);
  await page.screenshot({ path: join(OUT, "composer.png"), fullPage: true });

  const fields = await page.evaluate(() =>
    [...document.querySelectorAll("input, textarea, [contenteditable='true']")].slice(0, 30).map((el) => ({
      tag: el.tagName,
      type: el.getAttribute("type"),
      name: el.getAttribute("name"),
      placeholder: el.getAttribute("placeholder"),
      className: String(el.className).slice(0, 100),
    })),
  );
  console.log("fields", JSON.stringify(fields, null, 2));
  writeFileSync(join(OUT, "composer-fields.json"), JSON.stringify(fields, null, 2));

  let titleFilled = false;
  for (const sel of [
    'input[placeholder*="Title" i]',
    'textarea[placeholder*="Title" i]',
    'input[name="title"]',
  ]) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) > 0) {
      await loc.fill(TITLE);
      titleFilled = true;
      break;
    }
  }
  if (!titleFilled) {
    const first = page.locator("main input[type='text'], form input[type='text'], input[type='text']").first();
    await first.fill(TITLE);
  }

  const editable = page.locator(".ProseMirror, [contenteditable='true']").last();
  if ((await editable.count()) > 0) {
    await editable.click();
    await page.keyboard.press("Meta+A");
    await page.keyboard.insertText(BODY);
  } else {
    await page.locator("textarea").last().fill(BODY);
  }

  await page.screenshot({ path: join(OUT, "ready-to-publish.png"), fullPage: true });

  const publish = page
    .locator('button:has-text("Publish"), button:has-text("Post"), button:has-text("Submit")')
    .first();
  if ((await publish.count()) === 0) {
    const btns = await page.evaluate(() =>
      [...document.querySelectorAll("button")].map((b) => b.innerText.trim()).filter(Boolean),
    );
    console.log("buttons:", btns);
    throw new Error("Publish button not found");
  }

  await publish.click();
  await sleep(6000);
  const finalUrl = page.url();
  console.log("PUBLISHED:", finalUrl);
  writeFileSync(join(OUT, "final-url.txt"), finalUrl + "\n");
  await page.screenshot({ path: join(OUT, "published.png"), fullPage: true });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
