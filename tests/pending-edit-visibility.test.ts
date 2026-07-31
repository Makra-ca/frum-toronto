import { describe, it, expect, afterAll, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  simchas,
  classifieds,
  kosherAlerts,
  alerts,
  shivaNotifications,
  tehillimList,
  events,
} from "@/lib/db/schema";
import { PENDING_STATUSES, isPending } from "@/lib/submissions/statuses";

/**
 * `pending_edit` has to be understood everywhere before anything writes it.
 *
 * Chunk 0 widened roughly 53 call sites and eight zod enums, verified only by
 * grep and tsc — and neither catches the two failures that matter: a leftover
 * `eq(x, "pending")` compiles, and an un-widened `z.enum` compiles. Both leave
 * a corrected item off the public site AND out of every admin queue, which is
 * worse than the problem this feature solves.
 *
 * Assertions are on ids this file created, never on counts — other files share
 * these tables.
 */

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "1", role: "admin" } })),
}));

// The simchas route calls revalidatePath, which throws outside a request
// context. No other test in this repo mocks next/cache, so there is no pattern
// to copy — this is it.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

const cleanup: Array<() => Promise<unknown>> = [];

type RouteCase = {
  name: string;
  make: (status: string) => Promise<number>;
  patch: (id: number, body: Record<string, unknown>) => Promise<Response>;
  read: (id: number) => Promise<string | null>;
};

function jsonRequest(url: string, body: Record<string, unknown>) {
  return new Request(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

const ids = {
  simcha: [] as number[],
  classified: [] as number[],
  kosherAlert: [] as number[],
  alert: [] as number[],
  shiva: [] as number[],
  tehillim: [] as number[],
  event: [] as number[],
};

const cases: RouteCase[] = [
  {
    name: "simchas",
    make: async (approvalStatus) => {
      const [r] = await db
        .insert(simchas)
        .values({
          familyName: "[TEST] pending-edit",
          announcement: "[TEST]",
          approvalStatus,
        })
        .returning({ id: simchas.id });
      ids.simcha.push(r.id);
      return r.id;
    },
    patch: async (id, body) => {
      const { PATCH } = await import("@/app/api/admin/simchas/[id]/route");
      return PATCH(jsonRequest(`http://localhost/api/admin/simchas/${id}`, body), {
        params: Promise.resolve({ id: String(id) }),
      });
    },
    read: async (id) => {
      const [r] = await db.select().from(simchas).where(eq(simchas.id, id));
      return r?.approvalStatus ?? null;
    },
  },
  {
    name: "classifieds",
    make: async (approvalStatus) => {
      const [r] = await db
        .insert(classifieds)
        .values({
          title: "[TEST] pending-edit",
          description: "[TEST]",
          approvalStatus,
        })
        .returning({ id: classifieds.id });
      ids.classified.push(r.id);
      return r.id;
    },
    patch: async (id, body) => {
      const { PATCH } = await import("@/app/api/admin/classifieds/[id]/route");
      return PATCH(
        jsonRequest(`http://localhost/api/admin/classifieds/${id}`, body),
        { params: Promise.resolve({ id: String(id) }) }
      );
    },
    read: async (id) => {
      const [r] = await db.select().from(classifieds).where(eq(classifieds.id, id));
      return r?.approvalStatus ?? null;
    },
  },
  {
    name: "kosher-alerts",
    make: async (approvalStatus) => {
      const [r] = await db
        .insert(kosherAlerts)
        .values({
          productName: "[TEST] pending-edit",
          description: "[TEST]",
          approvalStatus,
        })
        .returning({ id: kosherAlerts.id });
      ids.kosherAlert.push(r.id);
      return r.id;
    },
    patch: async (id, body) => {
      const { PATCH } = await import("@/app/api/admin/kosher-alerts/[id]/route");
      return PATCH(
        jsonRequest(`http://localhost/api/admin/kosher-alerts/${id}`, body),
        { params: Promise.resolve({ id: String(id) }) }
      );
    },
    read: async (id) => {
      const [r] = await db.select().from(kosherAlerts).where(eq(kosherAlerts.id, id));
      return r?.approvalStatus ?? null;
    },
  },
  {
    name: "alerts",
    make: async (approvalStatus) => {
      const [r] = await db
        .insert(alerts)
        .values({
          title: "[TEST] pending-edit",
          content: "[TEST]",
          alertType: "general",
          approvalStatus,
        })
        .returning({ id: alerts.id });
      ids.alert.push(r.id);
      return r.id;
    },
    patch: async (id, body) => {
      const { PATCH } = await import("@/app/api/admin/alerts/[id]/route");
      return PATCH(jsonRequest(`http://localhost/api/admin/alerts/${id}`, body), {
        params: Promise.resolve({ id: String(id) }),
      });
    },
    read: async (id) => {
      const [r] = await db.select().from(alerts).where(eq(alerts.id, id));
      return r?.approvalStatus ?? null;
    },
  },
  {
    name: "shiva",
    make: async (approvalStatus) => {
      const [r] = await db
        .insert(shivaNotifications)
        .values({
          niftarName: "[TEST] pending-edit",
          mournerNames: ["[TEST]"],
          shivaStart: "2027-01-01",
          shivaEnd: "2027-01-08",
          approvalStatus,
        })
        .returning({ id: shivaNotifications.id });
      ids.shiva.push(r.id);
      return r.id;
    },
    patch: async (id, body) => {
      const { PATCH } = await import("@/app/api/admin/shiva/[id]/route");
      return PATCH(jsonRequest(`http://localhost/api/admin/shiva/${id}`, body), {
        params: Promise.resolve({ id: String(id) }),
      });
    },
    read: async (id) => {
      const [r] = await db
        .select()
        .from(shivaNotifications)
        .where(eq(shivaNotifications.id, id));
      return r?.approvalStatus ?? null;
    },
  },
  {
    name: "tehillim",
    make: async (approvalStatus) => {
      const [r] = await db
        .insert(tehillimList)
        .values({
          hebrewName: "[TEST] pending-edit",
          approvalStatus,
        })
        .returning({ id: tehillimList.id });
      ids.tehillim.push(r.id);
      return r.id;
    },
    patch: async (id, body) => {
      const { PATCH } = await import("@/app/api/admin/tehillim/[id]/route");
      return PATCH(
        jsonRequest(`http://localhost/api/admin/tehillim/${id}`, body),
        { params: Promise.resolve({ id: String(id) }) }
      );
    },
    read: async (id) => {
      const [r] = await db.select().from(tehillimList).where(eq(tehillimList.id, id));
      return r?.approvalStatus ?? null;
    },
  },
];

afterAll(async () => {
  for (const fn of cleanup) await fn();
  if (ids.simcha.length) await db.delete(simchas).where(inArray(simchas.id, ids.simcha));
  if (ids.classified.length)
    await db.delete(classifieds).where(inArray(classifieds.id, ids.classified));
  if (ids.kosherAlert.length)
    await db.delete(kosherAlerts).where(inArray(kosherAlerts.id, ids.kosherAlert));
  if (ids.alert.length) await db.delete(alerts).where(inArray(alerts.id, ids.alert));
  if (ids.shiva.length)
    await db.delete(shivaNotifications).where(inArray(shivaNotifications.id, ids.shiva));
  if (ids.tehillim.length)
    await db.delete(tehillimList).where(inArray(tehillimList.id, ids.tehillim));
  if (ids.event.length) await db.delete(events).where(inArray(events.id, ids.event));
});

describe("every admin route accepts a corrected item", () => {
  it.each(cases.map((c) => [c.name, c] as const))(
    "%s can be moved to pending_edit and then approved",
    async (_name, route) => {
      const id = await route.make("approved");

      // An un-widened z.enum returns 400 here and zod strips the key silently,
      // so without the status assertion the route looks like it worked.
      const toEdit = await route.patch(id, { approvalStatus: "pending_edit" });
      expect(toEdit.status).toBe(200);
      expect(await route.read(id)).toBe("pending_edit");

      const toApproved = await route.patch(id, { approvalStatus: "approved" });
      expect(toApproved.status).toBe(200);
      expect(await route.read(id)).toBe("approved");
    }
  );

  it.each(cases.map((c) => [c.name, c] as const))(
    "%s still refuses a status the system does not use",
    async (_name, route) => {
      const id = await route.make("pending");

      const res = await route.patch(id, { approvalStatus: "banana" });

      expect(res.status).toBe(400);
      expect(await route.read(id)).toBe("pending");
    }
  );
});

describe("a corrected item stays visible to admins", () => {
  it("is returned by a queue query written with PENDING_STATUSES", async () => {
    const editedId = await cases[0].make("pending_edit");
    const newId = await cases[0].make("pending");
    const liveId = await cases[0].make("approved");

    const queue = await db
      .select({ id: simchas.id })
      .from(simchas)
      .where(
        and(
          inArray(simchas.approvalStatus, [...PENDING_STATUSES]),
          inArray(simchas.id, [editedId, newId, liveId])
        )
      );

    const found = queue.map((r) => r.id).sort();
    expect(found).toEqual([editedId, newId].sort());
  });

  it("counts as awaiting review", () => {
    expect(isPending("pending_edit")).toBe(true);
  });
});
