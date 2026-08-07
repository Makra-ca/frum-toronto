import { db } from "@/lib/db";
import { eruvStatus } from "@/lib/db/schema";
import { desc, eq, lt } from "drizzle-orm";
import { currentShabbos } from "@/lib/eruv/shabbos";

export interface EruvStatusRow {
  id: number;
  statusDate: string;
  isUp: boolean;
  message: string | null;
  updatedBy: number | null;
  updatedAt: Date | null;
}

export interface CurrentEruvStatus {
  /** The Shabbos in effect, "YYYY-MM-DD". */
  shabbosDate: string;
  /** The status for that Shabbos, or null when it has not been checked yet. */
  status: EruvStatusRow | null;
  /** The most recent status strictly BEFORE it, offered as dated context. */
  previous: EruvStatusRow | null;
}

/**
 * The eruv status for the Shabbos currently in effect.
 *
 * Shared by the public API and the /eruv page so the two cannot disagree about
 * which Shabbos is current or about what counts as stale.
 *
 * `status` is null for most of the week by design: the eruv is generally not
 * confirmed until Friday, so Sunday through Thursday there is genuinely nothing
 * yet. That is the normal state, not a failure.
 *
 * `now` is injectable so tests can pick a moment without `vi.useFakeTimers()`.
 * Faking timers here would also fake the ones undici uses for socket connect,
 * which makes database calls in the same test intermittently time out.
 */
export async function getCurrentEruvStatus(now?: Date): Promise<CurrentEruvStatus> {
  const shabbosDate = currentShabbos(now ?? new Date());

  const [status] = await db
    .select()
    .from(eruvStatus)
    .where(eq(eruvStatus.statusDate, shabbosDate))
    .limit(1);

  const [previous] = await db
    .select()
    .from(eruvStatus)
    .where(lt(eruvStatus.statusDate, shabbosDate))
    .orderBy(desc(eruvStatus.statusDate))
    .limit(1);

  return {
    shabbosDate,
    status: status ?? null,
    previous: previous ?? null,
  };
}

/**
 * Recent statuses, newest first, for the history list.
 *
 * Ordered by status_date with an `id` tiebreaker — imported and bulk-entered
 * rows share timestamps, and without a tiebreaker a stable order is not
 * guaranteed.
 */
export async function getRecentEruvStatuses(limit: number): Promise<EruvStatusRow[]> {
  return db
    .select()
    .from(eruvStatus)
    .orderBy(desc(eruvStatus.statusDate), desc(eruvStatus.id))
    .limit(limit);
}
