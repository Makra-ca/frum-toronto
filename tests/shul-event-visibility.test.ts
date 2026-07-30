import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { events, shuls } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { GET } from "@/app/api/shuls/slug/[slug]/route";

// The public shul page and its API listed a shul's events filtered only on
// isActive + a future date — with NO approval filter. So anything pending or
// rejected showed publicly on that shul's page.
//
// It also defeats the submissions design: a gabbai edits their shul's event,
// we tell them it has come off the site, and it stays visible here.

const SLUG = `test-shul-visibility-${Date.now()}`;
let shulId: number;
const createdEventIds: number[] = [];

async function makeEvent(title: string, approvalStatus: string) {
  const [row] = await db
    .insert(events)
    .values({
      shulId,
      title,
      // Comfortably in the future so the date filter never hides it.
      startTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      approvalStatus,
      isActive: true,
    })
    .returning({ id: events.id });
  createdEventIds.push(row.id);
  return row.id;
}

async function fetchShul() {
  const res = await GET(new Request(`http://localhost/api/shuls/slug/${SLUG}`), {
    params: Promise.resolve({ slug: SLUG }),
  });
  expect(res.status).toBe(200);
  return (await res.json()) as { events: { id: number }[] };
}

beforeAll(async () => {
  const [shul] = await db
    .insert(shuls)
    .values({ name: "[TEST] Visibility Shul", slug: SLUG, isActive: true })
    .returning({ id: shuls.id });
  shulId = shul.id;
});

afterAll(async () => {
  // Delete the events first — events.shul_id references shuls.id with no
  // ON DELETE, so removing the shul first would fail.
  if (createdEventIds.length) {
    await db.delete(events).where(inArray(events.id, createdEventIds));
  }
  await db.delete(shuls).where(eq(shuls.id, shulId));
});

describe("public shul events", () => {
  it("shows an approved event", async () => {
    const id = await makeEvent("[TEST] Approved event", "approved");

    const body = await fetchShul();

    // Positive control: without this, a route that returns nothing at all
    // would pass every exclusion test below.
    expect(body.events.map((e) => e.id)).toContain(id);
  });

  it("does not show a pending event", async () => {
    const id = await makeEvent("[TEST] Pending event", "pending");

    const body = await fetchShul();

    expect(body.events.map((e) => e.id)).not.toContain(id);
  });

  it("does not show a rejected event", async () => {
    const id = await makeEvent("[TEST] Rejected event", "rejected");

    const body = await fetchShul();

    expect(body.events.map((e) => e.id)).not.toContain(id);
  });

  it("does not show an event the owner has edited and taken off the site", async () => {
    const id = await makeEvent("[TEST] Edited event", "pending_edit");

    const body = await fetchShul();

    expect(body.events.map((e) => e.id)).not.toContain(id);
  });
});
