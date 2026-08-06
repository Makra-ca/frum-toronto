/**
 * "Would this change leave nobody able to administer the site?"
 *
 * Production has exactly ONE active admin account. `/admin`, the middleware and
 * ~101 admin API routes all gate on `role === "admin"`, and there is no in-app
 * recovery path — demote or disable that account and the only way back is
 * direct SQL against the production database.
 *
 * Kept as a pure function for the same reason as `auto-approve-targets.ts`: the
 * decision is the part worth testing, and it cannot be tested through the route
 * because the integration database is a copy of production and therefore always
 * contains a second admin.
 *
 * Framed as an OUTCOME, not as "is this me". An admin demoting a *different*
 * last admin locks everyone out just as thoroughly, and blocking only
 * self-demotion would miss it.
 */

export type LastAdminInput = {
  /** The target account as it stands right now. */
  targetIsAdmin: boolean;
  targetIsActive: boolean;
  /** Active admins OTHER than the target. */
  otherActiveAdmins: number;
  /** Undefined when the request does not touch the field. */
  nextRole?: string;
  nextIsActive?: boolean;
};

export function wouldRemoveLastAdmin({
  targetIsAdmin,
  targetIsActive,
  otherActiveAdmins,
  nextRole,
  nextIsActive,
}: LastAdminInput): boolean {
  // Nothing to lose: the target is not currently an admin who can log in.
  if (!targetIsAdmin || !targetIsActive) return false;

  // Someone else can still get in.
  if (otherActiveAdmins > 0) return false;

  const losesAdmin = nextRole !== undefined && nextRole !== "admin";
  const losesAccess = nextIsActive === false;

  return losesAdmin || losesAccess;
}
