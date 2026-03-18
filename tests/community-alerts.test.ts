import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq, and, isNull, or, gte, like } from 'drizzle-orm';
import { testDb, createTestUser, cleanupTestUsers, cleanupTestAlerts } from './utils/test-db';
import * as schema from '@/lib/db/schema';

describe('Community Alerts', () => {
  let adminUserId: number;
  let memberUserId: number;

  beforeAll(async () => {
    await cleanupTestUsers();
    await cleanupTestAlerts();

    // Create test users
    const admin = await createTestUser({
      email: 'test-admin-alerts@frumtoronto.test',
      role: 'admin',
    });
    adminUserId = admin.id;

    const member = await createTestUser({
      email: 'test-member-alerts@frumtoronto.test',
      role: 'member',
    });
    memberUserId = member.id;
  });

  afterAll(async () => {
    await cleanupTestAlerts();
    await cleanupTestUsers();
  });

  beforeEach(async () => {
    await cleanupTestAlerts();
  });

  it('admin can create bulletin alert', async () => {
    const [alert] = await testDb
      .insert(schema.alerts)
      .values({
        userId: adminUserId,
        alertType: 'bulletin',
        title: '[TEST] Community Bulletin',
        content: 'Important community announcement',
        urgency: 'normal',
        isActive: true,
      })
      .returning();

    expect(alert).toBeDefined();
    expect(alert.alertType).toBe('bulletin');
    expect(alert.urgency).toBe('normal');
    expect(alert.isActive).toBe(true);
  });

  it('admin can create urgent alert', async () => {
    const [alert] = await testDb
      .insert(schema.alerts)
      .values({
        userId: adminUserId,
        alertType: 'general',
        title: '[TEST] Urgent Alert',
        content: 'This is an urgent community alert',
        urgency: 'high',
        isPinned: true,
        isActive: true,
      })
      .returning();

    expect(alert).toBeDefined();
    expect(alert.urgency).toBe('high');
    expect(alert.isPinned).toBe(true);
  });

  it('admin can create alert with expiration date', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    const [alert] = await testDb
      .insert(schema.alerts)
      .values({
        userId: adminUserId,
        alertType: 'bulletin',
        title: '[TEST] Expiring Alert',
        content: 'This alert expires in 7 days',
        expiresAt: futureDate,
        isActive: true,
      })
      .returning();

    expect(alert).toBeDefined();
    expect(alert.expiresAt).toBeDefined();
    expect(new Date(alert.expiresAt!).getTime()).toBeGreaterThan(Date.now());
  });

  it('only active and non-expired alerts are publicly visible', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    // Create multiple alerts with different statuses
    await testDb.insert(schema.alerts).values([
      {
        userId: adminUserId,
        alertType: 'bulletin',
        title: '[TEST] Active No Expiry',
        content: 'Should be visible',
        isActive: true,
      },
      {
        userId: adminUserId,
        alertType: 'bulletin',
        title: '[TEST] Active Future Expiry',
        content: 'Should be visible',
        expiresAt: futureDate,
        isActive: true,
      },
      {
        userId: adminUserId,
        alertType: 'bulletin',
        title: '[TEST] Active Past Expiry',
        content: 'Should not be visible - expired',
        expiresAt: pastDate,
        isActive: true,
      },
      {
        userId: adminUserId,
        alertType: 'bulletin',
        title: '[TEST] Inactive',
        content: 'Should not be visible - inactive',
        isActive: false,
      },
    ]);

    const now = new Date();

    // Query public alerts (active AND (no expiry OR expiry > now))
    const publicAlerts = await testDb
      .select()
      .from(schema.alerts)
      .where(
        and(
          eq(schema.alerts.isActive, true),
          or(
            isNull(schema.alerts.expiresAt),
            gte(schema.alerts.expiresAt, now)
          ),
          like(schema.alerts.title, '[TEST]%')
        )
      );

    expect(publicAlerts.length).toBe(2);
    const titles = publicAlerts.map(a => a.title);
    expect(titles).toContain('[TEST] Active No Expiry');
    expect(titles).toContain('[TEST] Active Future Expiry');
    expect(titles).not.toContain('[TEST] Active Past Expiry');
    expect(titles).not.toContain('[TEST] Inactive');
  });

  it('admin can deactivate an alert', async () => {
    const [alert] = await testDb
      .insert(schema.alerts)
      .values({
        userId: adminUserId,
        alertType: 'bulletin',
        title: '[TEST] Alert to Deactivate',
        content: 'Will be deactivated',
        isActive: true,
      })
      .returning();

    expect(alert.isActive).toBe(true);

    const [deactivated] = await testDb
      .update(schema.alerts)
      .set({ isActive: false })
      .where(eq(schema.alerts.id, alert.id))
      .returning();

    expect(deactivated.isActive).toBe(false);
  });

  it('admin can pin/unpin alerts', async () => {
    const [alert] = await testDb
      .insert(schema.alerts)
      .values({
        userId: adminUserId,
        alertType: 'bulletin',
        title: '[TEST] Alert to Pin',
        content: 'Will be pinned',
        isPinned: false,
        isActive: true,
      })
      .returning();

    expect(alert.isPinned).toBe(false);

    // Pin it
    const [pinned] = await testDb
      .update(schema.alerts)
      .set({ isPinned: true })
      .where(eq(schema.alerts.id, alert.id))
      .returning();

    expect(pinned.isPinned).toBe(true);

    // Unpin it
    const [unpinned] = await testDb
      .update(schema.alerts)
      .set({ isPinned: false })
      .where(eq(schema.alerts.id, alert.id))
      .returning();

    expect(unpinned.isPinned).toBe(false);
  });

  it('admin can update alert urgency', async () => {
    const [alert] = await testDb
      .insert(schema.alerts)
      .values({
        userId: adminUserId,
        alertType: 'general',
        title: '[TEST] Urgency Test',
        content: 'Testing urgency levels',
        urgency: 'normal',
        isActive: true,
      })
      .returning();

    expect(alert.urgency).toBe('normal');

    // Escalate to high
    const [escalated] = await testDb
      .update(schema.alerts)
      .set({ urgency: 'high' })
      .where(eq(schema.alerts.id, alert.id))
      .returning();

    expect(escalated.urgency).toBe('high');

    // De-escalate to low
    const [deescalated] = await testDb
      .update(schema.alerts)
      .set({ urgency: 'low' })
      .where(eq(schema.alerts.id, alert.id))
      .returning();

    expect(deescalated.urgency).toBe('low');
  });

  it('all alert types can be created', async () => {
    const alertTypes = ['bulletin', 'kosher', 'general'];

    for (const alertType of alertTypes) {
      const [alert] = await testDb
        .insert(schema.alerts)
        .values({
          userId: adminUserId,
          alertType,
          title: `[TEST] ${alertType} Alert`,
          content: `Content for ${alertType} alert`,
          isActive: true,
        })
        .returning();

      expect(alert.alertType).toBe(alertType);
    }

    // Verify all types were created
    const allAlerts = await testDb
      .select()
      .from(schema.alerts)
      .where(like(schema.alerts.title, '[TEST]%'));

    expect(allAlerts.length).toBe(3);
    const types = allAlerts.map(a => a.alertType);
    expect(types).toContain('bulletin');
    expect(types).toContain('kosher');
    expect(types).toContain('general');
  });

  it('admin can delete an alert', async () => {
    const [alert] = await testDb
      .insert(schema.alerts)
      .values({
        userId: adminUserId,
        alertType: 'bulletin',
        title: '[TEST] Alert to Delete',
        content: 'Will be deleted',
        isActive: true,
      })
      .returning();

    expect(alert).toBeDefined();

    // Delete it
    await testDb
      .delete(schema.alerts)
      .where(eq(schema.alerts.id, alert.id));

    // Verify it's gone
    const [deleted] = await testDb
      .select()
      .from(schema.alerts)
      .where(eq(schema.alerts.id, alert.id))
      .limit(1);

    expect(deleted).toBeUndefined();
  });
});
