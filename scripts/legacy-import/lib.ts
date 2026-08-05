/**
 * Shared helpers for importing the legacy FrumToronto MSSQL data.
 *
 * The legacy system lives on two databases:
 *   FrumToronto.dbo.MemberList      — 3,307 community members
 *   FrumShared.dbo.BlogEntries      — 35,007 posts; simchas/shiva/kosher alerts
 *                                     were all modelled as *blog categories*,
 *                                     not as their own tables.
 *
 * ALL reads against MSSQL are SELECT-only. Nothing here writes to the legacy DB.
 */
import { readFileSync } from "node:fs";
import sqlsrv from "mssql";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import * as dotenv from "dotenv";

// ============================================
// LEGACY (MSSQL) CONNECTION — READ ONLY
// ============================================

export type LegacyDb = "FrumToronto" | "FrumShared";

export async function connectLegacy(database: LegacyDb) {
  const required = ["MSSQL_USER", "MSSQL_PASSWORD", "MSSQL_SERVER"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing legacy DB env vars: ${missing.join(", ")}`);
  }

  return new sqlsrv.ConnectionPool({
    user: process.env.MSSQL_USER!,
    password: process.env.MSSQL_PASSWORD!,
    server: process.env.MSSQL_SERVER!,
    port: parseInt(process.env.MSSQL_PORT || "1433", 10),
    database,
    options: { encrypt: false, trustServerCertificate: true },
    connectionTimeout: 60_000,
    requestTimeout: 300_000,
  }).connect();
}

// ============================================
// LEGACY DATE HANDLING
// ============================================

/**
 * The legacy app stored dates as OLE automation serials (float days since
 * 1899-12-30) — the same encoding Excel uses. 25569 is the number of days from
 * that epoch to the Unix epoch.
 *
 * These are deliberately computed with integer day arithmetic and formatted
 * from a UTC-anchored instant. Going through local-time Date components would
 * make the resulting calendar date depend on the machine's timezone, which is
 * exactly the class of bug that produced wrong Hebrew dates and zmanim in this
 * repo before (see the 2026-07-26/27 notes in CLAUDE.md).
 */
const OLE_EPOCH_OFFSET_DAYS = 25569;

export function oleToDateString(serial: number | null | undefined): string | null {
  if (serial == null || !Number.isFinite(serial)) return null;
  const days = Math.floor(serial);
  const ms = (days - OLE_EPOCH_OFFSET_DAYS) * 86_400_000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** Full instant including the fractional time-of-day, anchored in UTC. */
export function oleToTimestamp(serial: number | null | undefined): Date | null {
  if (serial == null || !Number.isFinite(serial)) return null;
  const ms = Math.round((serial - OLE_EPOCH_OFFSET_DAYS) * 86_400_000);
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Adds days to a 'YYYY-MM-DD' string without touching local time. */
export function addDaysToDateString(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ============================================
// LEGACY HTML -> PLAIN TEXT
// ============================================

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
  eacute: "é",
  uuml: "ü",
  ouml: "ö",
  auml: "ä",
};

/**
 * Windows-1252 mapping for the 0x80–0x9F range.
 *
 * The legacy site was authored in Windows-1252 and wrote numeric entities using
 * cp1252 *byte* values, so a curly apostrophe was stored as "&#146;". Those code
 * points are invisible C1 control characters in Unicode, which is why decoding
 * them naively produced 1,168 simcha rows containing garbage where an apostrophe
 * belonged ("Canadas" instead of "Canada’s"). Anything in this range has to
 * go through the cp1252 table, not String.fromCodePoint.
 */
const CP1252_C1: Record<number, string> = {
  128: "€", 130: "‚", 131: "ƒ", 132: "„", 133: "…", 134: "†", 135: "‡",
  136: "ˆ", 137: "‰", 138: "Š", 139: "‹", 140: "Œ", 142: "Ž", 145: "‘",
  146: "’", 147: "“", 148: "”", 149: "•", 150: "–", 151: "—", 152: "˜",
  153: "™", 154: "š", 155: "›", 156: "œ", 158: "ž", 159: "Ÿ",
};

function decodeEntities(input: string): string {
  return (
    input
      // Numeric decimal. This is how the legacy editor stored Hebrew, e.g.
      // "&#1496;&#1493;&#1489;&#1497;&#1501;" for טובים. The trailing semicolon
      // is optional because the legacy editor frequently omitted it
      // ("Tizki L&#146Mitzvos!!"), which browsers tolerate.
      .replace(/&#(\d+);?/g, (_, n) => safeCodePoint(parseInt(n, 10)))
      .replace(/&#[xX]([0-9a-fA-F]+);?/g, (_, h) => safeCodePoint(parseInt(h, 16)))
      .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, name) => {
        const key = String(name).toLowerCase();
        return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, key)
          ? NAMED_ENTITIES[key]
          : m;
      })
  );
}

function safeCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 1 || code > 0x10ffff) return "";
  if (code >= 128 && code <= 159) return CP1252_C1[code] ?? "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

/**
 * Converts a legacy HTML body into the plain text the current UI expects.
 *
 * This matters: the public simchas page renders `{simcha.announcement}` as a
 * JSX text child, so raw markup would be shown literally as "<br />" and
 * "&amp;". The nine hand-entered rows already use plain text with newlines,
 * so this matches the convention Rochel is currently writing by hand.
 *
 * Strip-then-decode is applied repeatedly to a fixed point because some legacy
 * rows are double-encoded — "&amp;amp;" and "&lt;br&gt;" both occur, and a
 * single pass leaves a literal "&amp;" or "<br>" on screen. Two passes cover
 * everything observed; the cap just bounds pathological input.
 */
const MAX_DECODE_PASSES = 3;

function stripTags(input: string): string {
  let s = input.replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  // Block-level boundaries become newlines so paragraph structure survives.
  s = s.replace(/<\s*br\s*\/?\s*>/gi, "\n");
  s = s.replace(/<\s*\/\s*(p|div|li|tr|h[1-6])\s*>/gi, "\n");
  s = s.replace(/<\s*(p|div|li|tr|h[1-6])[^>]*>/gi, "\n");
  return s.replace(/<[^>]*>/g, "");
}

export function htmlToText(input: string | null | undefined): string {
  if (!input) return "";

  let s = String(input);

  for (let pass = 0; pass < MAX_DECODE_PASSES; pass++) {
    const before = s;
    s = decodeEntities(stripTags(s));
    if (s === before) break;
  }

  // Any C1 control characters that survived (from genuinely mis-encoded bytes
  // rather than entities) carry no meaning in text and would be invisible.
  s = s.replace(/[\u0080-\u009F]/g, "");

  // Normalise whitespace: CRLF -> LF, collapse runs of blank lines, trim edges.
  s = s.replace(/\r\n?/g, "\n");
  s = s.replace(/[ \t ]+/g, " ");
  s = s
    .split("\n")
    .map((l) => l.trim())
    .join("\n");
  s = s.replace(/\n{3,}/g, "\n\n");

  return s.trim();
}

/** Collapses to a single line — for titles and short varchar columns. */
export function htmlToLine(input: string | null | undefined): string {
  return htmlToText(input).replace(/\s*\n\s*/g, " ").trim();
}

/** Hard-truncates to a column's varchar limit without splitting a surrogate pair. */
export function fit(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  const cut = Array.from(value).slice(0, maxLen).join("");
  return cut;
}

// ============================================
// TARGET (POSTGRES) CONNECTION
// ============================================

export interface Target {
  sql: NeonQueryFunction<false, false>;
  host: string;
  isTest: boolean;
}

/**
 * Resolves the target database by READING THE FILE, never via process.env.
 *
 * This used to be `dotenv.config({ path: useTest ? ".env.test" : ".env" })`
 * followed by reading process.env.DATABASE_URL, and it silently sent --test
 * runs to PRODUCTION. Every runner calls loadLegacyEnv() first for the MSSQL
 * credentials, which loads .env and sets DATABASE_URL to the primary database.
 * dotenv does NOT overwrite an already-set variable (override defaults to
 * false), so the later .env.test load was a no-op — while the banner still
 * printed "TEST BRANCH". A --test --commit run wrote 311 rows and renumbered
 * 36 rows on primary on 2026-08-05 before the mismatched host was noticed.
 *
 * Parsing the file directly removes the dependency on load order entirely, and
 * the assertion below makes the failure loud rather than silent if the two
 * files ever point at the same database.
 */
export function connectTarget(useTest: boolean): Target {
  const path = useTest ? ".env.test" : ".env";
  const read = (p: string): string | undefined => {
    try {
      return dotenv.parse(readFileSync(p)).DATABASE_URL;
    } catch {
      return undefined;
    }
  };

  const url = read(path);
  if (!url) throw new Error(`DATABASE_URL missing from ${path}`);

  if (useTest) {
    const primary = read(".env");
    if (primary && new URL(primary).host === new URL(url).host) {
      throw new Error(
        `REFUSING TO RUN: --test resolved to the same host as .env ` +
          `(${new URL(url).host}). A "test" run must never target production.`
      );
    }
  }

  return { sql: neon(url), host: new URL(url).host, isTest: useTest };
}

// ============================================
// CLI
// ============================================

export interface Options {
  /** Writes only happen when true. Default is a dry run. */
  commit: boolean;
  useTest: boolean;
  /** Cap rows processed — for a fast sanity pass over a big category. */
  limit: number | null;
}

export function parseOptions(): Options {
  const argv = process.argv.slice(2);
  const limitArg = argv.find((a) => a.startsWith("--limit="));
  return {
    commit: argv.includes("--commit"),
    useTest: argv.includes("--test"),
    limit: limitArg ? parseInt(limitArg.split("=")[1], 10) : null,
  };
}

export function announce(name: string, opts: Options, target: Target) {
  console.log("=".repeat(72));
  console.log(name);
  console.log("=".repeat(72));
  console.log(`Target : ${target.isTest ? "TEST BRANCH" : "PRIMARY"} (${target.host})`);
  console.log(`Mode   : ${opts.commit ? "COMMIT (will write)" : "DRY RUN (no writes)"}`);
  if (opts.limit) console.log(`Limit  : ${opts.limit}`);
  console.log("");
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Loads .env for the legacy MSSQL credentials regardless of target choice. */
export function loadLegacyEnv() {
  dotenv.config({ path: ".env" });
}
