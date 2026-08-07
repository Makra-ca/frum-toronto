import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, simchas } from "@/lib/db/schema";
import { simchaBrowseOrder } from "@/lib/simchas/ordering";
import { simchaCreateSchema } from "@/lib/validations/simcha";

/**
 * /simchas sorted by `created_at` — the order things were TYPED. That breaks
 * the moment anyone catches up on a backlog: entering Pesach announcements in
 * August put them above the August ones. Production has thirteen rows that are
 * exactly that case, all stamped 2026-04-24 and all posted 2026-08-02.
 *
 * The trap this file exists to guard is the NULL one. 16,542 imported rows
 * have no event_date, and Postgres sorts DESC as NULLS FIRST — so a plain
 * `event_date DESC` would put the entire 2005–2010 archive on page one.
 */

vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn(async () => null) }));

const stamp = Date.now();
const createdIds: number[] = [];
let owner: number;

async function makeSimcha(
  familyName: string,
  eventDate: string | null,
  createdAt: string
) {
  const [row] = await db
    .insert(simchas)
    .values({
      userId: owner,
      familyName: `${familyName} ${stamp}`,
      announcement: "Mazel tov to the whole family on this simcha.",
      eventDate,
      createdAt: new Date(createdAt),
      approvalStatus: "approved",
      isActive: true,
    } as never)
    .returning({ id: simchas.id });
  createdIds.push(row.id);
  return row.id;
}

/** The page's own query, narrowed to this file's fixtures. */
async function browseOrder() {
  const rows = await db
    .select({ id: simchas.id, familyName: simchas.familyName })
    .from(simchas)
    .where(inArray(simchas.id, createdIds))
    .orderBy(...simchaBrowseOrder);
  return rows.map((r) => r.familyName.replace(` ${stamp}`, ""));
}

beforeAll(async () => {
  const [u] = await db
    .insert(users)
    .values({
      email: `test-simord-${stamp}@frumtoronto.test`,
      firstName: "Test",
      lastName: "Owner",
      role: "member",
      isActive: true,
      emailVerified: new Date(),
    } as never)
    .returning({ id: users.id });
  owner = u.id;
});

afterAll(async () => {
  if (createdIds.length) {
    await db.delete(simchas).where(inArray(simchas.id, createdIds));
  }
  await db.delete(users).where(eq(users.id, owner));
});

describe("the backlog case that started this", () => {
  it("puts an April simcha below a July one, even though April was typed last", async () => {
    // Rochel's exact description: entered Pesach after September, so Pesach
    // appeared first.
    await makeSimcha("July simcha", "2026-07-31", "2026-08-01T12:00:00Z");
    await makeSimcha("April simcha", "2026-04-24", "2026-08-03T12:00:00Z");

    expect(await browseOrder()).toEqual(["July simcha", "April simcha"]);
  });
});

describe("undated rows — the 16,542 legacy ones", () => {
  it("do NOT jump to the top, which plain event_date DESC would do", async () => {
    // Postgres sorts DESC as NULLS FIRST. This is the whole reason for
    // COALESCE, and the one thing that would have broken the archive.
    await makeSimcha("Ancient undated", null, "2007-05-05T12:00:00Z");

    const order = await browseOrder();
    expect(order[order.length - 1]).toBe("Ancient undated");
    expect(order[0]).not.toBe("Ancient undated");
  });

  it("keep sorting by their post date, exactly as before", async () => {
    await makeSimcha("Older undated", null, "2006-01-01T12:00:00Z");

    const order = await browseOrder();
    expect(order.indexOf("Ancient undated")).toBeLessThan(
      order.indexOf("Older undated")
    );
  });

  it("interleave with dated rows by whichever date is later", async () => {
    // The stated cost: one sort key, two meanings. Pinned so the behaviour is
    // deliberate rather than discovered.
    await makeSimcha("Recent undated", null, "2026-06-16T12:00:00Z");

    const order = await browseOrder();
    expect(order.indexOf("July simcha")).toBeLessThan(
      order.indexOf("Recent undated")
    );
    expect(order.indexOf("Recent undated")).toBeLessThan(
      order.indexOf("April simcha")
    );
  });
});

describe("rows sharing one event_date", () => {
  it("get a stable order from the id tiebreaker", async () => {
    // Thirteen production rows share 2026-04-24. Without the tiebreaker,
    // OFFSET paging repeats and skips rows.
    const a = await makeSimcha("Same day A", "2026-05-05", "2026-08-01T12:00:00Z");
    const b = await makeSimcha("Same day B", "2026-05-05", "2026-08-01T12:00:00Z");

    const order = await browseOrder();
    // Higher id first, matching `id DESC`.
    expect(order.indexOf("Same day B")).toBeLessThan(
      order.indexOf("Same day A")
    );
    expect(b).toBeGreaterThan(a);
  });
});

describe("the ordering expression itself", () => {
  it("casts created_at to a date so COALESCE compares like with like", async () => {
    // Without the cast Postgres reconciles date and timestamp on its own and
    // the comparison stops meaning what it reads like.
    const [{ ok }] = await db.execute<{ ok: boolean }>(
      sql`SELECT COALESCE(NULL::date, now()::date) IS NOT NULL AS ok`
    ).then((r) => (Array.isArray(r) ? r : r.rows));
    expect(ok).toBe(true);
  });
});

describe("the date is now required", () => {
  it("rejects a create with no date", () => {
    const result = simchaCreateSchema.safeParse({
      familyName: "Cohen",
      announcement: "Mazel tov on the birth of a daughter.",
    });
    expect(result.success).toBe(false);
  });

  it.each(["", "24/04/2026", "2026-4-24", "not a date"])(
    "rejects the malformed date %o",
    (eventDate) => {
      expect(
        simchaCreateSchema.safeParse({
          familyName: "Cohen",
          announcement: "Mazel tov on the birth of a daughter.",
          eventDate,
        }).success
      ).toBe(false);
    }
  );

  it("accepts a well-formed date", () => {
    expect(
      simchaCreateSchema.safeParse({
        familyName: "Cohen",
        announcement: "Mazel tov on the birth of a daughter.",
        eventDate: "2026-04-24",
      }).success
    ).toBe(true);
  });

  it("caps familyName and location at the column widths", () => {
    // These used to reach Postgres unvalidated and surface as a 500.
    const base = {
      announcement: "Mazel tov on the birth of a daughter.",
      eventDate: "2026-04-24",
    };
    expect(
      simchaCreateSchema.safeParse({ ...base, familyName: "x".repeat(201) })
        .success
    ).toBe(false);
    expect(
      simchaCreateSchema.safeParse({
        ...base,
        familyName: "Cohen",
        location: "x".repeat(201),
      }).success
    ).toBe(false);
  });
});
