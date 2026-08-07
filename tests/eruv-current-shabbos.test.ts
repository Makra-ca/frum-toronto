import { describe, it, expect, afterEach, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import { eruvStatus } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";

// The public eruv API used to return the newest row by status_date regardless
// of age, so a status entered weeks ago read as current. Someone could carry on
// Shabbos on the strength of a stale UP. The status is now keyed to the Shabbos
// it applies to, so an old row can only ever surface as `previous`.
//
// Dates are far-future Saturdays so they cannot collide with real rows.
const THIS_SHABBOS = "2031-08-09";
const LAST_SHABBOS = "2031-08-02";

// Wed 2031-08-06, 10:00 AM Toronto -- a normal midweek moment, when the coming
// Shabbos has not been checked yet. This is the common case, not an edge case.
const MIDWEEK = new Date("2031-08-06T14:00:00Z");

const { GET } = await import("@/app/api/community/eruv/route");

const usedDates = [THIS_SHABBOS, LAST_SHABBOS];

async function seed(statusDate: string, isUp: boolean, message: string | null = null) {
  await db
    .insert(eruvStatus)
    .values({ statusDate, isUp, message })
    .onConflictDoUpdate({
      target: eruvStatus.statusDate,
      set: { isUp, message },
    });
}

async function get() {
  const res = await GET();
  return res.json();
}

afterEach(async () => {
  vi.useRealTimers();
  await db.delete(eruvStatus).where(inArray(eruvStatus.statusDate, usedDates));
});

afterAll(async () => {
  await db.delete(eruvStatus).where(inArray(eruvStatus.statusDate, usedDates));
});

describe("GET /api/community/eruv is keyed to the current Shabbos", () => {
  it("returns the status entered for this Shabbos", async () => {
    await seed(THIS_SHABBOS, true, "Checked Friday morning.");
    vi.useFakeTimers();
    vi.setSystemTime(MIDWEEK);

    const body = await get();

    expect(body.shabbosDate).toBe(THIS_SHABBOS);
    expect(body.status).toMatchObject({ isUp: true, message: "Checked Friday morning." });
  });

  // The regression test for the staleness defect.
  it("does NOT return a past Shabbos as the current status", async () => {
    await seed(LAST_SHABBOS, true, "Last week was fine.");
    vi.useFakeTimers();
    vi.setSystemTime(MIDWEEK);

    const body = await get();

    expect(body.shabbosDate).toBe(THIS_SHABBOS);
    expect(body.status).toBeNull();
    expect(body.previous).toMatchObject({ statusDate: LAST_SHABBOS, isUp: true });
  });

  it("keeps previous separate from status when both exist", async () => {
    await seed(LAST_SHABBOS, false, "Wire down.");
    await seed(THIS_SHABBOS, true, "Repaired.");
    vi.useFakeTimers();
    vi.setSystemTime(MIDWEEK);

    const body = await get();

    expect(body.status).toMatchObject({ isUp: true });
    expect(body.previous).toMatchObject({ statusDate: LAST_SHABBOS, isUp: false });
  });

  it("returns nulls rather than failing when nothing has ever been entered", async () => {
    // 1902 predates any real row, so `previous` has nothing to find either.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("1902-08-06T14:00:00Z"));

    const body = await get();

    expect(body.status).toBeNull();
    expect(body.previous).toBeNull();
  });
});
