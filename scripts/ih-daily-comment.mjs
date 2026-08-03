#!/usr/bin/env node
/**
 * Daily Indie Hackers comments (server-friendly, headless).
 *
 * Prerequisites:
 *   1) pnpm ih:login  (once; creates data/ih-auth/user-data)
 *   2) DEEPSEEK_API_KEY in .env.local / .env.production
 *   3) Optional: RESEND_API_KEY + EMAIL_FROM + IH_REMIND_TO for email report
 *
 * Usage:
 *   pnpm ih:comment
 *   pnpm ih:comment --dry-run
 *   IH_COMMENT_COUNT=3 pnpm ih:comment
 *
 * Cron (Beijing 22:00 ≈ UTC 14:00):
 *   0 14 * * * cd /path/to/forge-regex && node scripts/ih-daily-comment.mjs >> data/ih-comments/cron.log 2>&1
 */
import { chromium } from "playwright";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  appendFileSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomInt } from "node:crypto";
import { applyProxyEnv, playwrightProxyOption } from "./ih-proxy.mjs";
import { reseedIhAuth } from "./ih-reseed-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvFile(name) {
  const p = join(root, name);
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env.production");
const proxyServer = applyProxyEnv();

const dryRun =
  process.argv.includes("--dry-run") || process.env.IH_COMMENT_DRY_RUN === "1";
const count = Math.min(
  5,
  Math.max(1, Number(process.env.IH_COMMENT_COUNT || "2")),
);
const allowPromo = process.env.IH_COMMENT_PROMO === "1";

const authDir = join(root, "data", "ih-auth");
const userData = join(authDir, "user-data");
const logDir = join(root, "data", "ih-comments");
const logPath = join(logDir, "log.json");
mkdirSync(logDir, { recursive: true });

function loadLog() {
  if (!existsSync(logPath)) return { comments: [] };
  try {
    return JSON.parse(readFileSync(logPath, "utf8"));
  } catch {
    return { comments: [] };
  }
}

function saveLog(log) {
  writeFileSync(logPath, JSON.stringify(log, null, 2));
}

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Sleep a random amount so cron does not always post at the same clock time. */
async function humanJitter(label, minMs, maxMs) {
  const lo = Math.max(0, Math.floor(minMs));
  const hi = Math.max(lo, Math.floor(maxMs));
  const ms = lo === hi ? lo : randomInt(lo, hi + 1);
  if (ms <= 0) return;
  console.log(
    `${label}: waiting ${Math.round(ms / 1000)}s (jitter ${Math.round(lo / 1000)}–${Math.round(hi / 1000)}s)`,
  );
  await new Promise((r) => setTimeout(r, ms));
}

async function dismissOverlays(page) {
  await page.evaluate(() => {
    document
      .querySelectorAll(
        "#onetrust-consent-sdk, #onetrust-banner-sdk, .onetrust-pc-dark-filter",
      )
      .forEach((el) => el.remove());
    document.body.style.overflow = "auto";
  });
  const gotIt = page.getByRole("button", { name: /got it/i });
  if (await gotIt.isVisible().catch(() => false)) {
    await gotIt.click().catch(() => {});
  }
}

async function isLoggedIn(page) {
  await dismissOverlays(page);
  // Header Join = logged out (footer Join can still appear when logged in)
  const headerJoin = await page
    .locator('banner a[href="/sign-up"], header a[href="/sign-up"]')
    .filter({ hasText: /^Join$/ })
    .count()
    .catch(() => 0);
  if (headerJoin > 0) return false;

  // Logged-in header shows "Avatar for <username>" + Sign Out; posts also use generic avatars.
  const headerAvatar = await page
    .locator('header img[alt^="Avatar for"], .site-header img[alt^="Avatar for"]')
    .first()
    .isVisible()
    .catch(() => false);
  if (headerAvatar) return true;
  const signOut = await page.evaluate(() =>
    /Sign Out/i.test(
      document.querySelector("header, .site-header")?.innerText || "",
    ),
  );
  return signOut;
}

async function listCandidatePosts(page) {
  await page.goto("https://www.indiehackers.com/", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(3000);
  await dismissOverlays(page);

  return page.evaluate(() => {
    const skip =
      /black.?car|houston|crypto|nft|forex|casino|dating|weight.?loss/i;
    const links = [...document.querySelectorAll("a")].filter((a) => {
      const href = a.getAttribute("href") || "";
      return (
        href.startsWith("/post/") &&
        !href.includes("/tech/") &&
        a.querySelector("h3")
      );
    });
    const seen = new Set();
    const out = [];
    for (const a of links) {
      const href = a.getAttribute("href");
      if (!href || seen.has(href)) continue;
      const title = (a.innerText || "").trim().replace(/\s+/g, " ");
      if (!title || title.length < 20) continue;
      if (skip.test(title)) continue;
      seen.add(href);
      out.push({ href, title: title.slice(0, 160) });
      if (out.length >= 20) break;
    }
    return out;
  });
}

async function readPost(page, href) {
  const url = href.startsWith("http")
    ? href
    : `https://www.indiehackers.com${href}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(2500);
  await dismissOverlays(page);
  // Ember comment composer: placeholder is often an <a.comment-box__textarea>; click → real <textarea>
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const composer = page.locator(
    "a.comment-box__textarea, textarea.comment-box__textarea, .comment-box__textarea",
  );
  try {
    await composer.first().waitFor({ state: "visible", timeout: 25_000 });
  } catch {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await dismissOverlays(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await composer.first().waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
  }

  const title = await page.title();
  const body = await page.evaluate(() => {
    const article =
      document.querySelector("article") ||
      document.querySelector(".post") ||
      document.querySelector("main");
    const text = (article?.innerText || document.body.innerText || "").trim();
    return text.slice(0, 3500);
  });
  const hasBox =
    (await composer.count()) > 0 &&
    (await composer.first().isVisible().catch(() => false));
  return { url: page.url().split("?")[0], title, body, hasBox };
}

async function generateComment(postTitle, postBody) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY missing — needed to draft comments");
  }
  const baseURL = (
    process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1"
  ).replace(/\/$/, "");
  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

  const system = `You write short Indie Hackers comments as a solo SaaS founder.
Rules:
- 2–4 short paragraphs max, under 120 words
- Specific to THIS post; reference one concrete detail
- End with one genuine question
- No hashtags, no emojis spam
- Do NOT pitch products, drop links, or mention Forge Regex / regex.ststudio.top${
    allowPromo ? "" : ""
  }
- Sound human, not corporate
- English only`;

  const user = `Post title: ${postTitle}\n\nPost excerpt:\n${postBody.slice(0, 2500)}\n\nWrite the comment body only.`;

  const res = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`DeepSeek error ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  let text = data.choices?.[0]?.message?.content?.trim() || "";
  text = text.replace(/^```[\s\S]*?```$/g, "").trim();
  // safety: strip obvious self-promo URLs
  if (!allowPromo) {
    text = text
      .replace(/https?:\/\/\S*regex\.ststudio\.top\S*/gi, "")
      .replace(/Forge Regex/gi, "my tool")
      .trim();
  }
  if (text.length < 40) throw new Error("Generated comment too short");
  return text;
}

async function postComment(page, comment) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);

  // Placeholder is often <a.comment-box__textarea>; click until a real editor appears
  for (let i = 0; i < 4; i++) {
    const ta = page.locator("textarea.comment-box__textarea, .comment-box textarea");
    if ((await ta.count()) > 0 && (await ta.first().isVisible().catch(() => false))) break;
    const editable = page.locator(
      ".comment-box [contenteditable='true'], .comment-box__textarea[contenteditable='true']",
    );
    if ((await editable.count()) > 0 && (await editable.first().isVisible().catch(() => false))) {
      break;
    }
    const placeholder = page.locator("a.comment-box__textarea, .comment-box__textarea").first();
    await placeholder.click({ force: true });
    await page.waitForTimeout(700);
  }

  const ta = page.locator("textarea.comment-box__textarea, .comment-box textarea").first();
  if ((await ta.count()) > 0 && (await ta.isVisible().catch(() => false))) {
    await ta.fill(comment);
  } else {
    const editable = page
      .locator(".comment-box [contenteditable='true'], [contenteditable='true'].comment-box__textarea")
      .first();
    await editable.waitFor({ state: "visible", timeout: 10_000 });
    await editable.click();
    await page.keyboard.press("Meta+A").catch(() => {});
    await page.keyboard.press("Control+A").catch(() => {});
    await page.keyboard.insertText(comment);
  }

  const save = page
    .locator(
      "a.comment-box__save-button, button:has-text('Post Comment'), a:has-text('POST COMMENT')",
    )
    .first();
  await save.click();
  await page.waitForTimeout(4000);
  return page.url();
}

async function emailReport(lines) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const to = process.env.IH_REMIND_TO || "34310374@qq.com";
  if (!apiKey || !from) {
    console.log("Skip email (RESEND_API_KEY / EMAIL_FROM not set)");
    return;
  }
  const subject = `[IH comments] ${todayKey()} — ${lines.length} posted`;
  const html = `<pre>${lines.map((l) => escapeHtml(l)).join("\n")}</pre>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!res.ok) {
    console.error("Resend failed:", await res.text());
  } else {
    console.log("Email sent to", to);
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function main() {
  if (!existsSync(userData)) {
    throw new Error(
      `Missing IH profile at ${userData}\nRun on a machine with UI: pnpm ih:login\nThen copy data/ih-auth/ to this server.`,
    );
  }

  const log = loadLog();
  const commented = new Set(
    (log.comments || []).map((c) => c.postUrl?.replace(/\?.*$/, "")),
  );
  const today = todayKey();
  const todayCount = (log.comments || []).filter((c) => c.day === today).length;
  if (todayCount >= count && !dryRun) {
    console.log(`Already posted ${todayCount} comments today (${today}). Done.`);
    return;
  }
  const need = dryRun ? count : Math.max(0, count - todayCount);

  // Cron starts ~22:00 Beijing; delay 0–75 min so wall-clock time varies daily.
  if (!dryRun && process.env.IH_SKIP_JITTER !== "1") {
    const maxMin = Math.max(
      0,
      Number(process.env.IH_JITTER_MAX_MINUTES || "75"),
    );
    await humanJitter("Start jitter", 0, maxMin * 60_000);
  }

  // Rebuild profile from idb-export before commenting (Firebase session goes stale overnight).
  const autoReseed =
    process.env.IH_AUTO_RESEED !== "0" &&
    existsSync(join(authDir, "idb-export.json")) &&
    existsSync(join(authDir, "storageState.raw.json"));
  if (!dryRun && autoReseed) {
    const seeded = await reseedIhAuth({
      root,
      chromePath: process.env.IH_CHROME_PATH,
    });
    if (!seeded.ok) {
      throw new Error(
        "IH auto-reseed failed (comment box not a textarea). Re-export idb-export.json from a logged-in desktop.",
      );
    }
  }

  const chromePath =
    process.env.IH_CHROME_PATH ||
    [
      join(process.env.HOME || "", "apps/chrome/opt/google/chrome/google-chrome"),
      join(process.env.HOME || "", "apps/chrome/opt/google/chrome/chrome"),
      join(process.env.HOME || "", "apps/edge/opt/microsoft/msedge/microsoft-edge"),
      "/usr/bin/google-chrome-stable",
      "/usr/bin/google-chrome",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
    ].find((p) => existsSync(p));

  // macOS: prefer Edge channel (IH Firebase session works here; many CN servers cannot reach Google token APIs)
  const channel =
    process.env.IH_BROWSER_CHANNEL ||
    (process.platform === "darwin" && !chromePath ? "msedge" : undefined);

  const proxy = playwrightProxyOption();
  console.log({
    dryRun,
    need,
    today,
    userData,
    chromePath: chromePath || "(playwright default)",
    channel: channel || null,
    proxy: proxy?.server || proxyServer || null,
  });

  const context = await chromium.launchPersistentContext(userData, {
    headless: true,
    viewport: { width: 1440, height: 1000 },
    executablePath: chromePath || undefined,
    channel,
    proxy,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-dev-shm-usage",
    ],
  });
  const page = context.pages()[0] || (await context.newPage());

  try {
    await page.goto("https://www.indiehackers.com/", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForTimeout(2500);
    if (!(await isLoggedIn(page))) {
      throw new Error(
        "IH session expired. Re-run pnpm ih:login and re-copy data/ih-auth/ to the server.",
      );
    }

    const candidates = await listCandidatePosts(page);
    const picks = candidates.filter(
      (c) => !commented.has(`https://www.indiehackers.com${c.href}`),
    );
    console.log(`Candidates: ${candidates.length}, unused: ${picks.length}`);

    const report = [];
    let posted = 0;

    for (const pick of picks) {
      if (posted >= need) break;
      const post = await readPost(page, pick.href);
      if (!post.hasBox) {
        console.log("Skip (no comment box):", post.url);
        continue;
      }
      if (commented.has(post.url)) continue;

      let comment;
      try {
        comment = await generateComment(pick.title, post.body);
      } catch (e) {
        console.error("Generate failed:", e.message);
        continue;
      }

      console.log("\n---", pick.title);
      console.log(comment);

      if (dryRun) {
        report.push(`[dry-run] ${post.url}\n${comment}`);
        posted += 1;
        continue;
      }

      let finalUrl;
      try {
        finalUrl = await postComment(page, comment);
      } catch (e) {
        console.error("Post failed:", e.message);
        report.push(`[failed] ${post.url}: ${e.message}`);
        continue;
      }
      const entry = {
        day: today,
        at: new Date().toISOString(),
        postUrl: finalUrl,
        title: pick.title,
        comment,
      };
      log.comments = log.comments || [];
      log.comments.push(entry);
      saveLog(log);
      commented.add(post.url);
      report.push(finalUrl);
      posted += 1;
      appendFileSync(
        join(logDir, "cron.log"),
        `${entry.at} ${finalUrl}\n`,
        "utf8",
      );
      // Vary gap between comments (2–12 min) so two posts aren't a fixed cadence
      if (posted < need) {
        await humanJitter("Between comments", 2 * 60_000, 12 * 60_000);
      }
    }

    console.log("\nDone. Posted/drafted:", posted);
    for (const line of report) console.log(line);

    if (!dryRun && report.length) {
      await emailReport(report);
    }
  } finally {
    await context.close();
  }
}

main().catch(async (e) => {
  console.error(e);
  appendFileSync(
    join(logDir, "cron.log"),
    `${new Date().toISOString()} ERROR ${e.message}\n`,
    "utf8",
  );
  try {
    if (!dryRun) await emailReport([`ERROR: ${e.message}`]);
  } catch (mailErr) {
    console.error("Error email failed:", mailErr.message);
  }
  process.exit(1);
});
