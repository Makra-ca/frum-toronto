import { describe, it, expect } from "vitest";
import {
  PENDING_STATUSES,
  isPending,
  type ApprovalStatus,
} from "@/lib/submissions/statuses";

// `pending_edit` marks a correction to an already-approved item. It exists so
// the broadcast guards can tell a correction apart from a new submission —
// re-approving a correction must not re-email the whole subscriber list.
//
// Everything that asks "does an admin still need to look at this?" must treat
// both values as awaiting review, or an edited item vanishes from every queue.

describe("isPending", () => {
  it("treats both pending and pending_edit as awaiting review", () => {
    expect(isPending("pending")).toBe(true);
    expect(isPending("pending_edit")).toBe(true);
  });

  it("does not treat a settled status as awaiting review", () => {
    expect(isPending("approved")).toBe(false);
    expect(isPending("rejected")).toBe(false);
  });

  it("handles a null or empty status — the column is nullable on several tables", () => {
    expect(isPending(null)).toBe(false);
    expect(isPending(undefined)).toBe(false);
    expect(isPending("")).toBe(false);
  });

  it("is case sensitive, deliberately — stored values are always lowercase", () => {
    expect(isPending("PENDING")).toBe(false);
    expect(isPending("Pending_Edit")).toBe(false);
  });
});

describe("PENDING_STATUSES", () => {
  it("contains exactly the two reviewable statuses, for use in SQL inArray()", () => {
    expect([...PENDING_STATUSES].sort()).toEqual(["pending", "pending_edit"]);
  });

  it("every member is itself pending — the constant and the predicate cannot drift", () => {
    for (const status of PENDING_STATUSES) {
      expect(isPending(status), status).toBe(true);
    }
  });

  it("fits the varchar(20) approval_status column", () => {
    for (const status of PENDING_STATUSES) {
      expect(status.length, status).toBeLessThanOrEqual(20);
    }
  });
});

describe("ApprovalStatus", () => {
  it("covers every status the system can store", () => {
    const all: ApprovalStatus[] = [
      "pending",
      "pending_edit",
      "approved",
      "rejected",
    ];
    expect(all).toHaveLength(4);
  });
});
