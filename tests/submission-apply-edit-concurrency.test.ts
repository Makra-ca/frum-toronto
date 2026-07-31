import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, classifieds } from "@/lib/db/schema";

/**
 * The generic edit path's 409, proven the only way that is deterministic.
 *
 * applyEdit reads the row, makes another round trip to resolve the status,
 * then writes. The mock below acts as an admin INSIDE that window. Racing two
 * real callers with Promise.all proves nothing against neon-http: each query
 * is its own round trip, so the first finishes writing before the second
 * reads and the test passes against an unguarded implementation.
 *
 * One type is enough — applyEdit is generic, and the table-driven suite in
 * submission-apply-edit.test.ts covers the rest of the rules per type.
 */

const mocks = vi.hoisted(() => ({
  actMidFlight: null as null | (() => Promise<void>),
}));

vi.mock("@/lib/submissions/auto-approve", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/submissions/auto-approve")>();
  return {
    ...original,
    resolveApprovalStatus: async (
      ...args: Parameters<typeof original.resolveApprovalStatus>
    ) => {
      const status = await original.resolveApprovalStatus(...args);
      if (mocks.actMidFlight) await mocks.actMidFlight();
      return status;
    },
  };
});

const { applyEdit, SubmissionEditError } = await import(
  "@/lib/submissions/apply-edit"
);

const stamp = Date.now();
const createdUserIds: number[] = [];
const createdIds: number[] = [];
let ownerId: number;

async function makeClassified(approvalStatus: string) {
  const [row] = await db
    .insert(classifieds)
    .values({
      userId: ownerId,
      title: "[TEST] apply-edit concurrency",
      description: "[TEST]",
      approvalStatus,
      isActive: true,
    })
    .returning({ id: classifieds.id });
  createdIds.push(row.id);
  return row.id;
}

beforeAll(async () => {
  const [u] = await db
    .insert(users)
    .values({
      email: `test-applyconc-${stamp}@frumtoronto.test`,
      firstName: "Test",
      lastName: "Owner",
      role: "member",
      isActive: true,
      emailVerified: new Date(),
    })
    .returning({ id: users.id });
  ownerId = u.id;
  createdUserIds.push(u.id);
});

afterAll(async () => {
  mocks.actMidFlight = null;
  if (createdIds.length) {
    await db.delete(classifieds).where(inArray(classifieds.id, createdIds));
  }
  if (createdUserIds.length) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
});

describe("applyEdit concurrency", () => {
  it("409s rather than overwriting an approval that landed mid-edit", async () => {
    const id = await makeClassified("pending");
    mocks.actMidFlight = async () => {
      await db
        .update(classifieds)
        .set({ approvalStatus: "approved" })
        .where(eq(classifieds.id, id));
    };

    try {
      await expect(
        applyEdit("classified", id, ownerId, { title: "[TEST] my edit wins?" })
      ).rejects.toMatchObject({ status: 409 });
    } finally {
      mocks.actMidFlight = null;
    }

    const [row] = await db
      .select()
      .from(classifieds)
      .where(eq(classifieds.id, id));
    // The admin's decision stands and the user's text did not land.
    expect(row.approvalStatus).toBe("approved");
    expect(row.title).toBe("[TEST] apply-edit concurrency");
  });

  it("saves normally when nothing else touches the row", async () => {
    // Positive control: an implementation that 409s on everything passes the
    // test above.
    const id = await makeClassified("pending");
    mocks.actMidFlight = null;

    const result = await applyEdit("classified", id, ownerId, {
      title: "[TEST] quiet edit",
    });

    expect(result.status).toBe("pending");
    const [row] = await db
      .select()
      .from(classifieds)
      .where(eq(classifieds.id, id));
    expect(row.title).toBe("[TEST] quiet edit");
  });

  it("raises SubmissionEditError so the route maps it to a status code", async () => {
    const id = await makeClassified("pending");
    mocks.actMidFlight = async () => {
      await db
        .update(classifieds)
        .set({ approvalStatus: "rejected" })
        .where(eq(classifieds.id, id));
    };

    try {
      await applyEdit("classified", id, ownerId, { title: "[TEST] racing" });
      throw new Error("expected a conflict");
    } catch (error) {
      expect(error).toBeInstanceOf(SubmissionEditError);
      expect((error as InstanceType<typeof SubmissionEditError>).status).toBe(409);
    } finally {
      mocks.actMidFlight = null;
    }
  });
});
