import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { createTestUser, cleanupTestUsers } from "./utils/test-db";
import { recordOAuthEmailVerification } from "@/lib/auth/oauth-email-verification";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/**
 * Every Google signup landed in the database as UNVERIFIED, which since the
 * verification gate went in means they cannot submit anything.
 *
 * The Google provider's profile() in auth.ts does return
 * `emailVerified: new Date()`, but Auth.js core throws it away — see
 * @auth/core/lib/actions/callback/handle-login.js:
 *
 *   user = await createUser({ ...profile, emailVerified: null });
 *
 * The spread puts our value in and the explicit null immediately overwrites
 * it. So the fix cannot live in profile(); the row has to be stamped AFTER
 * the adapter has written it, which is what this helper does from
 * events.linkAccount.
 *
 * Five real accounts were stuck this way (ids 12, 14, 23, 3215, 3219).
 */

const EMAIL = "test-oauth-verify@frumtoronto.test";

async function freshUser(emailVerified: Date | null) {
  await cleanupTestUsers();
  return createTestUser({ email: EMAIL, passwordHash: null, emailVerified });
}

async function storedVerification(id: number) {
  const [row] = await db
    .select({ emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return row?.emailVerified ?? null;
}

beforeEach(async () => {
  await cleanupTestUsers();
});

afterAll(async () => {
  await cleanupTestUsers();
});

describe("recordOAuthEmailVerification", () => {
  it("stamps an unverified user when the provider vouched for the address", async () => {
    const user = await freshUser(null);
    const verifiedAt = new Date("2026-08-06T12:00:00.000Z");

    const stamped = await recordOAuthEmailVerification({
      userId: user.id,
      provider: "google",
      verifiedAt,
    });

    expect(stamped).toBe(true);
    expect(await storedVerification(user.id)).toEqual(verifiedAt);
  });

  it("accepts the string id the adapter hands back", async () => {
    const user = await freshUser(null);

    const stamped = await recordOAuthEmailVerification({
      userId: String(user.id),
      provider: "google",
      verifiedAt: new Date("2026-08-06T12:00:00.000Z"),
    });

    expect(stamped).toBe(true);
    expect(await storedVerification(user.id)).not.toBeNull();
  });

  it("does NOT overwrite a date the account already had", async () => {
    // The legacy import stamped ~3,132 accounts with their original signup
    // date. Some of those people later signed in with Google. Overwriting
    // would rewrite history to say we only learned the address today.
    const original = new Date("2015-04-08T02:05:10.000Z");
    const user = await freshUser(original);

    const stamped = await recordOAuthEmailVerification({
      userId: user.id,
      provider: "google",
      verifiedAt: new Date("2026-08-06T12:00:00.000Z"),
    });

    expect(stamped).toBe(false);
    expect(await storedVerification(user.id)).toEqual(original);
  });

  it("does nothing when the provider did NOT vouch for the address", async () => {
    // Google can return email_verified: false. Marking those verified would
    // let an unproven address through the submission gate.
    const user = await freshUser(null);

    const stamped = await recordOAuthEmailVerification({
      userId: user.id,
      provider: "google",
      verifiedAt: null,
    });

    expect(stamped).toBe(false);
    expect(await storedVerification(user.id)).toBeNull();
  });

  it("does nothing for the credentials provider", async () => {
    // Password signups must still click the link we email them; that is the
    // only proof we have that they own the mailbox.
    const user = await freshUser(null);

    const stamped = await recordOAuthEmailVerification({
      userId: user.id,
      provider: "credentials",
      verifiedAt: new Date(),
    });

    expect(stamped).toBe(false);
    expect(await storedVerification(user.id)).toBeNull();
  });

  it("never throws — a failure here must not break sign-in", async () => {
    // This runs inside events.linkAccount, mid sign-in. A throw would turn a
    // cosmetic database update into a login outage.
    await expect(
      recordOAuthEmailVerification({
        userId: "not-a-number",
        provider: "google",
        verifiedAt: new Date(),
      })
    ).resolves.toBe(false);

    await expect(
      recordOAuthEmailVerification({
        userId: 2_000_000_000,
        provider: "google",
        verifiedAt: new Date(),
      })
    ).resolves.toBe(false);
  });
});
