#!/usr/bin/env node
/**
 * One-time headed login for Indie Hackers.
 * Saves a persistent Chromium profile under data/ih-auth/user-data/
 *
 * Usage:
 *   pnpm ih:login
 *
 * Then copy data/ih-auth/ to the server (keep private — contains session).
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const authDir = join(root, "data", "ih-auth");
const userData = join(authDir, "user-data");

mkdirSync(userData, { recursive: true });

const LOGIN_WAIT_MS = 5 * 60_000;

async function isLoggedIn(page) {
  const avatar = await page
    .locator('img[alt="User Avatar"]')
    .first()
    .isVisible()
    .catch(() => false);
  const join = await page
    .locator('banner a[href="/sign-up"], header a[href="/sign-up"]')
    .filter({ hasText: /^Join$/ })
    .first()
    .isVisible()
    .catch(() => false);
  return avatar && !join;
}

async function main() {
  console.log("Opening headed browser. Log into Indie Hackers in that window…");
  console.log("Profile:", userData);

  const context = await chromium.launchPersistentContext(userData, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const page = context.pages()[0] || (await context.newPage());
  await page.goto("https://www.indiehackers.com/sign-in", {
    waitUntil: "domcontentloaded",
  });

  const deadline = Date.now() + LOGIN_WAIT_MS;
  while (Date.now() < deadline) {
    if (await isLoggedIn(page)) break;
    // also treat leaving sign-in without Join as progress — recheck home
    if (!page.url().includes("sign-in")) {
      await page.goto("https://www.indiehackers.com/", {
        waitUntil: "domcontentloaded",
      });
      await page.waitForTimeout(2000);
      if (await isLoggedIn(page)) break;
    }
    await page.waitForTimeout(2000);
  }

  await page.goto("https://www.indiehackers.com/", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(2000);

  if (!(await isLoggedIn(page))) {
    await context.close();
    throw new Error("Login not detected within 5 minutes. Re-run pnpm ih:login");
  }

  const state = await context.storageState();
  // Keep only indiehackers cookies/origins (avoid leaking unrelated cookies)
  const filtered = {
    cookies: state.cookies.filter((c) =>
      String(c.domain || "").includes("indiehackers.com"),
    ),
    origins: state.origins.filter((o) =>
      String(o.origin || "").includes("indiehackers.com"),
    ),
  };
  writeFileSync(
    join(authDir, "storageState.json"),
    JSON.stringify(filtered, null, 2),
  );
  writeFileSync(
    join(authDir, "logged-in-at.txt"),
    new Date().toISOString() + "\n",
  );

  console.log("Logged in. Saved:");
  console.log(" -", userData);
  console.log(" -", join(authDir, "storageState.json"));
  console.log("Copy data/ih-auth/ to the server, then run: pnpm ih:comment --dry-run");

  await context.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
