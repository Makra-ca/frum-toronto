import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { inArray, like, sql } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';

// Create a test database connection
const neonSql = neon(process.env.DATABASE_URL!);
export const testDb = drizzle(neonSql, { schema });

// Test user data
export const TEST_ADMIN_USER = {
  email: 'test-admin@frumtoronto.test',
  firstName: 'Test',
  lastName: 'Admin',
  role: 'admin' as const,
  passwordHash: '$2a$12$test', // Not a real hash, just for testing
};

export const TEST_MEMBER_USER = {
  email: 'test-member@frumtoronto.test',
  firstName: 'Test',
  lastName: 'Member',
  role: 'member' as const,
  passwordHash: '$2a$12$test',
};

export const TEST_TRUSTED_USER = {
  email: 'test-trusted@frumtoronto.test',
  firstName: 'Test',
  lastName: 'Trusted',
  role: 'member' as const,
  passwordHash: '$2a$12$test',
  canAutoApproveKosherAlerts: true,
  canAutoApproveShiva: true,
};

// Helper to create test user
export async function createTestUser(userData: Partial<typeof schema.users.$inferInsert>) {
  const [user] = await testDb
    .insert(schema.users)
    .values({
      email: userData.email!,
      firstName: userData.firstName || 'Test',
      lastName: userData.lastName || 'User',
      role: userData.role || 'member',
      // `=== undefined` rather than `||` so a test can ask for an account with
      // NO password (the legacy-import case) instead of silently getting the
      // default hash.
      passwordHash:
        userData.passwordHash === undefined ? '$2a$12$test' : userData.passwordHash,
      // `?? true` so a test can create a blocked account (is_active = false is
      // this project's ban flag) rather than always getting an active one.
      isActive: userData.isActive ?? true,
      // Passed through so tests can build a verified account; submissions are
      // gated on this, so without it every test user looks unverified.
      emailVerified: userData.emailVerified ?? null,
      isTrusted: userData.isTrusted ?? false,
      // ALL TWELVE canAutoApprove* columns are passed through. Five used to be
      // missing, so a test asking for one got a user without it and then passed
      // for the wrong reason — the auto-approve branch was never exercised.
      canAutoApproveShiva: userData.canAutoApproveShiva ?? false,
      canAutoApproveTehillim: userData.canAutoApproveTehillim ?? false,
      canAutoApproveBusinesses: userData.canAutoApproveBusinesses ?? false,
      canAutoApproveAskTheRabbi: userData.canAutoApproveAskTheRabbi ?? false,
      canAutoApproveKosherAlerts: userData.canAutoApproveKosherAlerts ?? false,
      canAutoApproveShuls: userData.canAutoApproveShuls ?? false,
      canAutoApproveSimchas: userData.canAutoApproveSimchas ?? false,
      canAutoApproveEvents: userData.canAutoApproveEvents ?? false,
      canAutoApproveClassifieds: userData.canAutoApproveClassifieds ?? false,
      canAutoApproveShiurim: userData.canAutoApproveShiurim ?? false,
      canAutoApproveAlerts: userData.canAutoApproveAlerts ?? false,
      canAutoApproveBlog: userData.canAutoApproveBlog ?? false,
      // canManageAskTheRabbi is a different kind of permission from the twelve
      // above: those let you skip review on your OWN submissions, this one lets
      // you review OTHER people's. It was missing here for the same reason the
      // five above once were.
      canManageAskTheRabbi: userData.canManageAskTheRabbi ?? false,
    })
    .returning();
  return user;
}

/**
 * Deletes every test user — and, first, the content rows that point at them.
 *
 * The content tables reference users.id with NO `ON DELETE`, so a single
 * leftover row makes this throw a foreign-key error. That matters because this
 * helper is blanket (`test-%@frumtoronto.test`, not the calling file's own
 * ids) and nearly every integration file calls it: one file whose afterAll
 * was cut short — a thrown test, or the Neon branch dropping a connection —
 * leaves a mine that detonates in whichever file runs next, taking a whole
 * file's tests with it.
 *
 * Observed exactly that: community-alerts.test.ts failed in beforeAll with
 * `alerts_user_id_users_id_fk`, skipping 9 tests and preventing 60 more from
 * running, because an earlier file had left a user behind.
 *
 * Vitest orders integration files by SIZE, so which file gets hit changes as
 * files grow. Clearing children here makes the helper safe to call in any
 * order.
 *
 * It is safe to be blanket ONLY because the integration project runs with
 * `fileParallelism: false` (vitest.config.mts). Turn that on and this would
 * delete a concurrently-running file's users mid-test.
 */
export async function cleanupTestUsers() {
  const testUsers = await testDb
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(like(schema.users.email, 'test-%@frumtoronto.test'));

  if (testUsers.length === 0) return;

  const ids = testUsers.map((u) => u.id);

  // Every table with a user reference that an integration test can create.
  // Deleting by user id (not by a "[TEST]" title convention) catches rows a
  // half-finished afterAll left behind whatever they were called.
  await testDb.delete(schema.events).where(inArray(schema.events.userId, ids));
  await testDb.delete(schema.simchas).where(inArray(schema.simchas.userId, ids));
  await testDb.delete(schema.classifieds).where(inArray(schema.classifieds.userId, ids));
  await testDb.delete(schema.kosherAlerts).where(inArray(schema.kosherAlerts.userId, ids));
  await testDb.delete(schema.alerts).where(inArray(schema.alerts.userId, ids));
  await testDb.delete(schema.tehillimList).where(inArray(schema.tehillimList.userId, ids));
  await testDb
    .delete(schema.shivaNotifications)
    .where(inArray(schema.shivaNotifications.userId, ids));
  await testDb.delete(schema.blogPosts).where(inArray(schema.blogPosts.authorId, ids));
  await testDb.delete(schema.notifications).where(inArray(schema.notifications.userId, ids));
  await testDb.delete(schema.userShuls).where(inArray(schema.userShuls.userId, ids));
  // Also referenced with no ON DELETE, and integration tests create these.
  await testDb.delete(schema.businesses).where(inArray(schema.businesses.userId, ids));


  await testDb.delete(schema.users).where(inArray(schema.users.id, ids));
}

export async function cleanupTestKosherAlerts() {
  await testDb
    .delete(schema.kosherAlerts)
    .where(like(schema.kosherAlerts.productName, '[TEST]%'));
}

export async function cleanupTestAlerts() {
  await testDb
    .delete(schema.alerts)
    .where(like(schema.alerts.title, '[TEST]%'));
}

export async function cleanupTestShiva() {
  await testDb
    .delete(schema.shivaNotifications)
    .where(sql`${schema.shivaNotifications.niftarName} LIKE '[TEST]%'`);
}

// Clean up all test data
export async function cleanupAllTestData() {
  console.log('🧹 Cleaning up test data...');
  // Clean up in order: dependent tables first, then users last
  await cleanupTestKosherAlerts();
  await cleanupTestAlerts();
  await cleanupTestShiva();
  await cleanupTestUsers();
  console.log('✅ Test data cleaned up');
}
