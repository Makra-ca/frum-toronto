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
      passwordHash: userData.passwordHash || '$2a$12$test',
      isActive: true,
      isTrusted: userData.isTrusted ?? false,
      canAutoApproveKosherAlerts: userData.canAutoApproveKosherAlerts ?? false,
      canAutoApproveShiva: userData.canAutoApproveShiva ?? false,
      canAutoApproveTehillim: userData.canAutoApproveTehillim ?? false,
      canAutoApproveBusinesses: userData.canAutoApproveBusinesses ?? false,
      canAutoApproveSimchas: userData.canAutoApproveSimchas ?? false,
      canAutoApproveEvents: userData.canAutoApproveEvents ?? false,
      canAutoApproveClassifieds: userData.canAutoApproveClassifieds ?? false,
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
