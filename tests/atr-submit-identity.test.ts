import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestUser, cleanupTestUsers } from "./utils/test-db";

/**
 * POST /api/ask-the-rabbi/submit took `name` and `email` from the request body.
 *
 * `userId` was session-derived and correct, so this was never an authentication
 * hole — but the identity SHOWN to the rabbi in the admin queue, and the
 * `replyTo` his answer is addressed to, were both whatever the sender typed.
 * A question could arrive signed as someone else, with the reply routed
 * wherever the sender chose.
 *
 * Both now come from the account row.
 */

const notifySpy = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: String(userId), role: "member" } })),
}));
vi.mock("@/lib/notifications", () => ({ notifyAdminOfSubmission: notifySpy }));

const { POST } = await import("@/app/api/ask-the-rabbi/submit/route");
const { db } = await import("@/lib/db");
const { askTheRabbiSubmissions } = await import("@/lib/db/schema");

const stamp = Date.now();
let userId = 0;
const ACCOUNT_EMAIL = `test-atr-identity-${stamp}@frumtoronto.test`;

const submit = (body: unknown) =>
  POST(
    new Request("http://localhost/api/ask-the-rabbi/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as never
  );

beforeAll(async () => {
  userId = (
    await createTestUser({
      email: ACCOUNT_EMAIL,
      firstName: "Real",
      lastName: "Submitter",
      emailVerified: new Date(),
    })
  ).id;
});

afterAll(async () => {
  await db.delete(askTheRabbiSubmissions).where(eq(askTheRabbiSubmissions.userId, userId));
  await cleanupTestUsers();
});

describe("submitted identity", () => {
  it("ignores a name and email supplied in the body", async () => {
    notifySpy.mockClear();

    const res = await submit({
      name: "Rabbi Bratefeld",
      email: "attacker@evil.example",
      question: "This is a genuine halachic question, long enough to pass.",
    });

    expect(res.status).toBe(201);

    const [row] = await db
      .select()
      .from(askTheRabbiSubmissions)
      .where(eq(askTheRabbiSubmissions.userId, userId));

    expect(row.name).toBe("Real Submitter");
    expect(row.email).toBe(ACCOUNT_EMAIL);
  });

  it("addresses the admin's reply to the account, not the body", async () => {
    // This is the half that actually costs something: replyTo is where the
    // rabbi's answer goes when he hits reply.
    const call = notifySpy.mock.calls.at(-1)?.[0] as { replyTo?: string; title?: string };
    expect(call.replyTo).toBe(ACCOUNT_EMAIL);
    expect(call.title).toContain("Real Submitter");
    expect(call.title).not.toContain("Bratefeld");
  });

  it("still accepts a submission with no name or email in the body at all", async () => {
    const res = await submit({
      question: "A second question, also comfortably over the length minimum.",
    });
    expect(res.status).toBe(201);
  });

  it("still rejects a question that is too short", async () => {
    const res = await submit({ question: "short" });
    expect(res.status).toBe(400);
  });
});
