#!/usr/bin/env node
/**
 * Auto-publish next ready Indie Hackers post from content/indiehackers/calendar.md
 *
 * Cadence: at most 1 post per run; skip if a post was published within IH_POST_MIN_GAP_DAYS (default 3).
 *
 *   node scripts/ih-publish-queue.mjs --dry-run
 *   IH_SKIP_JITTER=1 CONFIRM_POST=1 node scripts/ih-publish-queue.mjs
 *
 * Cron (Beijing ~22:00): installed by scripts/ih-install-cron.sh
 */
import { chromium } from "playwright";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomInt } from "node:crypto";
import { applyProxyEnv, playwrightProxyOption } from "./ih-proxy.mjs";
import { reseedIhAuth } from "./ih-reseed-lib.mjs";
import { publishIhPost } from "./ih-post-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const ihDir = join(root, "content", "indiehackers");
const calendarPath = join(ihDir, "calendar.md");
const postsDir = join(ihDir, "posts");
const logDir = join(root, "data", "ih-comments");
mkdirSync(logDir, { recursive: true });

const dryRun =
  process.argv.includes("--dry-run") || process.env.IH_POST_DRY_RUN === "1";
const confirm =
  process.env.CONFIRM_POST === "1" || process.env.IH_AUTO_POST === "1";
const minGapDays = Math.max(1, Number(process.env.IH_POST_MIN_GAP_DAYS || "3"));

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

function todayKey(tz = "America/New_York") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parseCalendar(md) {
  const rows = [];
  for (const line of md.split("\n")) {
    if (!/^\|\s*\d+\s*\|/.test(line)) continue;
    const cells = line.split("|").map((c) => c.trim());
    // | # | Date | File | Theme | Status | Post URL |
    if (cells.length < 7) continue;
    const num = cells[1];
    const date = cells[2];
    const fileCell = cells[3];
    const theme = cells[4];
    const status = cells[5].replace(/\*/g, "").trim().toLowerCase();
    const url = cells[6] || "";
    const fileMatch = fileCell.match(/`([^`]+)`/);
    if (!fileMatch) continue;
    rows.push({
      num,
      date,
      file: fileMatch[1],
      theme,
      status,
      url: url.trim(),
      raw: line,
    });
  }
  return rows;
}

function parsePostMarkdown(text) {
  const titleMatch = text.match(/## Title\s*```text\s*([\s\S]*?)```/);
  const bodyMatch = text.match(/## Body\s*```text\s*([\s\S]*?)```/);
  if (!titleMatch || !bodyMatch) {
    throw new Error("Post markdown missing ## Title / ## Body fenced blocks");
  }
  return {
    title: titleMatch[1].trim(),
    body: bodyMatch[1].trim(),
  };
}

function daysBetween(a, b) {
  const da = new Date(`${a}T12:00:00Z`);
  const db = new Date(`${b}T12:00:00Z`);
  return Math.round((db - da) / 86_400_000);
}

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

async function emailReport(subject, lines) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const to = process.env.IH_REMIND_TO || "34310374@qq.com";
  if (!apiKey || !from) {
    console.log("Skip email (RESEND_API_KEY / EMAIL_FROM not set)");
    return;
  }
  const html = `<pre>${lines
    .map((l) =>
      String(l)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;"),
    )
    .join("\n")}</pre>`;
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

function markPublished(_calendarMd, row, postPath, url) {
  const calendarMd = readFileSync(calendarPath, "utf8");
  const updated = calendarMd
    .split("\n")
    .map((line) => {
      if (!line.includes(`\`${row.file}\``)) return line;
      if (!/ready/i.test(line)) return line;
      const parts = line.split("|");
      // ["", " # ", " date ", " `file` ", " theme ", " status ", " url ", ""]
      if (parts.length < 7) return line;
      parts[5] = " **published** ";
      parts[6] = ` ${url} `;
      return parts.join("|");
    })
    .join("\n");
  writeFileSync(calendarPath, updated);

  let postMd = readFileSync(postPath, "utf8");
  postMd = postMd.replace(/\*\*Status:\*\*\s*ready/i, "**Status:** published");
  if (!/\*\*URL:\*\*/i.test(postMd)) {
    postMd = postMd.replace(
      /(\*\*Calendar date:\*\*[^\n]*)/,
      `$1\n**URL:** ${url}`,
    );
  } else {
    postMd = postMd.replace(/\*\*URL:\*\*\s*\S+/i, `**URL:** ${url}`);
  }
  writeFileSync(postPath, postMd);
}

async function main() {
  if (!existsSync(calendarPath)) {
    throw new Error(`Missing ${calendarPath}`);
  }
  const calendarMd = readFileSync(calendarPath, "utf8");
  const rows = parseCalendar(calendarMd);
  const todayEt = todayKey("America/New_York");

  const published = rows.filter((r) => r.status === "published" && r.url);
  let lastPubDay = null;
  for (const f of ["last-post.json", "launch-published.json"]) {
    const p = join(logDir, f);
    if (!existsSync(p)) continue;
    try {
      const j = JSON.parse(readFileSync(p, "utf8"));
      if (j.at) {
        lastPubDay = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/New_York",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(j.at));
        break;
      }
    } catch {
      /* ignore */
    }
  }
  // Fallback: calendar schedule date of latest published row (less accurate)
  if (!lastPubDay && published.length) {
    lastPubDay = published.map((r) => r.date).sort().at(-1);
  }

  if (lastPubDay && daysBetween(lastPubDay, todayEt) < minGapDays) {
    const msg = `Skip: last published day ${lastPubDay}, need ${minGapDays}d gap (today ET ${todayEt}).`;
    console.log(msg);
    appendFileSync(
      join(logDir, "posts-cron.log"),
      `${new Date().toISOString()} ${msg}\n`,
    );
    return;
  }

  const next = rows.find((r) => r.status === "ready");
  if (!next) {
    console.log("No ready posts in calendar.");
    return;
  }

  const postPath = join(postsDir, next.file.replace(/^posts\//, ""));
  if (!existsSync(postPath)) {
    throw new Error(`Missing post file: ${postPath}`);
  }
  const { title, body } = parsePostMarkdown(readFileSync(postPath, "utf8"));
  console.log({
    dryRun,
    confirm,
    todayEt,
    next: { date: next.date, file: next.file, theme: next.theme },
    title,
  });

  if (dryRun) {
    console.log("--- BODY PREVIEW ---\n" + body.slice(0, 400) + "\n...");
    return;
  }

  if (!confirm && process.env.IH_AUTO_POST !== "1") {
    console.log("Refusing to publish without CONFIRM_POST=1 or IH_AUTO_POST=1");
    return;
  }

  if (process.env.IH_SKIP_JITTER !== "1") {
    const maxMin = Math.max(0, Number(process.env.IH_JITTER_MAX_MINUTES || "75"));
    await humanJitter("Start jitter", 0, maxMin * 60_000);
  }

  if (process.env.IH_AUTO_RESEED !== "0") {
    const seeded = await reseedIhAuth({
      root,
      chromePath: process.env.IH_CHROME_PATH,
    });
    if (!seeded.ok) throw new Error("IH auto-reseed failed before post publish");
  }

  const chrome =
    process.env.IH_CHROME_PATH ||
    join(process.env.HOME || "", "apps/chrome/opt/google/chrome/google-chrome");
  const userData = join(root, "data/ih-auth/user-data");
  const proxy = playwrightProxyOption();

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
    const url = await publishIhPost(page, { title, body });
    console.log("Published:", url);

    markPublished(readFileSync(calendarPath, "utf8"), next, postPath, url);
    appendFileSync(
      join(logDir, "posts-cron.log"),
      `${new Date().toISOString()} ${next.file} ${url}\n`,
    );
    writeFileSync(
      join(logDir, "last-post.json"),
      JSON.stringify(
        {
          at: new Date().toISOString(),
          file: next.file,
          theme: next.theme,
          title,
          url,
        },
        null,
        2,
      ),
    );
    await emailReport(`[IH post] ${todayEt} — ${next.theme}`, [
      title,
      url,
      `file: ${next.file}`,
    ]);
  } finally {
    await context.close();
  }
}

main().catch(async (e) => {
  console.error(e);
  appendFileSync(
    join(logDir, "posts-cron.log"),
    `${new Date().toISOString()} ERROR ${e.message}\n`,
  );
  try {
    await emailReport(`[IH post] ERROR`, [`ERROR: ${e.message}`]);
  } catch {}
  process.exit(1);
});
