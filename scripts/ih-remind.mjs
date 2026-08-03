#!/usr/bin/env node
/**
 * Indie Hackers publish reminder via Resend.
 *
 * Usage:
 *   node scripts/ih-remind.mjs              # today's ET date, or nearest ready
 *   node scripts/ih-remind.mjs --date 2026-07-28
 *   node scripts/ih-remind.mjs --dry-run
 *
 * Env (.env.local / process):
 *   RESEND_API_KEY   required to send
 *   EMAIL_FROM       e.g. Forge Regex <noreply@service.ststudio.top>
 *   IH_REMIND_TO     default 34310374@qq.com
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const dateIdx = args.indexOf("--date");
const dateArg = dateIdx >= 0 ? args[dateIdx + 1] : null;

function etToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parseCalendar(md) {
  const rows = [];
  for (const line of md.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    // | # | Date | File | Theme | Status | Post URL |
    if (cells.length < 6) continue;
    if (cells[1] === "#" || cells[1] === "---" || !/^\d+$/.test(cells[1])) {
      continue;
    }
    const file = cells[3].replace(/`/g, "");
    rows.push({
      n: cells[1],
      date: cells[2],
      file,
      theme: cells[4],
      status: cells[5].replace(/\*\*/g, "").toLowerCase(),
    });
  }
  return rows;
}

function extractFence(md, heading) {
  const re = new RegExp(
    `## ${heading}\\s*\n+\\\`\\\`\\\`text\\n([\\s\\S]*?)\\\`\\\`\\\``,
    "i"
  );
  const m = md.match(re);
  return m ? m[1].trim() : "";
}

function extractMeta(md, label) {
  const m = md.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`, "i"));
  return m ? m[1].trim() : "";
}

const calendarPath = join(root, "content/indiehackers/calendar.md");
const rows = parseCalendar(readFileSync(calendarPath, "utf8"));
const wantDate = dateArg || etToday();

let row = rows.find((r) => r.date === wantDate);
if (!row) {
  row = rows.find((r) => r.status.includes("ready"));
}
if (!row) {
  console.error("No matching calendar row for", wantDate);
  process.exit(1);
}

const postPath = join(root, "content/indiehackers", row.file);
if (!existsSync(postPath)) {
  console.error("Missing post file:", postPath);
  process.exit(1);
}

const postMd = readFileSync(postPath, "utf8");
const title = extractFence(postMd, "Title") || row.theme;
const body = extractFence(postMd, "Body");
const group = extractMeta(postMd, "Group") || "Building";

const to = process.env.IH_REMIND_TO || "34310374@qq.com";
const from =
  process.env.EMAIL_FROM || "Forge Regex <onboarding@resend.dev>";
const apiKey = process.env.RESEND_API_KEY;

const subject = `[IH remind] ${row.date} — ${row.theme}`;
const text = [
  `Indie Hackers publish reminder (ET 8–10am window)`,
  ``,
  `Date: ${row.date}`,
  `Theme: ${row.theme}`,
  `Group: ${group}`,
  `Status: ${row.status}`,
  `Draft: ${postPath}`,
  ``,
  `--- Title ---`,
  title,
  ``,
  `--- Body (paste into IH) ---`,
  body || "(open the draft file for full body)",
  ``,
  `After posting: mark calendar.md as published and add the URL.`,
  `Do not auto-post — paste manually.`,
].join("\n");

console.log(
  JSON.stringify(
    {
      to,
      from,
      subject,
      date: row.date,
      theme: row.theme,
      group,
      postPath,
      dryRun,
      hasApiKey: Boolean(apiKey),
    },
    null,
    2
  )
);

if (dryRun) {
  console.log("\n--- dry-run text preview ---\n");
  console.log(text.slice(0, 800));
  process.exit(0);
}

if (!apiKey) {
  console.error("RESEND_API_KEY missing — set it in .env.local");
  process.exit(1);
}

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from,
    to: [to],
    subject,
    text,
    html: `<pre style="font-family:ui-monospace,monospace;white-space:pre-wrap">${text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")}</pre>`,
  }),
});

const raw = await res.text();
if (!res.ok) {
  console.error("Resend failed", res.status, raw.slice(0, 400));
  process.exit(1);
}
console.log("Sent OK", raw);
