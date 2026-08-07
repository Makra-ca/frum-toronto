import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, inArray, like } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  alerts,
  classifieds,
  classifiedCategories,
  shivaNotifications,
  tehillimList,
} from "@/lib/db/schema";

/**
 * Four public CREATE routes took the request body raw — destructured it and
 * hand-checked two or three fields. Measured against the real columns, that
 * meant:
 *
 *   201-char title  -> "value too long for type character varying(200)"  (500)
 *   "24/04/2026"    -> "date/time field value out of range"              (500)
 *
 * Someone posting a mazel tov saw "Something went wrong", with nothing saying
 * which field to fix. The hand-rolled checks caught EMPTY — the case whoever
 * wrote them had in mind — and too long, wrong format and wrong type all fell
 * through to Postgres.
 *
 * These routes also had no tests AT ALL. Every `[id]` edit route is covered,
 * because those were built later on the shared handler; the create half is
 * original code that predates it.
 */

const mocks = vi.hoisted(() => ({
  session: {
    user: { id: "0", role: "member", email: "a@b.test", name: "Poster" },
  },
}));

vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn(async () => mocks.session) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/notifications")>()),
  notifyAdminOfSubmission: vi.fn(async () => undefined),
}));
vi.mock("@/lib/email/send", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email/send")>()),
  sendShivaNoticeEmail: vi.fn(async () => true),
}));

const alertRoute = await import("@/app/api/community/alerts/route");
const classifiedRoute = await import("@/app/api/community/classifieds/route");
const shivaRoute = await import("@/app/api/community/shiva/route");
const tehillimRoute = await import("@/app/api/community/tehillim/route");

const stamp = Date.now();
const TAG = `TestCV${stamp}`;
let member: number;
let categoryId: number;

async function post(
  route: { POST: (r: never) => Promise<Response> },
  payload: Record<string, unknown>
) {
  mocks.session.user.id = String(member);
  mocks.session.user.role = "member";
  const res = await route.POST(
    new Request("http://localhost/x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }) as never
  );
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

beforeAll(async () => {
  const [u] = await db
    .insert(users)
    .values({
      email: `test-cv-${stamp}@frumtoronto.test`,
      firstName: "Test",
      lastName: "Poster",
      role: "member",
      isActive: true,
      emailVerified: new Date(),
    } as never)
    .returning({ id: users.id });
  member = u.id;

  const [cat] = await db
    .insert(classifiedCategories)
    .values({ name: `${TAG} Category`, slug: `test-cv-${stamp}` } as never)
    .returning({ id: classifiedCategories.id });
  categoryId = cat.id;
});

afterAll(async () => {
  await db.delete(alerts).where(eq(alerts.userId, member));
  await db.delete(classifieds).where(eq(classifieds.userId, member));
  await db.delete(shivaNotifications).where(eq(shivaNotifications.userId, member));
  await db.delete(tehillimList).where(eq(tehillimList.userId, member));
  await db
    .delete(classifiedCategories)
    .where(like(classifiedCategories.name, `${TAG}%`));
  await db.delete(users).where(inArray(users.id, [member]));
});

// ─────────────────────────────────────────────────────────────────────────────

describe("alerts", () => {
  const good = {
    title: `${TAG} Alert`,
    content: "Something the community should know about.",
    alertType: "general",
  };

  it("rejects an over-length title with 400, not a Postgres 500", async () => {
    // varchar(200), previously unchecked.
    const { status } = await post(alertRoute, {
      ...good,
      title: "x".repeat(201),
    });
    expect(status).toBe(400);
  });

  it("rejects an unknown alert type", async () => {
    const { status } = await post(alertRoute, { ...good, alertType: "urgent!" });
    expect(status).toBe(400);
  });

  it("REJECTS an unknown urgency instead of silently downgrading it", async () => {
    // The old code did `validUrgencies.includes(urgency) ? urgency : "normal"`,
    // so a typo quietly turned an urgent alert into a normal one.
    const { status } = await post(alertRoute, { ...good, urgency: "criticl" });
    expect(status).toBe(400);
  });

  it("accepts a good alert and keeps the urgency it was given", async () => {
    const { status } = await post(alertRoute, { ...good, urgency: "urgent" });
    expect(status).toBe(201);

    const [row] = await db
      .select({ urgency: alerts.urgency })
      .from(alerts)
      .where(eq(alerts.userId, member));
    expect(row.urgency).toBe("urgent");
  });
});

describe("classifieds", () => {
  const good = () => ({
    title: `${TAG} Item`,
    description: "A good item for sale, in fine condition.",
    categoryId,
  });

  it("rejects an over-length title", async () => {
    const { status } = await post(classifiedRoute, {
      ...good(),
      title: "x".repeat(256),
    });
    expect(status).toBe(400);
  });

  it("rejects a malformed contact email", async () => {
    const { status } = await post(classifiedRoute, {
      ...good(),
      contactEmail: "not-an-email",
    });
    expect(status).toBe(400);
  });

  it("rejects a non-numeric price rather than sending it to a decimal column", async () => {
    const { status } = await post(classifiedRoute, {
      ...good(),
      price: "free please",
    });
    expect(status).toBe(400);
  });

  it("accepts a good listing and stores the price", async () => {
    const { status } = await post(classifiedRoute, { ...good(), price: "25.50" });
    expect(status).toBe(201);

    const [row] = await db
      .select({ price: classifieds.price })
      .from(classifieds)
      .where(eq(classifieds.userId, member));
    expect(Number(row.price)).toBe(25.5);
  });
});

describe("shiva", () => {
  const good = {
    niftarName: `${TAG} Niftar`,
    shivaStart: "2026-09-01",
    shivaEnd: "2026-09-07",
  };

  it("rejects a malformed date instead of passing it to a NOT NULL date column", async () => {
    const { status } = await post(shivaRoute, {
      ...good,
      shivaStart: "01/09/2026",
    });
    expect(status).toBe(400);
  });

  it("rejects an end date before the start", async () => {
    // Nothing compared them before. The public page filters on
    // shiva_end >= today, so an inverted range makes the notice invisible from
    // the moment it is posted — on a bereavement notice, of all things.
    const { status, body } = await post(shivaRoute, {
      ...good,
      shivaStart: "2026-09-07",
      shivaEnd: "2026-09-01",
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/before it starts/i);
  });

  it("still refuses an attachment from an untrusted host", async () => {
    // The allowlist predates this work and must survive it: the schema caps
    // the length, it does not vouch for where the URL points.
    //
    // 200, not 201 — shiva and tehillim return 200 on create while simchas,
    // alerts and classifieds return 201. Pre-existing inconsistency, asserted
    // as it is rather than quietly changed: callers check res.ok, and altering
    // a public response code is not part of adding validation.
    const { status } = await post(shivaRoute, {
      ...good,
      attachmentUrl: "https://evil.example.com/x.pdf",
    });
    expect(status).toBe(200);

    const [row] = await db
      .select({ attachmentUrl: shivaNotifications.attachmentUrl })
      .from(shivaNotifications)
      .where(eq(shivaNotifications.userId, member));
    expect(row.attachmentUrl).toBeNull();
  });
});

describe("tehillim", () => {
  const good = { hebrewName: `${TAG}`, reason: "refuah sheleimah" };

  it("still requires a Hebrew or English name", async () => {
    const { status } = await post(tehillimRoute, { reason: "refuah" });
    expect(status).toBe(400);
  });

  it("rejects an over-length name", async () => {
    const { status } = await post(tehillimRoute, {
      ...good,
      englishName: "x".repeat(201),
    });
    expect(status).toBe(400);
  });

  it("REJECTS an out-of-range duration instead of silently clamping it", async () => {
    // `Math.min(Math.max(parseInt(x) || 14, 1), 30)` turned 900 into 30 and
    // "abc" into 14, telling the submitter nothing either way.
    expect((await post(tehillimRoute, { ...good, durationDays: 900 })).status).toBe(400);
    expect((await post(tehillimRoute, { ...good, durationDays: "abc" })).status).toBe(400);
  });

  it("accepts a good request", async () => {
    // 200 here too — see the note on the shiva test above.
    const { status } = await post(tehillimRoute, { ...good, durationDays: 21 });
    expect(status).toBe(200);
  });
});
