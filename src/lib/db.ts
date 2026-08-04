import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync, renameSync } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "forge.sqlite");
const LEGACY_JSON = path.join(DATA_DIR, "subscriptions.json");

let db: DatabaseSync | null = null;

function ensureSchema(database: DatabaseSync): void {
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS subscriptions (
      customer_id TEXT PRIMARY KEY NOT NULL,
      subscription_id TEXT,
      email TEXT,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_subscription_id
      ON subscriptions(subscription_id)
      WHERE subscription_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_subscriptions_email
      ON subscriptions(email)
      WHERE email IS NOT NULL;

    CREATE TABLE IF NOT EXISTS generate_cache (
      prompt_hash TEXT PRIMARY KEY NOT NULL,
      prompt TEXT NOT NULL,
      pattern TEXT NOT NULL,
      flags TEXT NOT NULL,
      explanation_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      hit_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS excel_cache (
      cache_key TEXT PRIMARY KEY NOT NULL,
      prompt TEXT NOT NULL,
      dialect TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      hit_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS shares (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL,
      prompt TEXT NOT NULL DEFAULT '',
      pattern TEXT NOT NULL,
      flags TEXT NOT NULL DEFAULT '',
      explanation_json TEXT NOT NULL DEFAULT '[]',
      test_text TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_shares_email ON shares(email);

    CREATE TABLE IF NOT EXISTS free_ip_usage (
      ip TEXT NOT NULL,
      day TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (ip, day)
    );

    CREATE TABLE IF NOT EXISTS free_fp_usage (
      fp TEXT NOT NULL,
      day TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (fp, day)
    );

    CREATE TABLE IF NOT EXISTS free_email_usage (
      email TEXT NOT NULL,
      day TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (email, day)
    );

    CREATE TABLE IF NOT EXISTS cn_user_usage (
      user_key TEXT NOT NULL,
      day TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_key, day)
    );

    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY NOT NULL,
      password_hash TEXT NOT NULL,
      email_verified_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_codes (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL,
      purpose TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      meta TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_auth_codes_email_purpose
      ON auth_codes(email, purpose);

    CREATE TABLE IF NOT EXISTS user_history (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL,
      prompt TEXT NOT NULL DEFAULT '',
      pattern TEXT NOT NULL,
      flags TEXT NOT NULL DEFAULT '',
      test_text TEXT NOT NULL DEFAULT '',
      explanation_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_user_history_email_created
      ON user_history(email, created_at DESC);
  `);

  ensureCnOrdersSchema(database);
  ensureColumn(database, "subscriptions", "current_period_end", "TEXT");
}

/** Native WeChat/Alipay schema; migrates empty legacy Huifu `cn_orders` if present. */
function ensureCnOrdersSchema(database: DatabaseSync): void {
  const cols = database
    .prepare("PRAGMA table_info(cn_orders)")
    .all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  const isLegacy =
    names.size > 0 && names.has("trade_order_id") && !names.has("out_trade_no");

  if (isLegacy) {
    const count = (
      database.prepare("SELECT COUNT(*) AS c FROM cn_orders").get() as {
        c: number;
      }
    ).c;
    if (count > 0) {
      database.exec(
        "ALTER TABLE cn_orders RENAME TO cn_orders_legacy_huifu"
      );
      console.info(
        `[db] Renamed legacy cn_orders (${count} row(s)) → cn_orders_legacy_huifu`
      );
    } else {
      database.exec("DROP TABLE cn_orders");
      console.info("[db] Dropped empty legacy cn_orders (Huifu schema)");
    }
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS cn_orders (
      out_trade_no TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL,
      channel TEXT NOT NULL,
      total_fee_fen INTEGER NOT NULL,
      status TEXT NOT NULL,
      code_url TEXT,
      transaction_id TEXT,
      created_at TEXT NOT NULL,
      paid_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_cn_orders_email ON cn_orders(email);
  `);

  ensureColumn(database, "cn_orders", "code_url", "TEXT");
  ensureColumn(database, "cn_orders", "transaction_id", "TEXT");
  ensureColumn(database, "cn_orders", "paid_at", "TEXT");
}

function ensureColumn(
  database: DatabaseSync,
  table: string,
  column: string,
  typeSql: string
): void {
  const cols = database
    .prepare(`PRAGMA table_info(${table})`)
    .all() as { name: string }[];
  if (cols.some((c) => c.name === column)) return;
  database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeSql}`);
}

type LegacyStore = {
  byCustomer?: Record<
    string,
    {
      customerId: string;
      subscriptionId?: string;
      email?: string;
      status: string;
      updatedAt: string;
    }
  >;
};

function migrateFromJson(database: DatabaseSync): void {
  if (!existsSync(LEGACY_JSON)) return;

  const count = database
    .prepare("SELECT COUNT(*) AS c FROM subscriptions")
    .get() as { c: number };
  if (count.c > 0) return;

  try {
    const parsed = JSON.parse(readFileSync(LEGACY_JSON, "utf8")) as LegacyStore;
    const rows = Object.values(parsed.byCustomer ?? {});
    if (rows.length === 0) return;

    const insert = database.prepare(`
      INSERT INTO subscriptions (customer_id, subscription_id, email, status, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(customer_id) DO UPDATE SET
        subscription_id = excluded.subscription_id,
        email = excluded.email,
        status = excluded.status,
        updated_at = excluded.updated_at
    `);

    database.exec("BEGIN");
    for (const row of rows) {
      insert.run(
        row.customerId,
        row.subscriptionId ?? null,
        row.email ? row.email.trim().toLowerCase() : null,
        row.status,
        row.updatedAt
      );
    }
    database.exec("COMMIT");

    renameSync(LEGACY_JSON, `${LEGACY_JSON}.migrated.bak`);
    console.info(
      `[db] Migrated ${rows.length} subscription(s) from subscriptions.json → forge.sqlite`
    );
  } catch (err) {
    try {
      database.exec("ROLLBACK");
    } catch {
      // ignore
    }
    console.error("[db] JSON migration failed", err);
  }
}

/** Server-only SQLite handle (Node 22+ node:sqlite). */
export function getDb(): DatabaseSync {
  if (db) return db;
  mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(DB_PATH);
  ensureSchema(db);
  migrateFromJson(db);
  return db;
}

/** Open DB early so JSON→SQLite migration runs even before first Pro lookup. */
export function ensureDbReady(): void {
  getDb();
}

export function getDbPath(): string {
  return DB_PATH;
}
