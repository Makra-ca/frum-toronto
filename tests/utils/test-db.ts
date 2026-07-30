import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { like, sql } from 'drizzle-orm';
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
    })
    .returning();
  return user;
}

// Helper to clean up test data
export async function cleanupTestUsers() {
  await testDb
    .delete(schema.users)
    .where(like(schema.users.email, 'test-%@frumtoronto.test'));
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
