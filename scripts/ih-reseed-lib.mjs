/**
 * Rebuild IH Playwright profile from idb-export.json + storageState.raw.json.
 * Requires proxy on CN servers so Firebase token refresh works inside Chrome.
 */
import { chromium } from "playwright";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { applyProxyEnv, playwrightProxyOption } from "./ih-proxy.mjs";

function resolveChrome(chromePath) {
  return (
    chromePath ||
    process.env.IH_CHROME_PATH ||
    [
      join(process.env.HOME || "", "apps/chrome/opt/google/chrome/google-chrome"),
      join(process.env.HOME || "", "apps/chrome/opt/google/chrome/chrome"),
      "/usr/bin/google-chrome-stable",
      "/usr/bin/google-chrome",
    ].find((p) => existsSync(p))
  );
}

/**
 * @param {{ root: string, chromePath?: string, verifyPostUrl?: string }} opts
 * @returns {Promise<{ ok: boolean, composerTag: string | null, detail: object }>}
 */
export async function reseedIhAuth(opts) {
  const root = opts.root;
  const authDir = join(root, "data", "ih-auth");
  const userData = join(authDir, "user-data");
  const idbPath = join(authDir, "idb-export.json");
  const rawPath = join(authDir, "storageState.raw.json");

  if (!existsSync(idbPath) || !existsSync(rawPath)) {
    throw new Error(
      `Missing ${idbPath} or ${rawPath} — cannot auto-reseed. Re-export auth from a logged-in desktop.`,
    );
  }

  applyProxyEnv();
  const proxy = playwrightProxyOption();
  const chrome = resolveChrome(opts.chromePath);
  const verifyPostUrl =
    opts.verifyPostUrl ||
    "https://www.indiehackers.com/post/how-to-rank-1-on-chatgpt-7c19eef6fa";

  console.log("Auto-reseed IH auth…", {
    chrome: chrome || "(playwright default)",
    proxy: proxy?.server || null,
  });

  const idb = JSON.parse(readFileSync(idbPath, "utf8"));
  const raw = JSON.parse(readFileSync(rawPath, "utf8"));
  const cookies = (raw.cookies || []).filter((c) =>
    String(c.domain || "").includes("indiehackers.com"),
  );

  rmSync(userData, { recursive: true, force: true });
  mkdirSync(userData, { recursive: true });

  const context = await chromium.launchPersistentContext(userData, {
    headless: true,
    executablePath: chrome || undefined,
    viewport: { width: 1440, height: 1000 },
    proxy,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = context.pages()[0] || (await context.newPage());
    await context.addCookies(cookies);

    await page.goto("https://www.indiehackers.com/", { waitUntil: "commit" });
    await page.waitForTimeout(800);

    await page.evaluate(async (payload) => {
      for (const [dbName, stores] of Object.entries(payload)) {
        await new Promise((resolve) => {
          const del = indexedDB.deleteDatabase(dbName);
          del.onsuccess = del.onerror = del.onblocked = () => resolve();
        });
        await new Promise((resolve, reject) => {
          const req = indexedDB.open(dbName, 1);
          req.onupgradeneeded = () => {
            const db = req.result;
            for (const storeName of Object.keys(stores)) {
              if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: "fbase_key" });
              }
            }
          };
          req.onsuccess = () => {
            const db = req.result;
            const names = Object.keys(stores);
            const tx = db.transaction(names, "readwrite");
            for (const storeName of names) {
              const store = tx.objectStore(storeName);
              for (const item of stores[storeName] || []) store.put(item);
            }
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
          req.onerror = () => reject(req.error);
        });
      }
    }, idb);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(6000);

    const home = await page.evaluate(() => ({
      headerJoin: !!document.querySelector(
        'banner a[href="/sign-up"], header a[href="/sign-up"]',
      ),
      headerAvatar: !!document.querySelector(
        'header img[alt^="Avatar for"], .site-header img[alt^="Avatar for"]',
      ),
    }));

    await page.goto(verifyPostUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(6000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    const composer = await page.evaluate(() => {
      const el = document.querySelector(
        "a.comment-box__textarea, textarea.comment-box__textarea",
      );
      return {
        tag: el?.tagName || null,
        href: el?.getAttribute?.("href") || null,
        className: el?.className || null,
      };
    });

    const detail = { chrome, home, composer };
    console.log(detail);

    writeFileSync(
      join(authDir, "logged-in-at.txt"),
      new Date().toISOString() + "\n",
    );

    const ok = composer.tag === "TEXTAREA";
    if (!ok) {
      console.error("FAIL: composer is not a textarea — auth not accepted by IH");
    } else {
      console.log("OK: logged in with working comment textarea");
    }
    return { ok, composerTag: composer.tag, detail };
  } finally {
    await context.close();
  }
}
