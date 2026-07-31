import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  events,
  simchas,
  classifieds,
  tehillimList,
  shivaNotifications,
} from "@/lib/db/schema";
import { listSubmissions, isRowPast } from "@/lib/submissions/list-query";
import { SUBMISSION_TYPES } from "@/lib/submissions/types";

/**
 * The user's own submissions, across every type.
 *
 * The two things most likely to go wrong here are both silent: showing another
 * user's rows, and marking a date-only row past a day early.
 */

const stamp = Date.now();
const createdUserIds: number[] = [];
const created = {
  events: [] as number[],
  simchas: [] as number[],
  classifieds: [] as number[],
  tehillim: [] as number[],
  shiva: [] as number[],
};

let mineId: number;
let theirsId: number;

async function makeUser(email: string) {
  const [u] = await db
    .insert(users)
    .values({
      email,
      firstName: "Test",
      lastName: "User",
      role: "member",
      isActive: true,
      emailVerified: new Date(),
    })
    .returning({ id: users.id });
  createdUserIds.push(u.id);
  return u.id;
}

beforeAll(async () => {
  mineId = await makeUser(`test-list-mine-${stamp}@frumtoronto.test`);
  theirsId = await makeUser(`test-list-theirs-${stamp}@frumtoronto.test`);

  const [futureEvent] = await db
    .insert(events)
    .values({
      userId: mineId,
      title: "[TEST] future event",
      startTime: new Date("2099-01-01T12:00:00.000Z"),
      approvalStatus: "approved",
      isActive: true,
    })
    .returning({ id: events.id });
  const [pastEvent] = await db
    .insert(events)
    .values({
      userId: mineId,
      title: "[TEST] past event",
      startTime: new Date("2020-01-01T12:00:00.000Z"),
      approvalStatus: "approved",
      isActive: true,
    })
    .returning({ id: events.id });
  const [theirEvent] = await db
    .insert(events)
    .values({
      userId: theirsId,
      title: "[TEST] someone else's event",
      startTime: new Date("2099-01-01T12:00:00.000Z"),
      approvalStatus: "approved",
      isActive: true,
    })
    .returning({ id: events.id });
  created.events.push(futureEvent.id, pastEvent.id, theirEvent.id);

  const [simcha] = await db
    .insert(simchas)
    .values({
      userId: mineId,
      familyName: "[TEST] List Family",
      announcement: "[TEST]",
      eventDate: "2020-05-05",
      approvalStatus: "rejected",
      rejectionReason: "Needs a date",
      isActive: true,
    })
    .returning({ id: simchas.id });
  created.simchas.push(simcha.id);

  const [classified] = await db
    .insert(classifieds)
    .values({
      userId: mineId,
      title: "[TEST] no expiry",
      description: "[TEST]",
      approvalStatus: "pending",
      expiresAt: null,
      isActive: true,
    })
    .returning({ id: classifieds.id });
  created.classifieds.push(classified.id);

  const [permanent] = await db
    .insert(tehillimList)
    .values({
      userId: mineId,
      hebrewName: "[TEST] permanent",
      expiresAt: "2020-01-01",
      isPermanent: true,
      approvalStatus: "approved",
      isActive: true,
    })
    .returning({ id: tehillimList.id });
  created.tehillim.push(permanent.id);

  const [shiva] = await db
    .insert(shivaNotifications)
    .values({
      userId: mineId,
      niftarName: "[TEST] shiva",
      mournerNames: ["[TEST]"],
      shivaStart: "2099-01-01",
      shivaEnd: "2099-01-08",
      approvalStatus: "pending_edit",
    })
    .returning({ id: shivaNotifications.id });
  created.shiva.push(shiva.id);
});

afterAll(async () => {
  if (created.events.length)
    await db.delete(events).where(inArray(events.id, created.events));
  if (created.simchas.length)
    await db.delete(simchas).where(inArray(simchas.id, created.simchas));
  if (created.classifieds.length)
    await db.delete(classifieds).where(inArray(classifieds.id, created.classifieds));
  if (created.tehillim.length)
    await db.delete(tehillimList).where(inArray(tehillimList.id, created.tehillim));
  if (created.shiva.length)
    await db
      .delete(shivaNotifications)
      .where(inArray(shivaNotifications.id, created.shiva));
  if (createdUserIds.length)
    await db.delete(users).where(inArray(users.id, createdUserIds));
});

describe("listSubmissions", () => {
  it("returns the caller's rows and never anyone else's", async () => {
    const mine = await listSubmissions(mineId, "member");
    const titles = mine.map((s) => s.title);

    expect(titles).toContain("[TEST] future event");
    expect(titles).not.toContain("[TEST] someone else's event");
    // Assert on the id created here, not a count — other files share these
    // tables.
    expect(mine.some((s) => s.id === created.events[2])).toBe(false);
  });

  it("spans types, not just events", async () => {
    const mine = await listSubmissions(mineId, "member");
    const types = new Set(mine.map((s) => s.type));

    expect(types).toContain("event");
    expect(types).toContain("simcha");
    expect(types).toContain("classified");
    expect(types).toContain("shiva");
  });

  it("carries the formatter each type needs", async () => {
    const mine = await listSubmissions(mineId, "member");

    // A simcha's event_date is a DATE and an event's start_time is a
    // timestamp. One `detail` field with no discriminator renders every simcha
    // a day early.
    expect(mine.find((s) => s.type === "simcha")?.detailKind).toBe("date");
    expect(mine.find((s) => s.type === "event")?.detailKind).toBe("instant");
  });

  it("hands a date-only value through unparsed", async () => {
    const mine = await listSubmissions(mineId, "member");
    const simcha = mine.find((s) => s.type === "simcha");

    // Not an ISO instant — turning "2020-05-05" into a Date here is exactly
    // how it becomes the 4th.
    expect(simcha?.detail).toBe("2020-05-05");
  });

  it("offers no edit link on a past item", async () => {
    const mine = await listSubmissions(mineId, "member");
    const past = mine.find((s) => s.title === "[TEST] past event");

    expect(past?.isPast).toBe(true);
    expect(past?.canEdit).toBe(false);
    // Editing it would unpublish an event that already happened, leaving
    // nothing to re-approve.
    expect(past?.editHref).toBeNull();
  });

  it("offers an edit link on something still to come", async () => {
    const mine = await listSubmissions(mineId, "member");
    const future = mine.find((s) => s.title === "[TEST] future event");

    expect(future?.isPast).toBe(false);
    expect(future?.canEdit).toBe(true);
    expect(future?.editHref).toContain("/edit");
  });

  it("shows the rejection reason so the user can act on it", async () => {
    const mine = await listSubmissions(mineId, "member");
    const rejected = mine.find((s) => s.approvalStatus === "rejected");

    expect(rejected?.rejectionReason).toBe("Needs a date");
  });

  it("links to the public page only once something is approved", async () => {
    const mine = await listSubmissions(mineId, "member");

    expect(mine.find((s) => s.title === "[TEST] future event")?.publicHref).toContain(
      "/community/calendar/"
    );
    // pending_edit means it is off the site, so there is nowhere to link.
    expect(mine.find((s) => s.type === "shiva")?.publicHref).toBeNull();
  });

  it("sorts newest first, and the same way every time", async () => {
    const first = await listSubmissions(mineId, "member");
    const second = await listSubmissions(mineId, "member");

    expect(first.map((s) => `${s.type}:${s.id}`)).toEqual(
      second.map((s) => `${s.type}:${s.id}`)
    );
    const dates = first.map((s) => s.createdAt ?? "");
    expect([...dates].sort().reverse()).toEqual(dates);
  });
});

describe("isRowPast", () => {
  const now = new Date("2026-07-30T12:00:00.000Z");

  it("never marks an undated type past", () => {
    // simchas, kosher alerts and blog posts have no expiry concept, so nothing
    // can vanish behind the past toggle.
    expect(isRowPast(SUBMISSION_TYPES.simcha, { eventDate: "1999-01-01" }, now)).toBe(
      false
    );
  });

  it("treats a NULL expiry as not past", () => {
    expect(isRowPast(SUBMISSION_TYPES.classified, { expiresAt: null }, now)).toBe(
      false
    );
  });

  it("exempts a permanent tehillim entry however old it is", () => {
    expect(
      isRowPast(
        SUBMISSION_TYPES.tehillim,
        { expiresAt: "1999-01-01", isPermanent: true },
        now
      )
    ).toBe(false);
  });

  it("compares a date column against Toronto's day, not the server's", () => {
    // 01:00 UTC on the 31st is still the 30th in Toronto. A server-clock
    // comparison would call a notice ending today finished.
    const lateUtc = new Date("2026-07-31T01:00:00.000Z");

    expect(
      isRowPast(SUBMISSION_TYPES.shiva, { shivaEnd: "2026-07-30" }, lateUtc)
    ).toBe(false);
    expect(
      isRowPast(SUBMISSION_TYPES.shiva, { shivaEnd: "2026-07-29" }, lateUtc)
    ).toBe(true);
  });

  it("compares an instant column against the actual moment", () => {
    expect(
      isRowPast(SUBMISSION_TYPES.event, { startTime: new Date("2026-07-30T11:00:00Z") }, now)
    ).toBe(true);
    expect(
      isRowPast(SUBMISSION_TYPES.event, { startTime: new Date("2026-07-30T13:00:00Z") }, now)
    ).toBe(false);
  });
});
