import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testDb, createTestUser, cleanupTestUsers } from './utils/test-db';
import { assertCanPost, EMAIL_UNVERIFIED_CODE } from '@/lib/auth/require-verified';

/**
 * Submissions are gated on a verified email address. This covers assertCanPost,
 * which all 22 submission endpoints call.
 */
describe('assertCanPost — submission gate', () => {
  let verifiedId: number;
  let unverifiedId: number;
  let unverifiedAdminId: number;
  let blockedId: number;

  beforeAll(async () => {
    await cleanupTestUsers();

    const verified = await createTestUser({
      email: 'test-gate-verified@frumtoronto.test',
      role: 'member',
      emailVerified: new Date(),
    });
    verifiedId = verified.id;

    const unverified = await createTestUser({
      email: 'test-gate-unverified@frumtoronto.test',
      role: 'member',
    });
    unverifiedId = unverified.id;

    // An admin must not be blocked by their own verification state.
    const admin = await createTestUser({
      email: 'test-gate-admin@frumtoronto.test',
      role: 'admin',
    });
    unverifiedAdminId = admin.id;

    // Verified but blocked: a session can outlive a block, so posting must stop.
    const blocked = await createTestUser({
      email: 'test-gate-blocked@frumtoronto.test',
      role: 'member',
      emailVerified: new Date(),
      isActive: false,
    });
    blockedId = blocked.id;
  });

  afterAll(async () => {
    await cleanupTestUsers();
  });

  it('allows a verified, active member', async () => {
    expect(await assertCanPost(verifiedId)).toBeNull();
  });

  it('blocks an unverified member with a 403 and a machine-readable code', async () => {
    const res = await assertCanPost(unverifiedId);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);

    const body = await res!.json();
    // The code is what lets the UI offer "resend verification" instead of a
    // generic failure.
    expect(body.code).toBe(EMAIL_UNVERIFIED_CODE);
    expect(body.error).toMatch(/verify your email/i);
  });

  it('exempts admins from the verification requirement', async () => {
    expect(await assertCanPost(unverifiedAdminId)).toBeNull();
  });

  it('blocks a disabled account even when verified', async () => {
    const res = await assertCanPost(blockedId);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.error).toMatch(/disabled/i);
    // Distinct from the unverified case, so the UI does not offer a pointless
    // "resend verification" button to someone who is blocked.
    expect(body.code).toBeUndefined();
  });

  it('rejects a missing or non-numeric user id as unauthorized', async () => {
    for (const bad of [undefined, '', 'abc', 'NaN']) {
      const res = await assertCanPost(bad);
      expect(res, String(bad)).not.toBeNull();
      expect(res!.status, String(bad)).toBe(401);
    }
  });

  it('rejects a user id that does not exist', async () => {
    const res = await assertCanPost(2_000_000_000);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it('accepts the id as a string, which is how the session carries it', async () => {
    // session.user.id is a string, so this is the real call shape.
    expect(await assertCanPost(String(verifiedId))).toBeNull();
  });

  it('starts allowing a member as soon as they verify, with no session refresh', async () => {
    const late = await createTestUser({
      email: 'test-gate-late@frumtoronto.test',
      role: 'member',
    });
    expect(await assertCanPost(late.id)).not.toBeNull();

    const { users } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');
    await testDb
      .update(users)
      .set({ emailVerified: new Date() })
      .where(eq(users.id, late.id));

    // Reads the database rather than the JWT precisely so this works instantly.
    expect(await assertCanPost(late.id)).toBeNull();
  });
});
