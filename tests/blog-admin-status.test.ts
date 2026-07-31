import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, blogPosts } from "@/lib/db/schema";

/**
 * The admin's Reject button on a blog post.
 *
 * It did nothing. `blogPostSchema` carries no `approvalStatus`, so
 * `.partial().safeParse(body)` stripped it and the update never contained it —
 * while the UI showed "Post rejected". The one line that DID set a status
 * required publishedAt to be null, so re-approving an already-published post
 * was equally silent.
 */

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "1", role: "admin" } })),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

const { PATCH } = await import("@/app/api/admin/blog/[id]/route");

const stamp = Date.now();
const createdUserIds: number[] = [];
const createdPostIds: number[] = [];
let authorId: number;

async function makePost(approvalStatus: string, publishedAt: Date | null) {
  const [p] = await db
    .insert(blogPosts)
    .values({
      authorId,
      title: `[TEST] blog status ${createdPostIds.length}`,
      slug: `test-blog-status-${stamp}-${createdPostIds.length}`,
      content: "<p>[TEST]</p>",
      approvalStatus,
      publishedAt,
      isActive: true,
    })
    .returning({ id: blogPosts.id });
  createdPostIds.push(p.id);
  return p.id;
}

async function patch(id: number, body: Record<string, unknown>) {
  return PATCH(
    new Request(`http://localhost/api/admin/blog/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
    { params: Promise.resolve({ id: String(id) }) }
  );
}

beforeAll(async () => {
  const [u] = await db
    .insert(users)
    .values({
      email: `test-blogstatus-${stamp}@frumtoronto.test`,
      firstName: "Test",
      lastName: "Author",
      role: "member",
      isActive: true,
      emailVerified: new Date(),
    })
    .returning({ id: users.id });
  authorId = u.id;
  createdUserIds.push(u.id);
});

afterAll(async () => {
  if (createdPostIds.length) {
    await db.delete(blogPosts).where(inArray(blogPosts.id, createdPostIds));
  }
  if (createdUserIds.length) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
});

describe("admin blog status writes", () => {
  it("actually rejects a pending post", async () => {
    const id = await makePost("pending", null);

    const res = await patch(id, { approvalStatus: "rejected", rejectionReason: "Off topic" });

    expect(res.status).toBe(200);
    const [row] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    expect(row.approvalStatus).toBe("rejected");
    expect(row.rejectionReason).toBe("Off topic");
  });

  it("approves a post that was already published once", async () => {
    // The old guard required publishedAt === null, so a post being re-approved
    // after a correction stayed unapproved and off the site forever.
    const published = new Date("2020-01-01T00:00:00.000Z");
    const id = await makePost("pending_edit", published);

    const res = await patch(id, { approvalStatus: "approved" });

    expect(res.status).toBe(200);
    const [row] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    expect(row.approvalStatus).toBe("approved");
    // publishedAt must NOT move, or a corrected post jumps to the top of the
    // blog as though it were new.
    expect(row.publishedAt?.toISOString()).toBe(published.toISOString());
  });

  it("stamps publishedAt on a first approval", async () => {
    const id = await makePost("pending", null);

    await patch(id, { approvalStatus: "approved" });

    const [row] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    expect(row.publishedAt).not.toBeNull();
  });

  it("takes a LIVE post off the site when it is rejected", async () => {
    // The operationally important case, and the one the broken route made
    // impossible: rejecting something currently public. All the other status
    // tests start from pending, where nothing is at stake.
    const id = await makePost("approved", new Date("2020-01-01T00:00:00.000Z"));

    const res = await patch(id, {
      approvalStatus: "rejected",
      rejectionReason: "Copyright complaint",
    });

    expect(res.status).toBe(200);
    const [row] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    expect(row.approvalStatus).toBe("rejected");
    expect(row.rejectionReason).toBe("Copyright complaint");
    // publishedAt is history, not visibility — it must not be wiped.
    expect(row.publishedAt).not.toBeNull();
  });

  it("clears the reason when a rejected post is later approved", async () => {
    const id = await makePost("pending", null);
    await patch(id, { approvalStatus: "rejected", rejectionReason: "Fix the title" });

    await patch(id, { approvalStatus: "approved" });

    const [row] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    // Otherwise a live post carries the reason it was once turned down, and
    // the dashboard shows it to the author forever.
    expect(row.rejectionReason).toBeNull();
  });

  it("records a corrected reason even when the status does not change", async () => {
    const id = await makePost("rejected", null);

    const res = await patch(id, {
      approvalStatus: "rejected",
      rejectionReason: "Clearer explanation",
    });

    expect(res.status).toBe(200);
    const [row] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    expect(row.rejectionReason).toBe("Clearer explanation");
  });

  it("still saves ordinary content edits", async () => {
    // Positive control: an implementation that ignores the body entirely would
    // pass the assertions above if they only checked the status.
    const id = await makePost("pending", null);

    await patch(id, { title: "[TEST] retitled", content: "<p>new</p>" });

    const [row] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    expect(row.title).toBe("[TEST] retitled");
    expect(row.content).toBe("<p>new</p>");
  });

  it("refuses a status the system does not use", async () => {
    const id = await makePost("pending", null);

    const res = await patch(id, { approvalStatus: "banana" });

    expect(res.status).toBe(400);
  });
});
