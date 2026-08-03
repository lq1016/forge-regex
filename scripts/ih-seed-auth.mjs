#!/usr/bin/env node
/**
 * Seed data/ih-auth/user-data from session-export files:
 *   - storageState.raw.json (or storageState.json)
 *   - idb-export.json
 *
 * Usage: node scripts/ih-seed-auth.mjs
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const authDir = join(root, "data", "ih-auth");
const userData = join(authDir, "user-data");
const idbPath = join(authDir, "idb-export.json");
const statePath = existsSync(join(authDir, "storageState.json"))
  ? join(authDir, "storageState.json")
  : join(authDir, "storageState.raw.json");

if (!existsSync(idbPath) || !existsSync(statePath)) {
  console.error("Missing idb-export.json or storageState*.json in data/ih-auth/");
  process.exit(1);
}

const idb = JSON.parse(readFileSync(idbPath, "utf8"));
const rawState = JSON.parse(readFileSync(statePath, "utf8"));
const state = {
  cookies: (rawState.cookies || []).filter((c) =>
    String(c.domain || "").includes("indiehackers.com"),
  ),
  origins: (rawState.origins || []).filter((o) =>
    String(o.origin || "").includes("indiehackers.com"),
  ),
};
writeFileSync(join(authDir, "storageState.json"), JSON.stringify(state, null, 2));

rmSync(userData, { recursive: true, force: true });
mkdirSync(userData, { recursive: true });

const context = await chromium.launchPersistentContext(userData, {
  headless: true,
  viewport: { width: 1280, height: 900 },
});
const page = context.pages()[0] || (await context.newPage());

await context.addCookies(state.cookies);
await page.goto("https://www.indiehackers.com/", {
  waitUntil: "domcontentloaded",
  timeout: 60_000,
});
await page.waitForTimeout(1500);

// Inject IndexedDB firebase auth
await page.evaluate(async (payload) => {
  for (const [dbName, stores] of Object.entries(payload)) {
    await new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onerror = () => reject(req.error);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const storeName of Object.keys(stores)) {
          if (!db.objectStoreNames.contains(storeName)) {
            // firebaseLocalStorage uses keyPath fbase_key
            db.createObjectStore(storeName, { keyPath: "fbase_key" });
          }
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const names = Object.keys(stores);
        if (!names.length) {
          db.close();
          resolve();
          return;
        }
        // ensure stores exist
        const missing = names.filter((n) => !db.objectStoreNames.contains(n));
        if (missing.length) {
          db.close();
          const req2 = indexedDB.open(dbName, (db.version || 1) + 1);
          req2.onupgradeneeded = () => {
            const d2 = req2.result;
            for (const n of missing) {
              if (!d2.objectStoreNames.contains(n)) {
                d2.createObjectStore(n, { keyPath: "fbase_key" });
              }
            }
          };
          req2.onsuccess = () => writeAll(req2.result);
          req2.onerror = () => reject(req2.error);
          return;
        }
        writeAll(db);

        function writeAll(database) {
          const tx = database.transaction(names, "readwrite");
          for (const storeName of names) {
            const store = tx.objectStore(storeName);
            for (const item of stores[storeName] || []) {
              store.put(item);
            }
          }
          tx.oncomplete = () => {
            database.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        }
      };
    });
  }
}, idb);

await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);

const loggedIn = await page
  .locator('img[alt="User Avatar"]')
  .first()
  .isVisible()
  .catch(() => false);

await context.storageState({ path: join(authDir, "storageState.json") });
await context.close();

writeFileSync(join(authDir, "logged-in-at.txt"), new Date().toISOString() + "\n");

if (!loggedIn) {
  console.error("Seed finished but avatar not detected — session may be incomplete.");
  process.exit(2);
}
console.log("Seeded IH auth profile at", userData);
