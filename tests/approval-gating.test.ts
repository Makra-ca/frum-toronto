/**
 * Approval-gating regression tests ("tripwires").
 *
 * Phase 0 of the notification project fixed leaks where content awaiting admin
 * approval was publicly visible. These tests prove that gating keeps working.
 *
 * NOTE ON APPROACH: these assert at the DB-query level, mirroring the exact
 * public-visibility WHERE clause each surface uses (file reference in each
 * block). They do NOT invoke the React server components / route handlers
 * directly — importing those pulls in next-auth, which doesn't resolve under
 * vitest, and every existing integration test in this repo uses the same
 * DB-level pattern. The limitation: if someone removes a filter from the real
 * page/route, these copies won't catch it on their own — so each test names the
 * source file it mirrors. They DO catch schema/data drift and document the
 * invariant. A full guarantee would need an e2e test against a running server.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { and, eq, isNull, or, like } from 'drizzle-orm';
import { testDb, createTestUser, cleanupTestUsers } from './utils/test-db';
import * as schema from '@/lib/db/schema';

const TAG = '[TEST-GATING]';

let memberUserId: number;
let categoryId: number;

let slugCounter = 0;
function uniqueSlug(name: string): string {
  slugCounter += 1;
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${slugCounter}-${Date.now()}`;
}

async function cleanupContent() {
  await testDb.delete(schema.shiurim).where(like(schema.shiurim.title, `${TAG}%`));
  await testDb.delete(schema.classifieds).where(like(schema.classifieds.title, `${TAG}%`));
  await testDb.delete(schema.askTheRabbi).where(like(schema.askTheRabbi.title, `${TAG}%`));
  await testDb.delete(schema.businesses).where(like(schema.businesses.name, `${TAG}%`));
}

beforeAll(async () => {
  await cleanupTestUsers();
  await cleanupContent();
  await testDb
    .delete(schema.businessCategories)
    .where(like(schema.businessCategories.name, `${TAG}%`));

  const member = await createTestUser({
    email: 'test-member-gating@frumtoronto.test',
    role: 'member',
  });
  memberUserId = member.id;

  const [cat] = await testDb
    .insert(schema.businessCategories)
    .values({ name: `${TAG} Category`, slug: uniqueSlug('test-gating-cat') })
    .returning();
  categoryId = cat.id;
});

afterAll(async () => {
  await cleanupContent();
  await testDb
    .delete(schema.businessCategories)
    .where(like(schema.businessCategories.name, `${TAG}%`));
  await cleanupTestUsers();
});

beforeEach(cleanupContent);

// ─────────────────────────────────────────────────────────────
// L5 — Shiurim list + detail (mirrors src/app/api/shiurim/route.ts +
//      src/app/api/shiurim/[id]/route.ts)
// Public: isActive = true AND approvalStatus = 'approved'
//         AND (isOnHold = false OR isOnHold IS NULL)
// ─────────────────────────────────────────────────────────────
describe('L5: shiurim API hides non-approved shiurim', () => {
  async function insertShiur(title: string, approvalStatus: string) {
    const [row] = await testDb
      .insert(schema.shiurim)
      .values({ title, teacherName: 'Test Teacher', approvalStatus, isActive: true, isOnHold: false })
      .returning();
    return row;
  }

  const publicWhere = () =>
    and(
      eq(schema.shiurim.approvalStatus, 'approved'),
      eq(schema.shiurim.isActive, true),
      or(eq(schema.shiurim.isOnHold, false), isNull(schema.shiurim.isOnHold)),
      like(schema.shiurim.title, `${TAG}%`)
    );

  it('list excludes pending, includes approved', async () => {
    await insertShiur(`${TAG} Approved Shiur`, 'approved');
    await insertShiur(`${TAG} Pending Shiur`, 'pending');

    const visible = await testDb
      .select({ title: schema.shiurim.title })
      .from(schema.shiurim)
      .where(publicWhere());
    const titles = visible.map((s) => s.title);

    expect(titles).toContain(`${TAG} Approved Shiur`);
    expect(titles).not.toContain(`${TAG} Pending Shiur`);
  });

  it('detail query finds an approved shiur but not a pending one', async () => {
    const approved = await insertShiur(`${TAG} Approved Detail`, 'approved');
    const pending = await insertShiur(`${TAG} Pending Detail`, 'pending');

    const find = (id: number) =>
      testDb
        .select({ id: schema.shiurim.id })
        .from(schema.shiurim)
        .where(and(eq(schema.shiurim.id, id), publicWhere()));

    expect(await find(approved.id)).toHaveLength(1);
    expect(await find(pending.id)).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// L4 — Directory category browse (mirrors src/app/api/directory/[slug]/route.ts)
// Public: categoryId = X AND isActive = true AND approvalStatus = 'approved'
// ─────────────────────────────────────────────────────────────
describe('L4: directory category listing hides non-approved businesses', () => {
  async function insertBusiness(name: string, approvalStatus: string, isActive = true) {
    const [row] = await testDb
      .insert(schema.businesses)
      .values({ name, slug: uniqueSlug(name), categoryId, userId: memberUserId, approvalStatus, isActive })
      .returning();
    return row;
  }

  it('only approved + active businesses appear in the category listing', async () => {
    await insertBusiness(`${TAG} Approved Biz`, 'approved', true);
    await insertBusiness(`${TAG} Pending Biz`, 'pending', true);
    await insertBusiness(`${TAG} Inactive Biz`, 'approved', false);

    const visible = await testDb
      .select({ name: schema.businesses.name })
      .from(schema.businesses)
      .where(
        and(
          eq(schema.businesses.categoryId, categoryId),
          eq(schema.businesses.isActive, true),
          eq(schema.businesses.approvalStatus, 'approved'),
          like(schema.businesses.name, `${TAG}%`)
        )
      );
    const names = visible.map((b) => b.name);

    expect(names).toContain(`${TAG} Approved Biz`);
    expect(names).not.toContain(`${TAG} Pending Biz`);
    expect(names).not.toContain(`${TAG} Inactive Biz`);
  });
});

// ─────────────────────────────────────────────────────────────
// L1 — Ask the Rabbi detail (mirrors src/app/ask-the-rabbi/[id]/page.tsx)
// Public viewer: isPublished = true (admin/manager bypass is the page's job).
// ─────────────────────────────────────────────────────────────
describe('L1: Ask the Rabbi detail hides unpublished questions', () => {
  async function insertQuestion(title: string, isPublished: boolean) {
    const [row] = await testDb
      .insert(schema.askTheRabbi)
      .values({ title, question: 'Test question body', isPublished })
      .returning();
    return row;
  }

  it('published question is publicly visible; unpublished is not', async () => {
    const published = await insertQuestion(`${TAG} Published Q`, true);
    const unpublished = await insertQuestion(`${TAG} Unpublished Q`, false);

    const find = (id: number) =>
      testDb
        .select({ id: schema.askTheRabbi.id })
        .from(schema.askTheRabbi)
        .where(and(eq(schema.askTheRabbi.id, id), eq(schema.askTheRabbi.isPublished, true)));

    expect(await find(published.id)).toHaveLength(1);
    expect(await find(unpublished.id)).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// L2 — Classified detail (mirrors src/app/classifieds/[id]/page.tsx)
// Public viewer: approvalStatus = 'approved' AND isActive = true.
// ─────────────────────────────────────────────────────────────
describe('L2: classified detail hides non-approved listings', () => {
  async function insertClassified(title: string, approvalStatus: string, isActive = true) {
    const [row] = await testDb
      .insert(schema.classifieds)
      .values({ title, description: 'Test description', approvalStatus, isActive, userId: memberUserId })
      .returning();
    return row;
  }

  it('only an approved + active classified is publicly fetchable by id', async () => {
    const approved = await insertClassified(`${TAG} Approved Classified`, 'approved', true);
    const pending = await insertClassified(`${TAG} Pending Classified`, 'pending', true);
    const inactive = await insertClassified(`${TAG} Inactive Classified`, 'approved', false);

    const find = (id: number) =>
      testDb
        .select({ id: schema.classifieds.id })
        .from(schema.classifieds)
        .where(
          and(
            eq(schema.classifieds.id, id),
            eq(schema.classifieds.approvalStatus, 'approved'),
            eq(schema.classifieds.isActive, true)
          )
        );

    expect(await find(approved.id)).toHaveLength(1);
    expect(await find(pending.id)).toHaveLength(0);
    expect(await find(inactive.id)).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// L3 — Business detail (mirrors src/app/directory/business/[slug]/page.tsx)
// Public viewer: approvalStatus = 'approved' AND isActive = true.
// ─────────────────────────────────────────────────────────────
describe('L3: business detail hides non-approved businesses (public view)', () => {
  async function insertBusiness(name: string, approvalStatus: string, isActive = true) {
    const [row] = await testDb
      .insert(schema.businesses)
      .values({ name, slug: uniqueSlug(name), categoryId, userId: memberUserId, approvalStatus, isActive })
      .returning();
    return row;
  }

  it('only an approved + active business is publicly fetchable by slug', async () => {
    const approved = await insertBusiness(`${TAG} Approved Detail Biz`, 'approved', true);
    const pending = await insertBusiness(`${TAG} Pending Detail Biz`, 'pending', true);

    const find = (slug: string) =>
      testDb
        .select({ id: schema.businesses.id })
        .from(schema.businesses)
        .where(
          and(
            eq(schema.businesses.slug, slug),
            eq(schema.businesses.approvalStatus, 'approved'),
            eq(schema.businesses.isActive, true)
          )
        );

    expect(await find(approved.slug)).toHaveLength(1);
    expect(await find(pending.slug)).toHaveLength(0);
  });
});
