import { describe, it, expect, afterAll } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  events,
  simchas,
  classifieds,
  kosherAlerts,
  alerts,
  shivaNotifications,
  tehillimList,
  blogPosts,
} from "@/lib/db/schema";

// `updated_at` exists for two things: detecting a concurrent edit-vs-approve,
// and resurfacing a corrected old item at the top of the approvals queue.
//
// Both are silently inert if the column only has a DEFAULT — that fires on
// insert and never again. The value moves only because the Drizzle schema
// declares `$onUpdate`. Before this change the repo had 17 `updatedAt` columns
// and ZERO `$onUpdate`, so every one of them was frozen at creation.

const TABLES = {
  events,
  simchas,
  classifieds,
  kosherAlerts,
  alerts,
  shivaNotifications,
  tehillimList,
  blogPosts,
};

const createdEventIds: number[] = [];

afterAll(async () => {
  if (createdEventIds.length) {
    await db.delete(events).where(inArray(events.id, createdEventIds));
  }
});

describe("updated_at", () => {
  // Structural, and exhaustive. Forgetting $onUpdate on ONE table is the real
  // failure mode, and a behavioural test of a single table would not catch it.
  it.each(Object.entries(TABLES))(
    "%s declares $onUpdate, so the column is not frozen at insert",
    (name, table) => {
      const column = getTableColumns(table).updatedAt as unknown as {
        onUpdateFn?: unknown;
      };
      expect(column, `${name} has no updatedAt column`).toBeDefined();
      expect(typeof column.onUpdateFn, `${name}.updatedAt lacks $onUpdate`).toBe(
        "function"
      );
    }
  );

  it("actually moves when a row is updated", async () => {
    const [row] = await db
      .insert(events)
      .values({ title: "[TEST] updated_at", startTime: new Date() })
      .returning({ id: events.id });
    createdEventIds.push(row.id);

    const read = async () => {
      const [r] = await db.select().from(events).where(eq(events.id, row.id));
      return r.updatedAt!;
    };

    // Compare two UPDATE values, never an update against the insert. The
    // insert stamp comes from Postgres `now()` (Neon's clock) while $onUpdate
    // uses this machine's, so any skew makes an insert-vs-update comparison
    // flaky in both directions.
    await db.update(events).set({ title: "[TEST] a" }).where(eq(events.id, row.id));
    const first = await read();

    await new Promise((r) => setTimeout(r, 10));

    await db.update(events).set({ title: "[TEST] b" }).where(eq(events.id, row.id));
    const second = await read();

    expect(second.getTime()).toBeGreaterThan(first.getTime());
  });
});
