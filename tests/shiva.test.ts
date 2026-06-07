import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq, and, gte, sql } from 'drizzle-orm';
import { testDb, createTestUser, cleanupTestUsers, cleanupTestShiva } from './utils/test-db';
import * as schema from '@/lib/db/schema';

// Returns a yyyy-mm-dd string `days` from today (negative = past).
function dateStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const TODAY = dateStr(0);

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
    const [notice] = await testDb
      .insert(schema.shivaNotifications)
      .values({
        userId: adminUserId,
        niftarName: '[TEST] Admin Created Notice',
        mournerNames: ['Test Mourner 1', 'Test Mourner 2'],
        shivaAddress: '123 Test St, Toronto',
        shivaStart: TODAY,
        shivaEnd: dateStr(7),
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
        niftarName: '[TEST] Member Submitted Notice',
        mournerNames: ['Test Mourner'],
        shivaAddress: '456 Test Ave, Toronto',
        shivaStart: TODAY,
        shivaEnd: dateStr(5),
        approvalStatus: 'pending',
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
        niftarName: '[TEST] Trusted User Notice',
        mournerNames: ['Trusted Mourner'],
        shivaAddress: '789 Trust Blvd, Toronto',
        shivaStart: TODAY,
        shivaEnd: dateStr(6),
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
        mournerNames: ['Pending Mourner'],
        shivaAddress: '111 Pending St, Toronto',
        shivaStart: TODAY,
        shivaEnd: dateStr(7),
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
        mournerNames: ['Test Mourner'],
        shivaAddress: '222 Reject Ave, Toronto',
        shivaStart: TODAY,
        shivaEnd: dateStr(7),
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

  it('only approved, non-expired shiva notices are publicly visible', async () => {
    // Mirrors the real public query in /api/community/shiva:
    //   approvalStatus = 'approved' AND shivaEnd >= today
    await testDb.insert(schema.shivaNotifications).values([
      {
        userId: adminUserId,
        niftarName: '[TEST] Approved Active',
        mournerNames: ['Visible Mourner'],
        shivaAddress: '100 Visible St, Toronto',
        shivaStart: TODAY,
        shivaEnd: dateStr(7),
        approvalStatus: 'approved',
      },
      {
        userId: memberUserId,
        niftarName: '[TEST] Pending Notice',
        mournerNames: ['Hidden Mourner'],
        shivaAddress: '200 Hidden St, Toronto',
        shivaStart: TODAY,
        shivaEnd: dateStr(7),
        approvalStatus: 'pending',
      },
      {
        userId: adminUserId,
        niftarName: '[TEST] Approved Expired',
        mournerNames: ['Expired Mourner'],
        shivaAddress: '300 Expired St, Toronto',
        shivaStart: dateStr(-10),
        shivaEnd: dateStr(-3), // ended in the past — should be hidden
        approvalStatus: 'approved',
      },
    ]);

    const publicNotices = await testDb
      .select()
      .from(schema.shivaNotifications)
      .where(
        and(
          eq(schema.shivaNotifications.approvalStatus, 'approved'),
          gte(schema.shivaNotifications.shivaEnd, TODAY),
          sql`${schema.shivaNotifications.niftarName} LIKE '[TEST]%'`
        )
      );

    expect(publicNotices.length).toBe(1);
    expect(publicNotices[0].niftarName).toBe('[TEST] Approved Active');
  });

  it('shiva notice stores mourner names as array', async () => {
    const mournerNames = ['Mourner One', 'Mourner Two', 'Mourner Three'];

    const [notice] = await testDb
      .insert(schema.shivaNotifications)
      .values({
        userId: adminUserId,
        niftarName: '[TEST] Multiple Mourners',
        mournerNames,
        shivaAddress: '400 Family St, Toronto',
        shivaStart: TODAY,
        shivaEnd: dateStr(7),
        approvalStatus: 'approved',
      })
      .returning();

    expect(notice.mournerNames).toEqual(mournerNames);
    expect((notice.mournerNames as string[]).length).toBe(3);
  });
});
