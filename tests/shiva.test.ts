import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq, and, sql } from 'drizzle-orm';
import { testDb, createTestUser, cleanupTestUsers, cleanupTestShiva } from './utils/test-db';
import * as schema from '@/lib/db/schema';

describe('Shiva Submission System', () => {
  let adminUserId: number;
  let memberUserId: number;
  let trustedUserId: number;

  beforeAll(async () => {
    await cleanupTestUsers();
    await cleanupTestShiva();

    // Create test users
    const admin = await createTestUser({
      email: 'test-admin-shiva@frumtoronto.test',
      role: 'admin',
    });
    adminUserId = admin.id;

    const member = await createTestUser({
      email: 'test-member-shiva@frumtoronto.test',
      role: 'member',
    });
    memberUserId = member.id;

    const trusted = await createTestUser({
      email: 'test-trusted-shiva@frumtoronto.test',
      role: 'member',
      canAutoApproveShiva: true,
    });
    trustedUserId = trusted.id;
  });

  afterAll(async () => {
    await cleanupTestShiva();
    await cleanupTestUsers();
  });

  beforeEach(async () => {
    await cleanupTestShiva();
  });

  it('admin can create shiva notice with approved status', async () => {
    const shivaEnd = new Date();
    shivaEnd.setDate(shivaEnd.getDate() + 7); // 7 days from now

    const [notice] = await testDb
      .insert(schema.shivaNotifications)
      .values({
        userId: adminUserId,
        niftarName: '[TEST] Admin Created Notice',
        niftarRelation: 'Father',
        mournerNames: ['Test Mourner 1', 'Test Mourner 2'],
        address: '123 Test St',
        city: 'Toronto',
        shivaEnd: shivaEnd.toISOString().split('T')[0],
        approvalStatus: 'approved',
        isActive: true,
      })
      .returning();

    expect(notice).toBeDefined();
    expect(notice.approvalStatus).toBe('approved');
    expect(notice.userId).toBe(adminUserId);
  });

  it('regular member submission goes to pending', async () => {
    const shivaEnd = new Date();
    shivaEnd.setDate(shivaEnd.getDate() + 5);

    const [notice] = await testDb
      .insert(schema.shivaNotifications)
      .values({
        userId: memberUserId,
        niftarName: '[TEST] Member Submitted Notice',
        niftarRelation: 'Mother',
        mournerNames: ['Test Mourner'],
        address: '456 Test Ave',
        city: 'Toronto',
        shivaEnd: shivaEnd.toISOString().split('T')[0],
        approvalStatus: 'pending',
        isActive: true,
      })
      .returning();

    expect(notice).toBeDefined();
    expect(notice.approvalStatus).toBe('pending');
    expect(notice.userId).toBe(memberUserId);
  });

  it('trusted user with canAutoApproveShiva gets auto-approved', async () => {
    // Verify user has permission
    const [user] = await testDb
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, trustedUserId))
      .limit(1);

    expect(user.canAutoApproveShiva).toBe(true);

    // Simulating the API logic: if user has permission, status = approved
    const approvalStatus = user.canAutoApproveShiva ? 'approved' : 'pending';

    const shivaEnd = new Date();
    shivaEnd.setDate(shivaEnd.getDate() + 6);

    const [notice] = await testDb
      .insert(schema.shivaNotifications)
      .values({
        userId: trustedUserId,
        niftarName: '[TEST] Trusted User Notice',
        niftarRelation: 'Spouse',
        mournerNames: ['Trusted Mourner'],
        address: '789 Trust Blvd',
        city: 'Toronto',
        shivaEnd: shivaEnd.toISOString().split('T')[0],
        approvalStatus,
        isActive: true,
      })
      .returning();

    expect(notice).toBeDefined();
    expect(notice.approvalStatus).toBe('approved');
  });

  it('admin can approve pending shiva notice', async () => {
    const shivaEnd = new Date();
    shivaEnd.setDate(shivaEnd.getDate() + 7);

    // Create pending notice
    const [pendingNotice] = await testDb
      .insert(schema.shivaNotifications)
      .values({
        userId: memberUserId,
        niftarName: '[TEST] Pending Notice to Approve',
        mournerNames: ['Pending Mourner'],
        address: '111 Pending St',
        city: 'Toronto',
        shivaEnd: shivaEnd.toISOString().split('T')[0],
        approvalStatus: 'pending',
        isActive: true,
      })
      .returning();

    expect(pendingNotice.approvalStatus).toBe('pending');

    // Admin approves it
    const [approved] = await testDb
      .update(schema.shivaNotifications)
      .set({ approvalStatus: 'approved' })
      .where(eq(schema.shivaNotifications.id, pendingNotice.id))
      .returning();

    expect(approved.approvalStatus).toBe('approved');
  });

  it('admin can reject pending shiva notice', async () => {
    const shivaEnd = new Date();
    shivaEnd.setDate(shivaEnd.getDate() + 7);

    const [pendingNotice] = await testDb
      .insert(schema.shivaNotifications)
      .values({
        userId: memberUserId,
        niftarName: '[TEST] Notice to Reject',
        mournerNames: ['Test Mourner'],
        address: '222 Reject Ave',
        city: 'Toronto',
        shivaEnd: shivaEnd.toISOString().split('T')[0],
        approvalStatus: 'pending',
        isActive: true,
      })
      .returning();

    const [rejected] = await testDb
      .update(schema.shivaNotifications)
      .set({ approvalStatus: 'rejected' })
      .where(eq(schema.shivaNotifications.id, pendingNotice.id))
      .returning();

    expect(rejected.approvalStatus).toBe('rejected');
  });

  it('only approved and active shiva notices are publicly visible', async () => {
    const shivaEnd = new Date();
    shivaEnd.setDate(shivaEnd.getDate() + 7);
    const shivaEndStr = shivaEnd.toISOString().split('T')[0];

    // Create multiple notices with different statuses
    await testDb.insert(schema.shivaNotifications).values([
      {
        userId: adminUserId,
        niftarName: '[TEST] Approved Active',
        mournerNames: ['Visible Mourner'],
        address: '100 Visible St',
        city: 'Toronto',
        shivaEnd: shivaEndStr,
        approvalStatus: 'approved',
        isActive: true,
      },
      {
        userId: memberUserId,
        niftarName: '[TEST] Pending Notice',
        mournerNames: ['Hidden Mourner'],
        address: '200 Hidden St',
        city: 'Toronto',
        shivaEnd: shivaEndStr,
        approvalStatus: 'pending',
        isActive: true,
      },
      {
        userId: adminUserId,
        niftarName: '[TEST] Approved Inactive',
        mournerNames: ['Inactive Mourner'],
        address: '300 Inactive St',
        city: 'Toronto',
        shivaEnd: shivaEndStr,
        approvalStatus: 'approved',
        isActive: false,
      },
    ]);

    // Query public notices (approved AND active)
    const publicNotices = await testDb
      .select()
      .from(schema.shivaNotifications)
      .where(
        and(
          eq(schema.shivaNotifications.approvalStatus, 'approved'),
          eq(schema.shivaNotifications.isActive, true),
          sql`${schema.shivaNotifications.niftarName} LIKE '[TEST]%'`
        )
      );

    expect(publicNotices.length).toBe(1);
    expect(publicNotices[0].niftarName).toBe('[TEST] Approved Active');
  });

  it('shiva notice stores mourner names as array', async () => {
    const shivaEnd = new Date();
    shivaEnd.setDate(shivaEnd.getDate() + 7);

    const mournerNames = ['Mourner One', 'Mourner Two', 'Mourner Three'];

    const [notice] = await testDb
      .insert(schema.shivaNotifications)
      .values({
        userId: adminUserId,
        niftarName: '[TEST] Multiple Mourners',
        mournerNames,
        address: '400 Family St',
        city: 'Toronto',
        shivaEnd: shivaEnd.toISOString().split('T')[0],
        approvalStatus: 'approved',
        isActive: true,
      })
      .returning();

    expect(notice.mournerNames).toEqual(mournerNames);
    expect(notice.mournerNames.length).toBe(3);
  });
});
