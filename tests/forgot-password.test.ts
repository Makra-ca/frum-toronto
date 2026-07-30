import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb, createTestUser, cleanupTestUsers } from './utils/test-db';
import * as schema from '@/lib/db/schema';
import {
  buildUserStatusCondition,
  parseUserStatus,
} from '@/lib/admin/user-search';

/**
 * Covers the two silent dead ends the legacy import exposed in the
 * forgot-password flow, and the ban semantics of is_active.
 *
 * These are DB-level assertions about the conditions the route relies on. The
 * route itself is exercised by hand; what matters to lock down here is that
 * "blocked" and "no password, no OAuth link" are distinguishable in data, since
 * that is what the fix branches on.
 */
describe('Account state affecting password reset and login', () => {
  let blockedId: number;
  let legacyNoPasswordId: number;
  let oauthOnlyId: number;
  let normalId: number;

  beforeAll(async () => {
    await cleanupTestUsers();

    const blocked = await createTestUser({
      email: 'test-blocked-fp@frumtoronto.test',
      role: 'member',
      passwordHash: 'bcrypt-placeholder',
      isActive: false,
    });
    blockedId = blocked.id;

    // The legacy case: imported member who never had a password on the old site.
    const legacy = await createTestUser({
      email: 'test-legacy-nopw-fp@frumtoronto.test',
      role: 'member',
      passwordHash: null,
      isActive: true,
    });
    legacyNoPasswordId = legacy.id;

    // OAuth-only: also has no password, but must NOT be resettable.
    const oauth = await createTestUser({
      email: 'test-oauth-only-fp@frumtoronto.test',
      role: 'member',
      passwordHash: null,
      isActive: true,
    });
    oauthOnlyId = oauth.id;
    await testDb.insert(schema.accounts).values({
      userId: oauthOnlyId,
      type: 'oauth',
      provider: 'google',
      providerAccountId: 'test-google-id-fp',
    });

    const normal = await createTestUser({
      email: 'test-normal-fp@frumtoronto.test',
      role: 'member',
      passwordHash: 'bcrypt-placeholder',
      isActive: true,
    });
    normalId = normal.id;
  });

  afterAll(async () => {
    await testDb
      .delete(schema.accounts)
      .where(eq(schema.accounts.providerAccountId, 'test-google-id-fp'));
    await cleanupTestUsers();
  });

  it('distinguishes a legacy password-less account from an OAuth-only one', async () => {
    // This is exactly what the forgot-password fix branches on: both have no
    // password, but only the OAuth-linked one must be refused.
    const [legacyRow] = await testDb
      .select({ passwordHash: schema.users.passwordHash })
      .from(schema.users)
      .where(eq(schema.users.id, legacyNoPasswordId));
    expect(legacyRow.passwordHash).toBeNull();

    const legacyLinks = await testDb
      .select({ id: schema.accounts.id })
      .from(schema.accounts)
      .where(eq(schema.accounts.userId, legacyNoPasswordId));
    expect(legacyLinks).toHaveLength(0);

    const oauthLinks = await testDb
      .select({ id: schema.accounts.id })
      .from(schema.accounts)
      .where(eq(schema.accounts.userId, oauthOnlyId));
    expect(oauthLinks).toHaveLength(1);
  });

  it('treats is_active = false as blocked, which is what stops login', async () => {
    const [row] = await testDb
      .select({ isActive: schema.users.isActive })
      .from(schema.users)
      .where(eq(schema.users.id, blockedId));
    // authorize() rejects on a falsy isActive, so false must round-trip as false
    // rather than becoming NULL or defaulting to true.
    expect(row.isActive).toBe(false);
  });

  it('the blocked-status filter finds the blocked account and not the others', async () => {
    const condition = buildUserStatusCondition(parseUserStatus('blocked'));
    const rows = await testDb
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(condition);
    const ids = rows.map((r) => r.id);

    // Scoped to this file's own fixtures rather than every @frumtoronto.test
    // row: cleanupTestUsers() deletes ALL test-%@frumtoronto.test users and every
    // test file calls it, so asserting over that whole set is order-dependent and
    // flaky.
    expect(ids).toContain(blockedId);
    expect(ids).not.toContain(normalId);
    expect(ids).not.toContain(legacyNoPasswordId);
    expect(ids).not.toContain(oauthOnlyId);
  });

  it('the active-status filter excludes the blocked account but keeps the rest', async () => {
    const condition = buildUserStatusCondition(parseUserStatus('active'));
    const rows = await testDb
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(condition);

    const ids = rows.map((r) => r.id);
    expect(ids).not.toContain(blockedId);
    expect(ids).toContain(normalId);
    expect(ids).toContain(legacyNoPasswordId);
  });

  it('counts a NULL is_active as active, since login and the UI both do', async () => {
    const nullUser = await createTestUser({
      email: 'test-nullactive-fp@frumtoronto.test',
      role: 'member',
      passwordHash: 'bcrypt-placeholder',
    });
    await testDb
      .update(schema.users)
      .set({ isActive: null })
      .where(eq(schema.users.id, nullUser.id));

    const activeRows = await testDb
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(buildUserStatusCondition(parseUserStatus('active')));
    expect(activeRows.map((r) => r.id)).toContain(nullUser.id);

    const blockedRows = await testDb
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(buildUserStatusCondition(parseUserStatus('blocked')));
    expect(blockedRows.map((r) => r.id)).not.toContain(nullUser.id);
  });

  it('applies no filter for "all"', () => {
    expect(buildUserStatusCondition(parseUserStatus('all'))).toBeUndefined();
    expect(buildUserStatusCondition(parseUserStatus('nonsense'))).toBeUndefined();
    expect(buildUserStatusCondition(parseUserStatus(undefined))).toBeUndefined();
  });
});
