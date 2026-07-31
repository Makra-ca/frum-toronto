import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
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

/**
 * The six per-type edit routes, exercised as routes.
 *
 * The gates that only exist at this layer are the point: 401 for a signed-out
 * caller, and assertCanPost for an unverified or blocked one. Neither is
 * reachable from applyEdit's tests.
 *
 * Every case asserts the STATUS CODE, not just an absence of change. A route
 * that 401s early satisfies "nothing happened" for entirely the wrong reason,
 * which is how a broken implementation passes a whole file.
 */

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string; email: string; name: string } },
}));

vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn(async () => mocks.session) }));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("@/lib/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/notifications")>()),
  notifyAdminOfSubmission: vi.fn(async () => undefined),
  notifyAdminOfTrustedEdit: vi.fn(async () => undefined),
}));

const stamp = Date.now();
const createdUserIds: number[] = [];
const createdIds: Record<string, number[]> = {};

let ownerId: number;
let unverifiedId: number;
let blockedId: number;

interface Case {
  name: string;
  folder: string;
  table: PgTable & Record<string, PgColumn>;
  base: Record<string, unknown>;
  editBody: Record<string, unknown>;
  editField: string;
}

const cases: Case[] = [
  {
    name: "classifieds",
    folder: "classifieds",
    table: classifieds as never,
    base: { title: "[TEST] c", description: "[TEST]" },
    editBody: { title: "[TEST] c edited" },
    editField: "title",
  },
  {
    name: "simchas",
    folder: "simchas",
    table: simchas as never,
    base: { familyName: "[TEST] s", announcement: "[TEST] announcement text" },
    editBody: { familyName: "[TEST] s edited" },
    editField: "familyName",
  },
  {
    name: "kosher-alerts",
    folder: "kosher-alerts",
    table: kosherAlerts as never,
    base: { productName: "[TEST] k", description: "[TEST]" },
    editBody: { productName: "[TEST] k edited" },
    editField: "productName",
  },
  {
    name: "alerts",
    folder: "alerts",
    table: alerts as never,
    base: { title: "[TEST] a", content: "[TEST]", alertType: "general" },
    editBody: { title: "[TEST] a edited" },
    editField: "title",
  },
  {
    name: "tehillim",
    folder: "tehillim",
    table: tehillimList as never,
    base: { hebrewName: "[TEST] t" },
    editBody: { reason: "[TEST] refuah" },
    editField: "reason",
  },
  {
    name: "shiva",
    folder: "shiva",
    table: shivaNotifications as never,
    base: {
      niftarName: "[TEST] sh",
      mournerNames: ["[TEST]"],
      shivaStart: "2099-01-01",
      shivaEnd: "2099-01-08",
    },
    editBody: { shivaHours: "[TEST] 2pm-9pm" },
    editField: "shivaHours",
  },
];

/**
 * A static map, not a template-literal import.
 *
 * `import(`@/app/api/community/${folder}/[id]/route`)` cannot be statically
 * analysed, so Vite warns and falls back to runtime resolution — which failed
 * once in four full runs with "Cannot find package 'next/server'", taking all
 * 54 tests in this file with it. A file that fails one run in four teaches
 * people to re-run rather than to read.
 */
const ROUTES = {
  classifieds: () => import("@/app/api/community/classifieds/[id]/route"),
  simchas: () => import("@/app/api/community/simchas/[id]/route"),
  "kosher-alerts": () => import("@/app/api/community/kosher-alerts/[id]/route"),
  alerts: () => import("@/app/api/community/alerts/[id]/route"),
  tehillim: () => import("@/app/api/community/tehillim/[id]/route"),
  shiva: () => import("@/app/api/community/shiva/[id]/route"),
} as const;

async function loadRoute(folder: string) {
  return ROUTES[folder as keyof typeof ROUTES]();
}

async function makeRow(c: Case, userId: number | null, approvalStatus = "pending") {
  const [row] = (await db
    .insert(c.table)
    .values({ ...c.base, userId, approvalStatus } as never)
    .returning({ id: c.table.id })) as { id: number }[];
  (createdIds[c.name] ??= []).push(row.id);
  return row.id;
}

async function patch(c: Case, id: number, body: Record<string, unknown>) {
  const { PATCH } = await loadRoute(c.folder);
  return PATCH(
    new Request(`http://localhost/api/community/${c.folder}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
    { params: Promise.resolve({ id: String(id) }) }
  ) as Promise<Response>;
}

function signIn(id: number) {
  mocks.session = {
    user: { id: String(id), role: "member", email: "x@frumtoronto.test", name: "Tester" },
  };
}

beforeAll(async () => {
  const rows = await db
    .insert(users)
    .values([
      {
        email: `test-route-owner-${stamp}@frumtoronto.test`,
        firstName: "Test",
        lastName: "Owner",
        role: "member",
        isActive: true,
        emailVerified: new Date(),
      },
      {
        email: `test-route-unverified-${stamp}@frumtoronto.test`,
        firstName: "Test",
        lastName: "Unverified",
        role: "member",
        isActive: true,
        emailVerified: null,
      },
      {
        email: `test-route-blocked-${stamp}@frumtoronto.test`,
        firstName: "Test",
        lastName: "Blocked",
        role: "member",
        // is_active = false is this project's ban flag.
        isActive: false,
        emailVerified: new Date(),
      },
    ])
    .returning({ id: users.id });
  [ownerId, unverifiedId, blockedId] = rows.map((r) => r.id);
  createdUserIds.push(...rows.map((r) => r.id));
});

afterAll(async () => {
  for (const c of cases) {
    const ids = createdIds[c.name];
    if (ids?.length) await db.delete(c.table).where(inArray(c.table.id, ids));
  }
  if (createdUserIds.length) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
});

describe.each(cases.map((c) => [c.name, c] as const))(
  "PATCH /api/community/%s/[id]",
  (_name, c) => {
    it("saves the owner's change", async () => {
      signIn(ownerId);
      const id = await makeRow(c, ownerId);

      const res = await patch(c, id, c.editBody);

      // The status assertion is what proves auth and validation let us
      // through, rather than the route bailing before it did anything.
      expect(res.status).toBe(200);
      const [row] = (await db
        .select()
        .from(c.table)
        .where(eq(c.table.id, id))) as unknown as Record<string, unknown>[];
      expect(row[c.editField]).toBe(c.editBody[c.editField]);
    });

    it("unpublishes a live item as pending_edit", async () => {
      signIn(ownerId);
      const id = await makeRow(c, ownerId, "approved");

      const res = await patch(c, id, c.editBody);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.status).toBe("pending_edit");
      expect(body.message).toContain("removed from the site");
    });

    it("refuses a signed-out caller", async () => {
      const id = await makeRow(c, ownerId);
      mocks.session = null;

      const res = await patch(c, id, c.editBody);

      expect(res.status).toBe(401);
    });

    it("refuses an unverified account", async () => {
      // The same gate as creating. Without it, editing is a way to publish
      // from an address nobody confirmed.
      signIn(unverifiedId);
      const id = await makeRow(c, unverifiedId);

      const res = await patch(c, id, c.editBody);

      expect(res.status).toBe(403);
      // Both gates return 403 with different bodies, and the UI switches on
      // this code to offer "resend verification". Without it, swapping the two
      // branches passes.
      expect((await res.json()).code).toBe("email_unverified");
    });

    it("refuses a blocked account", async () => {
      signIn(blockedId);
      const id = await makeRow(c, blockedId);

      const res = await patch(c, id, c.editBody);

      expect(res.status).toBe(403);
    });

    it("refuses a stranger with 403, not 404", async () => {
      signIn(ownerId);
      const id = await makeRow(c, null);

      const res = await patch(c, id, c.editBody);

      expect(res.status).toBe(403);
    });

    it("rejects a body that does not validate", async () => {
      signIn(ownerId);
      const id = await makeRow(c, ownerId);

      const res = await patch(c, id, { ...c.editBody, [c.editField]: 12345 });

      expect(res.status).toBe(400);
    });

    it("serves the owner their own row for the form", async () => {
      signIn(ownerId);
      const id = await makeRow(c, ownerId);
      const { GET } = await loadRoute(c.folder);

      const res = (await GET(new Request("http://localhost") as never, {
        params: Promise.resolve({ id: String(id) }),
      })) as Response;

      expect(res.status).toBe(200);
      expect((await res.json()).id).toBe(id);
    });

    it("does not serve someone else's row", async () => {
      signIn(ownerId);
      const id = await makeRow(c, null);
      const { GET } = await loadRoute(c.folder);

      const res = (await GET(new Request("http://localhost") as never, {
        params: Promise.resolve({ id: String(id) }),
      })) as Response;

      expect(res.status).toBe(403);
    });
  }
);
