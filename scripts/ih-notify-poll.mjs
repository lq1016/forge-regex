#!/usr/bin/env node
/**
 * Poll Indie Hackers notifications and email new replies / follows.
 *
 *   node scripts/ih-notify-poll.mjs           # live
 *   node scripts/ih-notify-poll.mjs --dry-run # print only
 *   IH_NOTIFY_SEED=1 ...                     # mark current as seen, no email
 *
 * State: data/ih-comments/notify-seen.json
 */
import { chromium } from "playwright";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { applyProxyEnv, playwrightProxyOption } from "./ih-proxy.mjs";
import { reseedIhAuth } from "./ih-reseed-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const logDir = join(root, "data", "ih-comments");
const seenPath = join(logDir, "notify-seen.json");
mkdirSync(logDir, { recursive: true });

const dryRun =
  process.argv.includes("--dry-run") || process.env.IH_NOTIFY_DRY_RUN === "1";
const seedOnly =
  process.argv.includes("--seed") || process.env.IH_NOTIFY_SEED === "1";

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
applyProxyEnv();

function loadSeen() {
  if (!existsSync(seenPath)) return { ids: [], username: null };
  try {
    return JSON.parse(readFileSync(seenPath, "utf8"));
  } catch {
    return { ids: [], username: null };
  }
}

function saveSeen(state) {
  // keep last 500 ids
  const ids = [...new Set(state.ids)].slice(-500);
  writeFileSync(
    seenPath,
    JSON.stringify({ ...state, ids, updatedAt: new Date().toISOString() }, null, 2),
  );
}

function notifId(n) {
  return createHash("sha1")
    .update([n.date, n.summary, n.href, n.excerpt].join("|"))
    .digest("hex")
    .slice(0, 16);
}

function classify(summary) {
  const s = summary.toLowerCase();
  if (/follow/i.test(s)) return "follow";
  if (/replied to your post/i.test(s)) return "reply_post";
  if (/replied to your comment/i.test(s)) return "reply_comment";
  if (/mention|mentioned/i.test(s)) return "mention";
  if (/upvote|liked|upvoted/i.test(s)) return "upvote";
  return "other";
}

function wanted(type) {
  const allow = (process.env.IH_NOTIFY_TYPES || "reply_post,reply_comment,follow,mention")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return allow.includes(type) || allow.includes("all");
}

async function emailReport(subject, html) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const to = process.env.IH_REMIND_TO || "34310374@qq.com";
  if (!apiKey || !from) {
    console.log("Skip email (RESEND_API_KEY / EMAIL_FROM not set)");
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!res.ok) console.error("Resend failed:", await res.text());
  else console.log("Email sent to", to);
}

async function resolveUsername(page) {
  await page.goto("https://www.indiehackers.com/", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(2500);
  return page.evaluate(() => {
    const a = [...document.querySelectorAll("a")].find((el) =>
      /\/[^/]+\/notifications$/.test(el.getAttribute("href") || ""),
    );
    const href = a?.getAttribute("href") || "";
    const m = href.match(/^\/([^/]+)\/notifications$/);
    return m?.[1] || null;
  });
}

async function scrapeNotifications(page, username) {
  await page.goto(`https://www.indiehackers.com/${username}/notifications`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(5000);
  await page.evaluate(() => {
    document
      .querySelectorAll(
        "#onetrust-consent-sdk, #onetrust-banner-sdk, .onetrust-pc-dark-filter",
      )
      .forEach((el) => el.remove());
  });

  return page.evaluate(() => {
    const unreadMatch = (document.body.innerText || "").match(
      /(\d+)\s+Unread Notifications/i,
    );
    const items = [...document.querySelectorAll(".user-notification")].map(
      (el) => {
        const date =
          el.querySelector(".user-notification__date")?.innerText?.trim() || "";
        const summary =
          el
            .querySelector(".user-notification__notification-summary")
            ?.innerText?.replace(/\s+/g, " ")
            .trim() || "";
        const excerpt =
          el
            .querySelector(".user-notification__content, .user-notification__markdown-content")
            ?.innerText?.replace(/\s+/g, " ")
            .trim()
            .slice(0, 400) || "";
        const link =
          el.querySelector("a.user-notification__action-link") ||
          el.querySelector('a[href*="/post/"]');
        const href = link?.getAttribute("href") || "";
        return { date, summary, excerpt, href };
      },
    );
    return {
      unread: unreadMatch ? Number(unreadMatch[1]) : null,
      items,
    };
  });
}

async function main() {
  const chrome =
    process.env.IH_CHROME_PATH ||
    join(process.env.HOME || "", "apps/chrome/opt/google/chrome/google-chrome");
  const userData = join(root, "data/ih-auth/user-data");
  const proxy = playwrightProxyOption();

  if (process.env.IH_AUTO_RESEED === "1") {
    const seeded = await reseedIhAuth({ root, chromePath: chrome });
    if (!seeded.ok) throw new Error("IH auto-reseed failed before notify poll");
  }

  const context = await chromium.launchPersistentContext(userData, {
    headless: true,
    executablePath: existsSync(chrome) ? chrome : undefined,
    viewport: { width: 1280, height: 900 },
    proxy,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = context.pages()[0] || (await context.newPage());

  try {
    const seen = loadSeen();
    const username =
      process.env.IH_USERNAME ||
      seen.username ||
      (await resolveUsername(page));
    if (!username) throw new Error("Could not resolve IH username");

    const { unread, items } = await scrapeNotifications(page, username);
    const enriched = items.map((n) => {
      const type = classify(n.summary);
      const id = notifId(n);
      const url = n.href
        ? n.href.startsWith("http")
          ? n.href
          : `https://www.indiehackers.com${n.href}`
        : `https://www.indiehackers.com/${username}/notifications`;
      return { ...n, type, id, url };
    });

    const seenSet = new Set(seen.ids || []);
    const isFirst = seenSet.size === 0 || seedOnly;
    const fresh = enriched.filter((n) => wanted(n.type) && !seenSet.has(n.id));

    console.log({
      username,
      unread,
      total: enriched.length,
      fresh: fresh.length,
      dryRun,
      seedOnly: isFirst,
    });

    // Always remember what we saw
    for (const n of enriched) seenSet.add(n.id);
    saveSeen({ ids: [...seenSet], username });

    if (isFirst && !process.env.IH_NOTIFY_FORCE_EMAIL) {
      console.log(
        `Seeded ${enriched.length} notifications as seen (no email). Future new ones will email.`,
      );
      appendFileSync(
        join(logDir, "notify-cron.log"),
        `${new Date().toISOString()} seeded username=${username} count=${enriched.length} unread=${unread}\n`,
      );
      return;
    }

    if (!fresh.length) {
      appendFileSync(
        join(logDir, "notify-cron.log"),
        `${new Date().toISOString()} ok username=${username} fresh=0 unread=${unread}\n`,
      );
      return;
    }

    const lines = fresh.map(
      (n) =>
        `[${n.type}] ${n.date}\n${n.summary}\n${n.excerpt}\n${n.url}\n`,
    );
    for (const l of lines) console.log(l);

    if (dryRun) return;

    const subject = `[IH notify] ${fresh.length} new — ${fresh.map((n) => n.type).join(", ")}`;
    const html = `<p>Indie Hackers · <b>${fresh.length}</b> new (unread badge: ${unread ?? "?"})</p>
<ul>${fresh
      .map(
        (n) => `<li><b>${n.type}</b> · ${escapeHtml(n.date)}<br/>
${escapeHtml(n.summary)}<br/>
${n.excerpt ? `<i>${escapeHtml(n.excerpt)}</i><br/>` : ""}
<a href="${escapeHtml(n.url)}">${escapeHtml(n.url)}</a></li>`,
      )
      .join("\n")}</ul>`;
    await emailReport(subject, html);
    appendFileSync(
      join(logDir, "notify-cron.log"),
      `${new Date().toISOString()} emailed ${fresh.length} username=${username}\n`,
    );
  } finally {
    await context.close();
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

main().catch(async (e) => {
  console.error(e);
  appendFileSync(
    join(logDir, "notify-cron.log"),
    `${new Date().toISOString()} ERROR ${e.message}\n`,
  );
  try {
    await emailReport(`[IH notify] ERROR`, `<pre>${escapeHtml(e.message)}</pre>`);
  } catch {}
  process.exit(1);
});
