#!/usr/bin/env node
/** CLI: Reseed IH auth profile using system Chrome + idb-export.json */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { reseedIhAuth } from "./ih-reseed-lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const result = await reseedIhAuth({ root });
if (!result.ok) process.exit(2);
