import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq, and, gte, sql } from 'drizzle-orm';
import { testDb, createTestUser, cleanupTestUsers, cleanupTestShiva } from './utils/test-db';
import * as schema from '@/lib/db/schema';

describe('Shiva Submissions', () => {
  let adminUserId: number;
  let memberUserId: number;
  let trustedUserId: number;

  // Helper to get future dates
  const getFutureDate = (daysFromNow: number) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split('T')[0];
  };

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
    const [notice] = await testDb
      .insert(schema.shivaNotifications)
      .values({
        userId: adminUserId,
        niftarName: '[TEST] Admin Created Niftar',
        shivaAddress: '123 Test Street, Toronto',
        shivaStart: getFutureDate(0),
        shivaEnd: getFutureDate(7),
        approvalStatus: 'approved',
      })
      .returning();

    expect(notice).toBeDefined();
    expect(notice.approvalStatus).toBe('approved');
    expect(notice.userId).toBe(adminUserId);
  });

  it('regular member submission goes to pending', async () => {
    const [notice] = await testDb
      .insert(schema.shivaNotifications)
      .values({
        userId: memberUserId,
        niftarName: '[TEST] Member Submitted Niftar',
        shivaAddress: '456 Test Ave, Toronto',
        shivaStart: getFutureDate(0),
        shivaEnd: getFutureDate(7),
        approvalStatus: 'pending', // Regular members go to pending
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

    const [notice] = await testDb
      .insert(schema.shivaNotifications)
      .values({
        userId: trustedUserId,
        niftarName: '[TEST] Trusted User Niftar',
        shivaAddress: '789 Test Blvd, Toronto',
        shivaStart: getFutureDate(0),
        shivaEnd: getFutureDate(7),
        approvalStatus,
      })
      .returning();

    expect(notice).toBeDefined();
    expect(notice.approvalStatus).toBe('approved');
  });

  it('admin can approve pending shiva notice', async () => {
    // Create pending notice
    const [pendingNotice] = await testDb
      .insert(schema.shivaNotifications)
      .values({
        userId: memberUserId,
        niftarName: '[TEST] Pending Notice to Approve',
        shivaStart: getFutureDate(0),
        shivaEnd: getFutureDate(7),
        approvalStatus: 'pending',
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
    const [pendingNotice] = await testDb
      .insert(schema.shivaNotifications)
      .values({
        userId: memberUserId,
        niftarName: '[TEST] Notice to Reject',
        shivaStart: getFutureDate(0),
        shivaEnd: getFutureDate(7),
        approvalStatus: 'pending',
      })
      .returning();

    const [rejected] = await testDb
      .update(schema.shivaNotifications)
      .set({ approvalStatus: 'rejected' })
      .where(eq(schema.shivaNotifications.id, pendingNotice.id))
      .returning();

    expect(rejected.approvalStatus).toBe('rejected');
  });

  it('only approved shiva notices with current/future dates are visible', async () => {
    const today = new Date().toISOString().split('T')[0];

    // Create multiple notices with different statuses
    await testDb.insert(schema.shivaNotifications).values([
      {
        userId: adminUserId,
        niftarName: '[TEST] Approved Current Shiva',
        shivaStart: getFutureDate(0),
        shivaEnd: getFutureDate(7),
        approvalStatus: 'approved',
      },
      {
        userId: memberUserId,
        niftarName: '[TEST] Pending Shiva',
        shivaStart: getFutureDate(0),
        shivaEnd: getFutureDate(7),
        approvalStatus: 'pending',
      },
      {
        userId: adminUserId,
        niftarName: '[TEST] Rejected Shiva',
        shivaStart: getFutureDate(0),
        shivaEnd: getFutureDate(7),
        approvalStatus: 'rejected',
      },
    ]);

    // Query public notices (approved AND end date >= today)
    const publicNotices = await testDb
      .select()
      .from(schema.shivaNotifications)
      .where(
        and(
          eq(schema.shivaNotifications.approvalStatus, 'approved'),
          gte(schema.shivaNotifications.shivaEnd, today),
          sql`${schema.shivaNotifications.niftarName} LIKE '[TEST]%'`
        )
      );

    expect(publicNotices.length).toBe(1);
    expect(publicNotices[0].niftarName).toBe('[TEST] Approved Current Shiva');
  });

  it('shiva notice can have all optional fields', async () => {
    const [notice] = await testDb
      .insert(schema.shivaNotifications)
      .values({
        userId: adminUserId,
        niftarName: '[TEST] Full Details Niftar',
        niftarNameHebrew: 'שם בעברית',
        mournerNames: ['Mourner One', 'Mourner Two'],
        shivaAddress: '100 Full Details Ave, Toronto',
        shivaStart: getFutureDate(0),
        shivaEnd: getFutureDate(7),
        shivaHours: '9 AM - 9 PM',
        mealInfo: 'Meals are being coordinated through community',
        donationInfo: 'Donations to Chai Lifeline in memory',
        contactPhone: '416-555-1234',
        approvalStatus: 'approved',
      })
      .returning();

    expect(notice.niftarNameHebrew).toBe('שם בעברית');
    expect(notice.mournerNames).toEqual(['Mourner One', 'Mourner Two']);
    expect(notice.shivaHours).toBe('9 AM - 9 PM');
    expect(notice.mealInfo).toBe('Meals are being coordinated through community');
    expect(notice.donationInfo).toBe('Donations to Chai Lifeline in memory');
    expect(notice.contactPhone).toBe('416-555-1234');
  });

  it('shiva notices are correctly filtered by date range', async () => {
    // Create notices with different date ranges
    await testDb.insert(schema.shivaNotifications).values([
      {
        userId: adminUserId,
        niftarName: '[TEST] Active Shiva 1',
        shivaStart: getFutureDate(-3), // Started 3 days ago
        shivaEnd: getFutureDate(4), // Ends in 4 days
        approvalStatus: 'approved',
      },
      {
        userId: adminUserId,
        niftarName: '[TEST] Active Shiva 2',
        shivaStart: getFutureDate(0), // Starting today
        shivaEnd: getFutureDate(7),
        approvalStatus: 'approved',
      },
    ]);

    const today = new Date().toISOString().split('T')[0];

    // Both should be visible since shivaEnd >= today
    const activeNotices = await testDb
      .select()
      .from(schema.shivaNotifications)
      .where(
        and(
          eq(schema.shivaNotifications.approvalStatus, 'approved'),
          gte(schema.shivaNotifications.shivaEnd, today),
          sql`${schema.shivaNotifications.niftarName} LIKE '[TEST]%'`
        )
      );

    expect(activeNotices.length).toBe(2);
  });
});
