import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestUser, cleanupTestUsers } from "./utils/test-db";

/**
 * PATCH /api/shuls/[id]/documents/[docId] — two holes, both create-only fixes
 * that were never applied to the edit path.
 *
 * 1. `fileUrl` used `z.string().url()`, which ACCEPTS "data:text/html;base64,…".
 *    That value is rendered into an <iframe src> on the public shul page, and a
 *    shul manager's edits go live with no admin review — so uploading a real
 *    PDF and then PATCHing the row framed arbitrary HTML inside frumtoronto.com.
 *    The create route already used the upload-host allowlist and commented on
 *    exactly why.
 *
 * 2. No `assertCanPost`, so a disabled account — whose JWT keeps working, which
 *    is the whole case that check exists for — retained full control of the
 *    shul's public documents.
 */

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: String(currentUserId), role: "admin", email: "t@frumtoronto.test" },
  })),
}));
vi.mock("@vercel/blob", () => ({ del: vi.fn(async () => undefined) }));
vi.mock("@/lib/notifications", () => ({
  notifyAdminOfSubmission: vi.fn(async () => undefined),
}));

const { PATCH } = await import("@/app/api/shuls/[id]/documents/[docId]/route");
const { db } = await import("@/lib/db");
const { shuls, shulDocuments } = await import("@/lib/db/schema");

const stamp = Date.now();
let currentUserId = 0;
let activeAdminId = 0;
let blockedAdminId = 0;
let shulId = 0;
let docId = 0;

const GOOD_URL = `https://abc123.public.blob.vercel-storage.com/newsletter-${stamp}.pdf`;

const patch = (body: unknown) =>
  PATCH(
    new Request(`http://localhost/api/shuls/${shulId}/documents/${docId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
    { params: Promise.resolve({ id: String(shulId), docId: String(docId) }) } as never
  );

beforeAll(async () => {
  activeAdminId = (
    await createTestUser({
      email: `test-doc-admin-${stamp}@frumtoronto.test`,
      role: "admin",
      emailVerified: new Date(),
    })
  ).id;
  blockedAdminId = (
    await createTestUser({
      email: `test-doc-blocked-${stamp}@frumtoronto.test`,
      role: "admin",
      emailVerified: new Date(),
      isActive: false,
    })
  ).id;
  currentUserId = activeAdminId;

  const [shul] = await db
    .insert(shuls)
    .values({ name: `[TEST] Doc Guard Shul ${stamp}`, slug: `test-doc-guard-${stamp}` })
    .returning({ id: shuls.id });
  shulId = shul.id;

  const [doc] = await db
    .insert(shulDocuments)
    .values({
      shulId,
      title: "[TEST] Original Newsletter",
      type: "newsletter",
      fileUrl: GOOD_URL,
      uploadedBy: activeAdminId,
    })
    .returning({ id: shulDocuments.id });
  docId = doc.id;
});

afterAll(async () => {
  await db.delete(shulDocuments).where(eq(shulDocuments.shulId, shulId));
  await db.delete(shuls).where(eq(shuls.id, shulId));
  await cleanupTestUsers();
});

describe("fileUrl on edit", () => {
  it("rejects the schemes z.string().url() lets through", async () => {
    // Each of these passes `new URL()`. The data: one is the live exploit —
    // React 19 blocks javascript: in an iframe src but passes data: verbatim.
    for (const url of [
      "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
      "javascript:alert(1)",
      "file:///etc/passwd",
    ]) {
      const res = await patch({ fileUrl: url });
      expect(res.status, url).toBe(400);
    }

    const [after] = await db
      .select({ fileUrl: shulDocuments.fileUrl })
      .from(shulDocuments)
      .where(eq(shulDocuments.id, docId));
    expect(after.fileUrl).toBe(GOOD_URL);
  });

  it("rejects a real http URL on someone else's host", async () => {
    // Not just about schemes: approval is only meaningful if the bytes cannot
    // be swapped afterwards on a host we do not control.
    const res = await patch({ fileUrl: "https://evil.example/newsletter.pdf" });
    expect(res.status).toBe(400);
  });

  it("accepts a URL from our own upload storage", async () => {
    const replacement = `https://abc123.public.blob.vercel-storage.com/replacement-${stamp}.pdf`;
    const res = await patch({ fileUrl: replacement });
    expect(res.status).toBe(200);

    const [after] = await db
      .select({ fileUrl: shulDocuments.fileUrl })
      .from(shulDocuments)
      .where(eq(shulDocuments.id, docId));
    expect(after.fileUrl).toBe(replacement);
  });

  it("still allows an edit that does not touch the URL", async () => {
    const res = await patch({ title: "[TEST] Renamed Newsletter" });
    expect(res.status).toBe(200);
  });
});

describe("a disabled account", () => {
  it("cannot edit the shul's documents", async () => {
    currentUserId = blockedAdminId;
    try {
      const res = await patch({ title: "[TEST] Edited While Blocked" });
      expect(res.status).toBe(403);

      const [after] = await db
        .select({ title: shulDocuments.title })
        .from(shulDocuments)
        .where(eq(shulDocuments.id, docId));
      expect(after.title).toBe("[TEST] Renamed Newsletter");
    } finally {
      currentUserId = activeAdminId;
    }
  });
});
