import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import {
  users,
  classifieds,
  simchas,
  kosherAlerts,
  alerts,
  tehillimList,
  shivaNotifications,
} from "@/lib/db/schema";
import { applyEdit, SubmissionEditError } from "@/lib/submissions/apply-edit";
import { EDITABLE_FIELDS } from "@/lib/submissions/editable-fields";
import { SUBMISSION_TYPES, type SubmissionType } from "@/lib/submissions/types";

/**
 * The same rules, proven for every type rather than for whichever one the
 * author remembered. Each case below is driven from a table, so a type added
 * to the fixtures is a type that gets the whole set.
 */

const stamp = Date.now();
const createdUserIds: number[] = [];
const createdIds: Record<string, number[]> = {};

let ownerId: number;
let strangerId: number;
let trustedIds: Partial<Record<SubmissionType, number>> = {};

interface Fixture {
  type: SubmissionType;
  table: PgTable & Record<string, PgColumn>;
  /** A minimal valid row, minus userId and approvalStatus. */
  base: Record<string, unknown>;
  /** A field the submitter is allowed to change, and a value to change it to. */
  editField: string;
  editValue: unknown;
}

const fixtures: Fixture[] = [
  {
    type: "classified",
    table: classifieds as never,
    base: { title: "[TEST] classified", description: "[TEST]" },
    editField: "title",
    editValue: "[TEST] classified edited",
  },
  {
    type: "simcha",
    table: simchas as never,
    base: { familyName: "[TEST] Family", announcement: "[TEST]" },
    editField: "familyName",
    editValue: "[TEST] Family edited",
  },
  {
    type: "kosherAlert",
    table: kosherAlerts as never,
    base: { productName: "[TEST] product", description: "[TEST]" },
    editField: "productName",
    editValue: "[TEST] product edited",
  },
  {
    type: "alert",
    table: alerts as never,
    base: { title: "[TEST] alert", content: "[TEST]", alertType: "general" },
    editField: "title",
    editValue: "[TEST] alert edited",
  },
  {
    type: "tehillim",
    table: tehillimList as never,
    base: { hebrewName: "[TEST] name" },
    editField: "reason",
    editValue: "[TEST] refuah",
  },
  {
    type: "shiva",
    table: shivaNotifications as never,
    base: {
      niftarName: "[TEST] niftar",
      mournerNames: ["[TEST]"],
      shivaStart: "2099-01-01",
      shivaEnd: "2099-01-08",
    },
    editField: "shivaHours",
    editValue: "[TEST] 2pm-9pm",
  },
];

async function makeRow(
  fixture: Fixture,
  approvalStatus: string,
  userId: number | null = ownerId
) {
  const [row] = (await db
    .insert(fixture.table)
    .values({ ...fixture.base, userId, approvalStatus } as never)
    .returning({ id: fixture.table.id })) as { id: number }[];
  (createdIds[fixture.type] ??= []).push(row.id);
  return row.id;
}

async function readRow(fixture: Fixture, id: number) {
  const [row] = (await db
    .select()
    .from(fixture.table)
    .where(eq(fixture.table.id, id))) as unknown as Record<string, unknown>[];
  return row;
}

async function makeUser(email: string, extra: Record<string, unknown> = {}) {
  const [u] = await db
    .insert(users)
    .values({
      email,
      firstName: "Test",
      lastName: "User",
      role: "member",
      isActive: true,
      emailVerified: new Date(),
      ...extra,
    } as never)
    .returning({ id: users.id });
  createdUserIds.push(u.id);
  return u.id;
}

beforeAll(async () => {
  ownerId = await makeUser(`test-edit-owner-${stamp}@frumtoronto.test`);
  strangerId = await makeUser(`test-edit-stranger-${stamp}@frumtoronto.test`);

  // One auto-approver per type, each holding ONLY that type's flag — so a test
  // cannot pass because some other flag happened to be set.
  const entries = await Promise.all(
    fixtures.map(async (f) => {
      const field = SUBMISSION_TYPES[f.type].autoApproveField;
      const id = await makeUser(
        `test-edit-trusted-${f.type}-${stamp}@frumtoronto.test`,
        { [field]: true }
      );
      return [f.type, id] as const;
    })
  );
  trustedIds = Object.fromEntries(entries) as Partial<Record<SubmissionType, number>>;
});

afterAll(async () => {
  for (const fixture of fixtures) {
    const ids = createdIds[fixture.type];
    if (ids?.length) {
      await db.delete(fixture.table).where(inArray(fixture.table.id, ids));
    }
  }
  if (createdUserIds.length) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
});

describe.each(fixtures.map((f) => [f.type, f] as const))(
  "applyEdit: %s",
  (_name, fixture) => {
    it("lets the owner change their own pending item", async () => {
      const id = await makeRow(fixture, "pending");

      const result = await applyEdit(fixture.type, id, ownerId, {
        [fixture.editField]: fixture.editValue,
      });

      expect(result.status).toBe("pending");
      const row = await readRow(fixture, id);
      expect(row[fixture.editField]).toBe(fixture.editValue);
    });

    it("unpublishes a live item as pending_edit, not pending", async () => {
      const id = await makeRow(fixture, "approved");

      const result = await applyEdit(fixture.type, id, ownerId, {
        [fixture.editField]: fixture.editValue,
      });

      // `pending` would make the admin's re-approval look like a first
      // approval to every broadcast guard.
      expect(result.status).toBe("pending_edit");
      expect(result.wasUnpublished).toBe(true);
    });

    it("keeps pending_edit on a second edit before review", async () => {
      const id = await makeRow(fixture, "approved");
      await applyEdit(fixture.type, id, ownerId, { [fixture.editField]: fixture.editValue });

      const second = await applyEdit(fixture.type, id, ownerId, {
        [fixture.editField]: fixture.editValue,
      });

      expect(second.status).toBe("pending_edit");
    });

    it("leaves an auto-approver's live item live", async () => {
      const trustedId = trustedIds[fixture.type]!;
      const id = await makeRow(fixture, "approved", trustedId);

      const result = await applyEdit(
        fixture.type,
        id,
        trustedId,
        { [fixture.editField]: fixture.editValue },
        "member"
      );

      expect(result.status).toBe("approved");
      expect(result.wasUnpublished).toBe(false);
    });

    it("does not let an auto-approver republish rejected content", async () => {
      const trustedId = trustedIds[fixture.type]!;
      const id = await makeRow(fixture, "rejected", trustedId);

      const result = await applyEdit(
        fixture.type,
        id,
        trustedId,
        { [fixture.editField]: fixture.editValue },
        "member"
      );

      expect(result.status).toBe("pending");
    });

    it("refuses a stranger", async () => {
      const id = await makeRow(fixture, "pending");

      await expect(
        applyEdit(fixture.type, id, strangerId, {
          [fixture.editField]: fixture.editValue,
        })
      ).rejects.toThrow(SubmissionEditError);

      const row = await readRow(fixture, id);
      expect(row[fixture.editField]).not.toBe(fixture.editValue);
    });

    it("refuses everyone on an unowned legacy row", async () => {
      const id = await makeRow(fixture, "approved", null);

      await expect(
        applyEdit(fixture.type, id, ownerId, {
          [fixture.editField]: fixture.editValue,
        })
      ).rejects.toThrow(SubmissionEditError);
    });

    it("ignores fields outside the whitelist", async () => {
      const id = await makeRow(fixture, "pending");

      await applyEdit(fixture.type, id, ownerId, {
        [fixture.editField]: fixture.editValue,
        // A hostile client trying to take ownership, self-approve, and dodge
        // the once-only broadcast guard in one request.
        userId: strangerId,
        authorId: strangerId,
        approvalStatus: "approved",
        broadcastAt: new Date(),
        rejectionReason: "smuggled",
      });

      const row = await readRow(fixture, id);
      expect(row[SUBMISSION_TYPES[fixture.type].ownerColumn]).toBe(ownerId);
      expect(row.approvalStatus).toBe("pending");
      expect(row.broadcastAt).toBeNull();
      expect(row.rejectionReason).toBeNull();
    });

    it("rejects an edit with nothing editable in it", async () => {
      const id = await makeRow(fixture, "pending");

      await expect(
        applyEdit(fixture.type, id, ownerId, { notAField: "x" })
      ).rejects.toMatchObject({ status: 400 });
    });
  }
);

describe("EDITABLE_FIELDS", () => {
  it("never exposes a field that would let a submitter escalate", async () => {
    const forbidden = [
      "id",
      "userId",
      "authorId",
      "approvalStatus",
      "broadcastAt",
      "rejectionReason",
      "isActive",
      "createdAt",
      "updatedAt",
      "oldId",
      "viewCount",
    ];

    for (const [type, fields] of Object.entries(EDITABLE_FIELDS)) {
      for (const field of forbidden) {
        expect(fields, `${type} exposes ${field}`).not.toContain(field);
      }
    }
  });

  it("only names columns that exist on the type's table", async () => {
    // A typo here silently drops the field: the whitelist loop skips it and
    // the user's change never saves, with no error anywhere.
    const { getTableColumns } = await import("drizzle-orm");
    for (const [type, fields] of Object.entries(EDITABLE_FIELDS)) {
      const columns = getTableColumns(SUBMISSION_TYPES[type as SubmissionType].table);
      for (const field of fields) {
        expect(columns[field], `${type}.${field} does not exist`).toBeDefined();
      }
    }
  });

  it("covers every type", () => {
    expect(Object.keys(EDITABLE_FIELDS).sort()).toEqual(
      Object.keys(SUBMISSION_TYPES).sort()
    );
  });
});
