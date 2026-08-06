import { describe, it, expect } from "vitest";
import { wouldRemoveLastAdmin } from "@/lib/permissions/last-admin";

/**
 * PATCH /api/admin/users/[id] had nothing stopping the last active admin being
 * demoted or disabled. Production has exactly one, and there is no in-app
 * recovery — /admin, the middleware and ~101 admin API routes all gate on
 * `role === "admin"`, so the only way back is direct SQL.
 *
 * Tested here rather than through the route because the integration database is
 * a copy of production, which always contains a second admin, so the route can
 * never reach the state this guards.
 */

const lastAdmin = {
  targetIsAdmin: true,
  targetIsActive: true,
  otherActiveAdmins: 0,
};

describe("wouldRemoveLastAdmin", () => {
  it("blocks demoting the only active admin", () => {
    for (const nextRole of ["member", "business", "shul", "content_contributor"]) {
      expect(wouldRemoveLastAdmin({ ...lastAdmin, nextRole })).toBe(true);
    }
  });

  it("blocks disabling the only active admin", () => {
    // isActive === false is this project's ban flag, checked in both sign-in
    // paths — so disabling locks the account out exactly as thoroughly as
    // demoting it.
    expect(wouldRemoveLastAdmin({ ...lastAdmin, nextIsActive: false })).toBe(true);
  });

  it("allows a change that leaves them an active admin", () => {
    expect(wouldRemoveLastAdmin({ ...lastAdmin, nextRole: "admin" })).toBe(false);
    expect(wouldRemoveLastAdmin({ ...lastAdmin, nextIsActive: true })).toBe(false);
    // A permissions-only edit touches neither field.
    expect(wouldRemoveLastAdmin({ ...lastAdmin })).toBe(false);
  });

  it("releases as soon as another active admin exists", () => {
    // The guard is about the outcome. If it kept blocking once the outcome is
    // safe it would be a different kind of lockout.
    expect(
      wouldRemoveLastAdmin({ ...lastAdmin, otherActiveAdmins: 1, nextRole: "member" })
    ).toBe(false);
  });

  it("does not fire for a non-admin, or an already-disabled admin", () => {
    expect(
      wouldRemoveLastAdmin({
        targetIsAdmin: false,
        targetIsActive: true,
        otherActiveAdmins: 0,
        nextIsActive: false,
      })
    ).toBe(false);

    // Already locked out, so nothing is lost by the change.
    expect(
      wouldRemoveLastAdmin({
        targetIsAdmin: true,
        targetIsActive: false,
        otherActiveAdmins: 0,
        nextRole: "member",
      })
    ).toBe(false);
  });

  it("catches demotion and disabling in one request", () => {
    expect(
      wouldRemoveLastAdmin({ ...lastAdmin, nextRole: "member", nextIsActive: false })
    ).toBe(true);
  });
});
