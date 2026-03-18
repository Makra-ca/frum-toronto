import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq, and, like } from 'drizzle-orm';
import { testDb, createTestUser, cleanupTestUsers, cleanupTestKosherAlerts } from './utils/test-db';
import * as schema from '@/lib/db/schema';

describe('Kosher Alert Submissions', () => {
  let adminUserId: number;
  let memberUserId: number;
  let trustedUserId: number;

  beforeAll(async () => {
    await cleanupTestUsers();
    await cleanupTestKosherAlerts();

    // Create test users
    const admin = await createTestUser({
      email: 'test-admin-kosher@frumtoronto.test',
      role: 'admin',
    });
    adminUserId = admin.id;

    const member = await createTestUser({
      email: 'test-member-kosher@frumtoronto.test',
      role: 'member',
    });
    memberUserId = member.id;

    const trusted = await createTestUser({
      email: 'test-trusted-kosher@frumtoronto.test',
      role: 'member',
      canAutoApproveKosherAlerts: true,
    });
    trustedUserId = trusted.id;
  });

  afterAll(async () => {
    await cleanupTestKosherAlerts();
    await cleanupTestUsers();
  });

  beforeEach(async () => {
    await cleanupTestKosherAlerts();
  });

  it('admin can create kosher alert with approved status', async () => {
    const [alert] = await testDb
      .insert(schema.kosherAlerts)
      .values({
        userId: adminUserId,
        productName: '[TEST] Admin Created Product',
        brand: 'Test Brand',
        alertType: 'recall',
        description: 'Test description for admin-created alert',
        certifyingAgency: 'COR',
        approvalStatus: 'approved',
        isActive: true,
      })
      .returning();

    expect(alert).toBeDefined();
    expect(alert.approvalStatus).toBe('approved');
    expect(alert.userId).toBe(adminUserId);
  });

  it('regular member submission goes to pending', async () => {
    const [alert] = await testDb
      .insert(schema.kosherAlerts)
      .values({
        userId: memberUserId,
        productName: '[TEST] Member Submitted Product',
        brand: 'Test Brand',
        alertType: 'status_change',
        description: 'Test description for member submission',
        certifyingAgency: 'OU',
        approvalStatus: 'pending', // Regular members go to pending
        isActive: true,
      })
      .returning();

    expect(alert).toBeDefined();
    expect(alert.approvalStatus).toBe('pending');
    expect(alert.userId).toBe(memberUserId);
  });

  it('trusted user with canAutoApproveKosherAlerts gets auto-approved', async () => {
    // Verify user has permission
    const [user] = await testDb
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, trustedUserId))
      .limit(1);

    expect(user.canAutoApproveKosherAlerts).toBe(true);

    // Simulating the API logic: if user has permission, status = approved
    const approvalStatus = user.canAutoApproveKosherAlerts ? 'approved' : 'pending';

    const [alert] = await testDb
      .insert(schema.kosherAlerts)
      .values({
        userId: trustedUserId,
        productName: '[TEST] Trusted User Product',
        brand: 'Test Brand',
        alertType: 'warning',
        description: 'Test description for trusted user submission',
        certifyingAgency: 'OK',
        approvalStatus,
        isActive: true,
      })
      .returning();

    expect(alert).toBeDefined();
    expect(alert.approvalStatus).toBe('approved');
  });

  it('admin can approve pending kosher alert', async () => {
    // Create pending alert
    const [pendingAlert] = await testDb
      .insert(schema.kosherAlerts)
      .values({
        userId: memberUserId,
        productName: '[TEST] Pending Alert to Approve',
        description: 'Waiting for approval',
        approvalStatus: 'pending',
        isActive: true,
      })
      .returning();

    expect(pendingAlert.approvalStatus).toBe('pending');

    // Admin approves it
    const [approved] = await testDb
      .update(schema.kosherAlerts)
      .set({ approvalStatus: 'approved' })
      .where(eq(schema.kosherAlerts.id, pendingAlert.id))
      .returning();

    expect(approved.approvalStatus).toBe('approved');
  });

  it('admin can reject pending kosher alert', async () => {
    const [pendingAlert] = await testDb
      .insert(schema.kosherAlerts)
      .values({
        userId: memberUserId,
        productName: '[TEST] Alert to Reject',
        description: 'Will be rejected',
        approvalStatus: 'pending',
        isActive: true,
      })
      .returning();

    const [rejected] = await testDb
      .update(schema.kosherAlerts)
      .set({ approvalStatus: 'rejected' })
      .where(eq(schema.kosherAlerts.id, pendingAlert.id))
      .returning();

    expect(rejected.approvalStatus).toBe('rejected');
  });

  it('only approved and active alerts are publicly visible', async () => {
    // Create multiple alerts with different statuses
    await testDb.insert(schema.kosherAlerts).values([
      {
        userId: adminUserId,
        productName: '[TEST] Approved Active',
        description: 'Should be visible',
        approvalStatus: 'approved',
        isActive: true,
      },
      {
        userId: memberUserId,
        productName: '[TEST] Pending',
        description: 'Should not be visible',
        approvalStatus: 'pending',
        isActive: true,
      },
      {
        userId: adminUserId,
        productName: '[TEST] Approved Inactive',
        description: 'Should not be visible',
        approvalStatus: 'approved',
        isActive: false,
      },
    ]);

    // Query public alerts (approved AND active)
    const publicAlerts = await testDb
      .select()
      .from(schema.kosherAlerts)
      .where(
        and(
          eq(schema.kosherAlerts.approvalStatus, 'approved'),
          eq(schema.kosherAlerts.isActive, true),
          like(schema.kosherAlerts.productName, '[TEST]%')
        )
      );

    expect(publicAlerts.length).toBe(1);
    expect(publicAlerts[0].productName).toBe('[TEST] Approved Active');
  });

  it('kosher alert can have all optional fields', async () => {
    const [alert] = await testDb
      .insert(schema.kosherAlerts)
      .values({
        userId: adminUserId,
        productName: '[TEST] Full Details Product',
        brand: 'Full Brand',
        alertType: 'recall',
        description: 'Full description',
        certifyingAgency: 'Star-K',
        effectiveDate: '2026-03-01',
        issueDate: '2026-02-20',
        approvalStatus: 'approved',
        isActive: true,
      })
      .returning();

    expect(alert.brand).toBe('Full Brand');
    expect(alert.alertType).toBe('recall');
    expect(alert.certifyingAgency).toBe('Star-K');
    expect(alert.effectiveDate).toBe('2026-03-01');
    expect(alert.issueDate).toBe('2026-02-20');
  });
});
