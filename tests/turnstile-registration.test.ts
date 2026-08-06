import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestUser, cleanupTestUsers } from "./utils/test-db";

/**
 * Registration had no captcha, no honeypot and no rate limit, and was taking
 * 10-15 bot signups a day.
 *
 * The property that matters most here is ORDERING. Verification runs before the
 * schema check and before any database read — otherwise the existing-user
 * lookup turns the endpoint into an address oracle: post an email, and the
 * "account already exists" response tells you whether that person is a member,
 * no token required.
 */

const fetchSpy = vi.hoisted(() => vi.fn());

vi.mock("@/lib/email/send", () => ({
  sendVerificationEmail: vi.fn(async () => true),
}));

const { POST } = await import("@/app/api/auth/register/route");
const { db } = await import("@/lib/db");
const { users } = await import("@/lib/db/schema");

const stamp = Date.now();
const KNOWN_EMAIL = `test-turnstile-known-${stamp}@frumtoronto.test`;
const NEW_EMAIL = `test-turnstile-new-${stamp}@frumtoronto.test`;

// Bound, because the mock below forwards every non-Cloudflare call to it —
// including the neon-http driver's, which is how the database is reached.
const realFetch = globalThis.fetch.bind(globalThis);

function setEnv(nodeEnv: string, secret: string | undefined) {
  // vi.stubEnv, not a direct assignment: NODE_ENV is readonly in the types, and
  // Node rejects Object.defineProperty on process.env unless the descriptor is
  // also enumerable. The route reads process.env at call time, so a stub is
  // enough to exercise the production branch.
  vi.stubEnv("NODE_ENV", nodeEnv as "production" | "development" | "test");
  if (secret === undefined) vi.stubEnv("TURNSTILE_SECRET_KEY", undefined);
  else vi.stubEnv("TURNSTILE_SECRET_KEY", secret);
}

const register = (body: Record<string, unknown>) =>
  POST(
    new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as never
  );

/**
 * Must be a body registerSchema ACCEPTS — all twelve notification booleans
 * included.
 *
 * This matters more than it looks. With an incomplete body the schema rejects
 * with a 400 before the existing-user lookup, so the ordering test below would
 * pass whatever the route did — the two responses would match because neither
 * ever reached the database. A test that cannot fail on the broken code is
 * worse than none.
 */
const validBody = (email: string, extra: Record<string, unknown> = {}) => ({
  email,
  password: "Str0ngPassw0rd1",
  confirmPassword: "Str0ngPassw0rd1",
  firstName: "Test",
  lastName: "Person",
  notifications: {
    newsletter: false,
    simchas: false,
    shiva: false,
    kosherAlerts: false,
    tehillim: false,
    communityEvents: false,
    communityAlerts: false,
    eruvStatus: false,
    askTheRabbiAnswered: false,
    atrCommentReplies: false,
    blogCommentNotifications: false,
    businessDeals: false,
  },
  ...extra,
});

beforeAll(async () => {
  await createTestUser({ email: KNOWN_EMAIL });
});

afterEach(async () => {
  vi.unstubAllEnvs();
  globalThis.fetch = realFetch;
  fetchSpy.mockReset();
  // In afterEach, not inline: a failed assertion would otherwise leave the
  // account behind and every later test would fail with "already exists" —
  // failing for a reason that has nothing to do with what it is testing.
  await db.delete(users).where(eq(users.email, NEW_EMAIL));
});

afterAll(async () => {
  vi.unstubAllEnvs();
  globalThis.fetch = realFetch;
  await db.delete(users).where(eq(users.email, NEW_EMAIL));
  await cleanupTestUsers();
});

describe("with no secret configured", () => {
  it("lets registration through outside production", async () => {
    // Development and the rest of this suite must not be blocked by a key that
    // only matters in production.
    setEnv("test", undefined);

    const res = await register(validBody(NEW_EMAIL));
    expect(res.status).toBe(200);
  });

  it("refuses registration in production", async () => {
    // Fails CLOSED. A silent pass would mean the protection is off with
    // nothing saying so, while the page still shows a widget implying it works.
    setEnv("production", undefined);

    const res = await register(validBody(NEW_EMAIL));
    expect(res.status).toBe(503);

    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, NEW_EMAIL));
    expect(row).toBeUndefined();
  });
});

describe("with a secret configured", () => {
  function mockSiteverify(success: boolean) {
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    fetchSpy.mockImplementation(
      async (url: string | URL | Request, init?: RequestInit) => {
        const href = typeof url === "string" ? url : url.toString();
        if (href.includes("challenges.cloudflare.com")) {
          return new Response(
            JSON.stringify({
              success,
              "error-codes": success ? [] : ["invalid-input-response"],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        // `init` MUST be forwarded. Dropping it turned every neon-http query
        // into a bodyless GET, so the database calls silently failed and three
        // tests failed for a reason that had nothing to do with Turnstile.
        return realFetch(url as never, init);
      }
    );
  }

  it("rejects a request with no token, without touching the database", async () => {
    setEnv("test", "test-secret");
    mockSiteverify(true);

    const res = await register(validBody(NEW_EMAIL));
    expect(res.status).toBe(400);

    // Never reached Cloudflare either — no token, nothing to verify.
    expect(fetchSpy).not.toHaveBeenCalled();

    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, NEW_EMAIL));
    expect(row).toBeUndefined();
  });

  it("rejects a token Cloudflare does not recognise", async () => {
    setEnv("test", "test-secret");
    mockSiteverify(false);

    const res = await register(validBody(NEW_EMAIL, { turnstileToken: "forged" }));
    expect(res.status).toBe(400);
  });

  it("does not reveal whether an address is already registered", async () => {
    // THE ordering test. With verification after the existing-user lookup, a
    // known address would come back "An account with this email already
    // exists" and an unknown one would not — an oracle over 3,200 members,
    // reachable with no token at all.
    setEnv("test", "test-secret");
    mockSiteverify(true);

    // Bodies the schema ACCEPTS, so the only thing that could still tell the
    // two apart is the existing-user lookup. No token, so both are stopped at
    // the Turnstile check first.
    const known = await register(validBody(KNOWN_EMAIL));
    const unknown = await register(validBody(NEW_EMAIL));

    expect(known.status).toBe(400);
    expect(known.status).toBe(unknown.status);

    const knownBody = await known.json();
    expect(knownBody).toEqual(await unknown.json());
    // Specifically NOT the existing-account message, which is what leaked.
    expect(JSON.stringify(knownBody)).not.toMatch(/already exists/i);
  });

  it("accepts a valid token and creates the account", async () => {
    setEnv("test", "test-secret");
    mockSiteverify(true);

    const res = await register(validBody(NEW_EMAIL, { turnstileToken: "good-token" }));
    expect(res.status).toBe(200);

    // The caller's token, and our secret, reached Cloudflare.
    const call = fetchSpy.mock.calls.find((c) =>
      String(c[0]).includes("challenges.cloudflare.com")
    );
    expect(call).toBeDefined();
    const body = (call![1] as RequestInit).body as URLSearchParams;
    expect(body.get("response")).toBe("good-token");
    expect(body.get("secret")).toBe("test-secret");
  });
});
