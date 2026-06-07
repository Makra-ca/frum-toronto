// Resilient query wrapper for Neon (serverless HTTP driver).
//
// Neon auto-suspends its compute when idle. The first query after a quiet
// period — or a brief network blip — can fail with a connection-level error
// (`fetch failed` / `ETIMEDOUT`) before the query ever reaches the database.
// These are transient: a retry a few hundred ms later almost always succeeds
// once the compute is awake.
//
// safeQuery() handles both cases:
//   1. Retries transient connection failures with a short backoff.
//   2. If it still fails (or the error is a real, non-transient one), returns a
//      caller-supplied fallback instead of throwing — so one failed query
//      degrades a single page section rather than crashing the whole page.
// Every fallback is logged with console.error, so failures are never silent.

const TRANSIENT_CODES = new Set([
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
]);

const TRANSIENT_MESSAGES = [
  "fetch failed",
  "connection",
  "timeout",
  "socket hang up",
  "network",
];

function isTransient(err: unknown): boolean {
  // Walk the error + its `cause` chain looking for a transient code/message.
  let current: unknown = err;
  for (let depth = 0; current && depth < 5; depth++) {
    const e = current as { code?: string; message?: string; cause?: unknown };
    if (e.code && TRANSIENT_CODES.has(e.code)) return true;
    if (
      typeof e.message === "string" &&
      TRANSIENT_MESSAGES.some((m) => e.message!.toLowerCase().includes(m))
    ) {
      return true;
    }
    current = e.cause;
  }
  return false;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run a database query with transient-failure retries and a safe fallback.
 *
 * @param queryFn  The query to run (e.g. `() => db.select()...`).
 * @param fallback Value returned if the query ultimately fails.
 * @param opts.label   Optional name used in error logs.
 * @param opts.retries Number of retry attempts for transient errors (default 2).
 */
export async function safeQuery<T>(
  queryFn: () => Promise<T>,
  fallback: T,
  opts?: { label?: string; retries?: number }
): Promise<T> {
  const retries = opts?.retries ?? 2;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await queryFn();
    } catch (err) {
      lastErr = err;
      // Don't waste time retrying a non-transient error (e.g. a SQL mistake).
      if (attempt === retries || !isTransient(err)) break;
      await delay(150 * (attempt + 1)); // 150ms, then 300ms
    }
  }

  console.error(
    `[DB] Query failed${opts?.label ? ` (${opts.label})` : ""} — returning fallback.`,
    lastErr
  );
  return fallback;
}
