import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb, createTestUser, cleanupTestUsers } from './utils/test-db';
import * as schema from '@/lib/db/schema';

describe('Admin User Permissions', () => {
  let adminUserId: number;
  let memberUserId: number;

  beforeAll(async () => {
    // Clean up any existing test users
    await cleanupTestUsers();

    // Create test admin
    const admin = await createTestUser({
      email: 'test-admin-perm@frumtoronto.test',
      firstName: 'Admin',
      lastName: 'Test',
      role: 'admin',
    });
    adminUserId = admin.id;

    // Create test member
    const member = await createTestUser({
      email: 'test-member-perm@frumtoronto.test',
      firstName: 'Member',
      lastName: 'Test',
      role: 'member',
    });
    memberUserId = member.id;
  });

  afterAll(async () => {
    await cleanupTestUsers();
  });

  it('should create admin user with admin role', async () => {
    const [user] = await testDb
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, adminUserId))
      .limit(1);

    expect(user).toBeDefined();
    expect(user.role).toBe('admin');
    expect(user.email).toBe('test-admin-perm@frumtoronto.test');
  });

  it('should create member user with member role', async () => {
    const [user] = await testDb
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, memberUserId))
      .limit(1);

    expect(user).toBeDefined();
    expect(user.role).toBe('member');
  });

  it('should allow admin to grant canAutoApproveKosherAlerts permission', async () => {
    // Update member to have kosher alerts permission
    const [updated] = await testDb
      .update(schema.users)
      .set({ canAutoApproveKosherAlerts: true })
      .where(eq(schema.users.id, memberUserId))
      .returning();

    expect(updated.canAutoApproveKosherAlerts).toBe(true);
  });

  it('should allow admin to grant canAutoApproveShiva permission', async () => {
    const [updated] = await testDb
      .update(schema.users)
      .set({ canAutoApproveShiva: true })
      .where(eq(schema.users.id, memberUserId))
      .returning();

    expect(updated.canAutoApproveShiva).toBe(true);
  });

  it('should allow admin to grant multiple permissions at once', async () => {
    const [updated] = await testDb
      .update(schema.users)
      .set({
        canAutoApproveTehillim: true,
        canAutoApproveSimchas: true,
        canAutoApproveEvents: true,
      })
      .where(eq(schema.users.id, memberUserId))
      .returning();

    expect(updated.canAutoApproveTehillim).toBe(true);
    expect(updated.canAutoApproveSimchas).toBe(true);
    expect(updated.canAutoApproveEvents).toBe(true);
  });

  it('should allow admin to revoke permissions', async () => {
    const [updated] = await testDb
      .update(schema.users)
      .set({
        canAutoApproveKosherAlerts: false,
        canAutoApproveShiva: false,
      })
      .where(eq(schema.users.id, memberUserId))
      .returning();

    expect(updated.canAutoApproveKosherAlerts).toBe(false);
    expect(updated.canAutoApproveShiva).toBe(false);
  });

  it('member should have all permissions false by default', async () => {
    const newMember = await createTestUser({
      email: 'test-new-member@frumtoronto.test',
      firstName: 'New',
      lastName: 'Member',
      role: 'member',
    });

    expect(newMember.canAutoApproveKosherAlerts).toBe(false);
    expect(newMember.canAutoApproveShiva).toBe(false);
    expect(newMember.canAutoApproveTehillim).toBe(false);
    expect(newMember.canAutoApproveSimchas).toBe(false);
    expect(newMember.canAutoApproveEvents).toBe(false);
    expect(newMember.canAutoApproveClassifieds).toBe(false);
  });
});
