import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, blogPosts } from "@/lib/db/schema";
import { blogEditSchema } from "@/lib/validations/submission-edits";
import { blogPostSchema } from "@/lib/validations/blog";

/**
 * Two things this pins.
 *
 * 1. THE LIVE BUG. The admin blog editor's "Require approval" option sent the
 *    string "require_approval", but every schema on the path accepts only
 *    "open" | "approved". Zod rejected it, so an admin who picked it could not
 *    save the post at all — the per-post control had never worked for the one
 *    thing it exists to do.
 *
 * 2. The direction rule. Authors may now set the override, but only to make
 *    their own post STRICTER. Letting an author choose "open" would hand them
 *    a way around an admin's decision — either a site-wide hold, or moderation
 *    switched on for that post after comments turned abusive.
 */

const mocks = vi.hoisted(() => ({
  session: {
    user: { id: "0", role: "member", email: "a@b.test", name: "Author" },
  },
}));

vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn(async () => mocks.session) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/notifications")>()),
  notifyAdminOfSubmission: vi.fn(async () => undefined),
  notifyAdminOfTrustedEdit: vi.fn(async () => undefined),
}));

const createRoute = await import("@/app/api/user/blog/route");

const stamp = Date.now();
const createdUserIds: number[] = [];
const createdPostIds: number[] = [];
let author: number;
let admin: number;

async function makeUser(suffix: string, extra: Record<string, unknown> = {}) {
  const [u] = await db
    .insert(users)
    .values({
      email: `test-modov-${suffix}-${stamp}@frumtoronto.test`,
      firstName: "Test",
      lastName: suffix,
      role: "member",
      isActive: true,
      emailVerified: new Date(),
      ...extra,
    } as never)
    .returning({ id: users.id });
  createdUserIds.push(u.id);
  return u.id;
}

async function createPost(
  actorId: number,
  role: string,
  commentModeration: string | null,
  label: string
) {
  mocks.session.user.id = String(actorId);
  mocks.session.user.role = role;
  const res = await createRoute.POST(
    new Request("http://localhost/api/user/blog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${label} ${stamp}`,
        content: "<p>body</p>",
        commentModeration,
      }),
    }) as never
  );
  const body = await res.json().catch(() => ({}));
  if (body?.id) createdPostIds.push(body.id);
  return { status: res.status, body };
}

beforeAll(async () => {
  author = await makeUser("author");
  admin = await makeUser("admin", { role: "admin" });
});

afterAll(async () => {
  if (createdPostIds.length) {
    await db.delete(blogPosts).where(inArray(blogPosts.id, createdPostIds));
  }
  if (createdUserIds.length) {
    await db.delete(blogPosts).where(inArray(blogPosts.authorId, createdUserIds));
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
});

describe("the value the admin editor sends", () => {
  it('accepts "approved" on both schemas', () => {
    expect(
      blogPostSchema.partial().safeParse({ commentModeration: "approved" })
        .success
    ).toBe(true);
    expect(
      blogEditSchema.safeParse({ commentModeration: "approved" }).success
    ).toBe(true);
  });

  it('rejects "require_approval" — the string the editor used to send', () => {
    // This is why picking "Require approval" made the whole save fail.
    expect(
      blogPostSchema.partial().safeParse({ commentModeration: "require_approval" })
        .success
    ).toBe(false);
    expect(
      blogEditSchema.safeParse({ commentModeration: "require_approval" }).success
    ).toBe(false);
  });
});

describe("an author setting their own post stricter", () => {
  it("is allowed and actually persists", async () => {
    const { status, body } = await createPost(
      author,
      "member",
      "approved",
      "author tightens"
    );
    expect(status).toBe(201);

    const [row] = await db
      .select({ commentModeration: blogPosts.commentModeration })
      .from(blogPosts)
      .where(eq(blogPosts.id, body.id));
    expect(row.commentModeration).toBe("approved");
  });

  it("may still defer to the site by sending null", async () => {
    const { status, body } = await createPost(
      author,
      "member",
      null,
      "author defers"
    );
    expect(status).toBe(201);

    const [row] = await db
      .select({ commentModeration: blogPosts.commentModeration })
      .from(blogPosts)
      .where(eq(blogPosts.id, body.id));
    expect(row.commentModeration).toBeNull();
  });
});

describe("an author trying to turn moderation off", () => {
  it("is refused with 403, not silently ignored", async () => {
    // Silently dropping it would leave the author believing the setting took,
    // which is worse than a refusal: they would think comments were open.
    const { status, body } = await createPost(
      author,
      "member",
      "open",
      "author loosens"
    );
    expect(status).toBe(403);
    expect(body.error).toMatch(/only an admin/i);
  });

  it("writes no post at all", async () => {
    const rows = await db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(eq(blogPosts.authorId, author));
    const titles = await db
      .select({ title: blogPosts.title })
      .from(blogPosts)
      .where(inArray(blogPosts.id, rows.map((r) => r.id)));
    expect(titles.map((t) => t.title)).not.toContain(
      `author loosens ${stamp}`
    );
  });
});

describe("an admin", () => {
  it("can still turn moderation off for a post", async () => {
    const { status, body } = await createPost(
      admin,
      "admin",
      "open",
      "admin loosens"
    );
    expect(status).toBe(201);

    const [row] = await db
      .select({ commentModeration: blogPosts.commentModeration })
      .from(blogPosts)
      .where(eq(blogPosts.id, body.id));
    expect(row.commentModeration).toBe("open");
  });
});

describe("an author editing a post an admin had already set to open", () => {
  it("can still save it — the rule is about CHANGING, not carrying", async () => {
    // The near-miss. The editor resends the current value with every save, so
    // a rule that refused "open" outright locked the author out of editing
    // their own post entirely over a typo fix.
    const editRoute = await import("@/app/api/user/blog/[id]/route");

    const [post] = await db
      .insert(blogPosts)
      .values({
        title: `admin set open ${stamp}`,
        slug: `admin-set-open-${stamp}`,
        content: "<p>body</p>",
        authorId: author,
        approvalStatus: "approved",
        isActive: true,
        commentModeration: "open",
      } as never)
      .returning({ id: blogPosts.id });
    createdPostIds.push(post.id);

    mocks.session.user.id = String(author);
    mocks.session.user.role = "member";

    const res = await editRoute.PATCH(
      new Request("http://localhost/x", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `admin set open ${stamp} (typo fixed)`,
          content: "<p>body</p>",
          commentModeration: "open", // unchanged — what the editor sends
        }),
      }) as never,
      { params: Promise.resolve({ id: String(post.id) }) }
    );

    expect(res.status).toBe(200);

    const [row] = await db
      .select({ commentModeration: blogPosts.commentModeration })
      .from(blogPosts)
      .where(eq(blogPosts.id, post.id));
    expect(row.commentModeration).toBe("open");
  });

  it("still cannot change a moderated post to open", async () => {
    const editRoute = await import("@/app/api/user/blog/[id]/route");

    const [post] = await db
      .insert(blogPosts)
      .values({
        title: `admin set approved ${stamp}`,
        slug: `admin-set-approved-${stamp}`,
        content: "<p>body</p>",
        authorId: author,
        approvalStatus: "approved",
        isActive: true,
        commentModeration: "approved",
      } as never)
      .returning({ id: blogPosts.id });
    createdPostIds.push(post.id);

    mocks.session.user.id = String(author);
    mocks.session.user.role = "member";

    const res = await editRoute.PATCH(
      new Request("http://localhost/x", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentModeration: "open" }),
      }) as never,
      { params: Promise.resolve({ id: String(post.id) }) }
    );

    expect(res.status).toBe(403);

    const [row] = await db
      .select({ commentModeration: blogPosts.commentModeration })
      .from(blogPosts)
      .where(eq(blogPosts.id, post.id));
    expect(row.commentModeration).toBe("approved");
  });
});
