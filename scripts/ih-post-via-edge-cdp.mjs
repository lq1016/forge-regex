/**
 * Connect to the user's real Edge (CDP) and publish the IH launch post.
 * Expects Edge running with --remote-debugging-port=9222
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
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

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const context = browser.contexts()[0];
  if (!context) throw new Error("No browser context on CDP — is Edge up?");
  const page = await context.newPage();

  await page.goto("https://www.indiehackers.com/", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await sleep(2000);

  const joinVisible = await page.locator('a:has-text("Join")').first().isVisible().catch(() => false);
  const html = await page.content();
  writeFileSync(join(OUT, "home.html"), html.slice(0, 50_000));
  await page.screenshot({ path: join(OUT, "cdp-home.png"), fullPage: true });

  if (joinVisible) {
    throw new Error(
      "Edge session is NOT logged into Indie Hackers (Join still visible). Log in in that Edge window, then re-run.",
    );
  }

  await page.goto("https://www.indiehackers.com/post", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await sleep(2500);
  await page.screenshot({ path: join(OUT, "cdp-post-page.png"), fullPage: true });
  writeFileSync(join(OUT, "post-page.html"), (await page.content()).slice(0, 80_000));

  // Dump candidate inputs for debugging
  const fields = await page.evaluate(() => {
    const els = [...document.querySelectorAll("input, textarea, [contenteditable='true'], [role='textbox']")];
    return els.slice(0, 40).map((el) => ({
      tag: el.tagName,
      type: el.getAttribute("type"),
      name: el.getAttribute("name"),
      placeholder: el.getAttribute("placeholder"),
      role: el.getAttribute("role"),
      className: String(el.className).slice(0, 80),
      id: el.id,
    }));
  });
  console.log("Form fields:", JSON.stringify(fields, null, 2));

  const buttons = await page.evaluate(() =>
    [...document.querySelectorAll("button, a, input[type=submit]")]
      .map((el) => ({
        tag: el.tagName,
        text: (el.innerText || el.value || "").trim().slice(0, 60),
        className: String(el.className).slice(0, 60),
      }))
      .filter((b) => b.text)
      .slice(0, 40),
  );
  console.log("Buttons:", JSON.stringify(buttons, null, 2));

  // Fill title
  const titleSel = [
    'input[placeholder*="Title" i]',
    'textarea[placeholder*="Title" i]',
    'input[name="title"]',
    'textarea[name="title"]',
  ];
  let filledTitle = false;
  for (const sel of titleSel) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) > 0) {
      await loc.fill(TITLE);
      filledTitle = true;
      break;
    }
  }
  if (!filledTitle) {
    // first text-like field
    const first = page.locator("input[type='text'], textarea").first();
    if ((await first.count()) > 0) {
      await first.fill(TITLE);
      filledTitle = true;
    }
  }
  if (!filledTitle) throw new Error("Title field not found — see cdp-post-page.png");

  // Fill body
  const prose = page.locator(".ProseMirror, [contenteditable='true']").last();
  if ((await prose.count()) > 0) {
    await prose.click();
    await page.keyboard.press("Meta+A");
    await page.keyboard.insertText(BODY);
  } else {
    const ta = page.locator("textarea").last();
    await ta.fill(BODY);
  }

  await page.screenshot({ path: join(OUT, "cdp-filled.png"), fullPage: true });

  if (process.env.CONFIRM_POST !== "1") {
    console.log("Filled. Set CONFIRM_POST=1 to publish.");
    return;
  }

  const publish = page
    .locator('button:has-text("Publish"), button:has-text("Post"), button:has-text("Submit")')
    .first();
  if ((await publish.count()) === 0) throw new Error("Publish button not found");
  await publish.click();
  await sleep(5000);
  console.log("Final URL:", page.url());
  await page.screenshot({ path: join(OUT, "cdp-published.png"), fullPage: true });
  writeFileSync(join(OUT, "final-url.txt"), page.url());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
