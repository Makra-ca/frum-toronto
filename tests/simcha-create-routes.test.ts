import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, inArray, like } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, simchas } from "@/lib/db/schema";

/**
 * Nothing exercised either simcha CREATE route — the existing tests all hit
 * the `[id]` PATCH handlers. So when the date became required and the public
 * route gained its first schema, the change was covered at the schema level
 * and nowhere else: a schema that is never called still passes its own tests.
 *
 * The public route is the one that matters most here. It previously
 * destructured the raw body and hand-checked two fields, so `eventDate`
 * reached the insert unvalidated and an over-length `familyName` surfaced as a
 * raw Postgres error rather than a 400.
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

const publicRoute = await import("@/app/api/community/simchas/route");
const adminRoute = await import("@/app/api/admin/simchas/route");

const stamp = Date.now();
const createdUserIds: number[] = [];
let member: number;
let admin: number;

const NAME = `TestSimcha${stamp}`;

async function makeUser(suffix: string, extra: Record<string, unknown> = {}) {
  const [u] = await db
    .insert(users)
    .values({
      email: `test-simcreate-${suffix}-${stamp}@frumtoronto.test`,
      firstName: "Test",
      lastName: suffix,
      role: "member",
      isActive: true,
      emailVerified: new Date(),
      ...extra,
    } as never)
    .returning({ id: users.id });
  createdUserIds.push(u.id);
  return u.id;
}

function body(extra: Record<string, unknown> = {}) {
  return {
    familyName: NAME,
    announcement: "Mazel tov to the whole family on this wonderful simcha.",
    ...extra,
  };
}

async function submitPublic(payload: Record<string, unknown>) {
  mocks.session.user.id = String(member);
  mocks.session.user.role = "member";
  const res = await publicRoute.POST(
    new Request("http://localhost/api/community/simchas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }) as never
  );
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function submitAdmin(payload: Record<string, unknown>) {
  mocks.session.user.id = String(admin);
  mocks.session.user.role = "admin";
  const res = await adminRoute.POST(
    new Request("http://localhost/api/admin/simchas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }) as never
  );
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

beforeAll(async () => {
  member = await makeUser("member");
  admin = await makeUser("admin", { role: "admin" });
});

afterAll(async () => {
  await db.delete(simchas).where(like(simchas.familyName, `${NAME}%`));
  if (createdUserIds.length) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
});

describe("the public submission route", () => {
  it("refuses a simcha with no date", async () => {
    // Since /simchas sorts by COALESCE(event_date, created_at), a blank date
    // silently files the announcement under the day it was submitted.
    const { status } = await submitPublic(body());
    expect(status).toBe(400);
  });

  it("refuses a malformed date instead of passing it to the insert", async () => {
    const { status } = await submitPublic(body({ eventDate: "24/04/2026" }));
    expect(status).toBe(400);
  });

  it("refuses an over-length family name with a 400, not a database error", async () => {
    // The column is varchar(200) and there was no length check at all, so this
    // used to surface as a 500 from Postgres.
    const { status } = await submitPublic(
      body({ familyName: "x".repeat(201), eventDate: "2026-04-24" })
    );
    expect(status).toBe(400);
  });

  it("accepts a well-formed submission and stores the date", async () => {
    const { status, body: created } = await submitPublic(
      body({ eventDate: "2026-04-24", location: "Toronto" })
    );
    expect(status).toBe(201);

    // The public route wraps the row: { simcha, message }. The admin one
    // returns the row directly — worth knowing, and worth a test noticing.
    const [row] = await db
      .select({ eventDate: simchas.eventDate, location: simchas.location })
      .from(simchas)
      .where(eq(simchas.id, created.simcha.id));
    expect(row.eventDate).toBe("2026-04-24");
    expect(row.location).toBe("Toronto");
  });
});

describe("the admin create route", () => {
  it("refuses a simcha with no date, same as the public one", async () => {
    // Consistency was the explicit ask: one rule on every path.
    const { status } = await submitAdmin(body());
    expect(status).toBe(400);
  });

  it("accepts a backdated simcha — the whole point of the change", async () => {
    const { status, body: created } = await submitAdmin(
      body({ eventDate: "2026-04-24" })
    );
    expect(status).toBe(201);

    const [row] = await db
      .select({ eventDate: simchas.eventDate })
      .from(simchas)
      .where(eq(simchas.id, created.id));
    expect(row.eventDate).toBe("2026-04-24");
  });
});
