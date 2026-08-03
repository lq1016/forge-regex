/**
 * Post Forge Regex launch story to Indie Hackers via headed Edge.
 * Reuses a persistent profile under .cache/ih-edge-profile.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

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

const PROFILE = join(homedir(), ".cache", "ih-edge-profile");
mkdirSync(PROFILE, { recursive: true });

const LOGIN_WAIT_MS = 180_000;

async function looksLoggedIn(page) {
  const url = page.url();
  if (url.includes("/sign-in") || url.includes("/login")) return false;
  // Composer / new post indicators
  const titleBox = page.locator(
    'textarea[placeholder*="Title" i], input[placeholder*="Title" i], [contenteditable="true"][data-placeholder*="Title" i], input[name="title"], textarea[name="title"]',
  );
  const bodyBox = page.locator(
    'textarea[placeholder*="Write" i], textarea[placeholder*="post" i], [contenteditable="true"], textarea[name="body"], .ProseMirror, [role="textbox"]',
  );
  if ((await titleBox.count()) > 0 && (await bodyBox.count()) > 0) return true;
  // Avatar / account menu often present when logged in
  const account = page.locator(
    'a[href*="/sign-out"], button:has-text("Sign out"), img[alt*="avatar" i], [data-testid="user-menu"]',
  );
  return (await account.count()) > 0;
}

async function waitForLogin(page) {
  const start = Date.now();
  while (Date.now() - start < LOGIN_WAIT_MS) {
    if (await looksLoggedIn(page)) return true;
    await page.waitForTimeout(2000);
  }
  return false;
}

async function fillPost(page) {
  // Try common IH create-post selectors
  const titleCandidates = [
    'input[placeholder*="Title" i]',
    'textarea[placeholder*="Title" i]',
    'input[name="title"]',
    'textarea[name="title"]',
    '[data-placeholder*="Title" i]',
  ];
  let titleEl = null;
  for (const sel of titleCandidates) {
    const loc = page.locator(sel).first();
    if (await loc.count()) {
      titleEl = loc;
      break;
    }
  }
  if (!titleEl) {
    // Fall back: first visible text input in main
    titleEl = page.locator("main input[type='text'], main textarea").first();
  }

  await titleEl.click({ timeout: 15_000 });
  await titleEl.fill(TITLE);

  const bodyCandidates = [
    ".ProseMirror",
    '[contenteditable="true"]',
    'textarea[placeholder*="Write" i]',
    'textarea[name="body"]',
    'textarea[placeholder*="post" i]',
  ];
  let bodyEl = null;
  for (const sel of bodyCandidates) {
    const loc = page.locator(sel).last();
    if (await loc.count()) {
      bodyEl = loc;
      break;
    }
  }
  if (!bodyEl) throw new Error("Could not find post body editor");

  await bodyEl.click();
  const tag = await bodyEl.evaluate((el) => el.tagName.toLowerCase());
  if (tag === "textarea" || tag === "input") {
    await bodyEl.fill(BODY);
  } else {
    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+A" : "Control+A",
    );
    await page.keyboard.insertText(BODY);
  }
}

async function clickPublish(page) {
  const buttons = [
    'button:has-text("Publish")',
    'button:has-text("Post")',
    'button:has-text("Submit")',
    'button:has-text("Create")',
    'input[type="submit"]',
  ];
  for (const sel of buttons) {
    const loc = page.locator(sel).first();
    if (await loc.count()) {
      await loc.click();
      return;
    }
  }
  throw new Error("Could not find Publish/Post button");
}

async function main() {
  console.log("Launching Edge (headed) with profile:", PROFILE);
  const context = await chromium.launchPersistentContext(PROFILE, {
    channel: "msedge",
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const page = context.pages()[0] || (await context.newPage());

  await page.goto("https://www.indiehackers.com/post", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(2500);

  if (!(await looksLoggedIn(page))) {
    console.log(
      "\n>>> Not logged in. Please log into Indie Hackers in the Edge window that just opened.\n>>> Waiting up to 3 minutes...\n",
    );
    const ok = await waitForLogin(page);
    if (!ok) {
      await page.screenshot({
        path: join(PROFILE, "login-timeout.png"),
        fullPage: true,
      });
      throw new Error("Login timeout — log in in the browser window and re-run.");
    }
    await page.goto("https://www.indiehackers.com/post", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(2000);
  }

  console.log("Logged in — filling post…");
  await page.screenshot({ path: join(PROFILE, "before-fill.png") });
  await fillPost(page);
  await page.screenshot({ path: join(PROFILE, "after-fill.png") });

  // Dry-run safety: require CONFIRM_POST=1 to actually click publish
  if (process.env.CONFIRM_POST !== "1") {
    console.log(
      "Filled title/body. Re-run with CONFIRM_POST=1 to click Publish.",
    );
    console.log("Keeping browser open 60s for you to review…");
    await page.waitForTimeout(60_000);
    await context.close();
    return;
  }

  await clickPublish(page);
  await page.waitForTimeout(5000);
  const finalUrl = page.url();
  console.log("Published URL:", finalUrl);
  await page.screenshot({ path: join(PROFILE, "after-publish.png") });
  await context.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
