/**
 * The three permission toggles that used to do nothing.
 *
 * `canAutoApproveBusinesses`, `canAutoApproveAskTheRabbi` and
 * `canAutoApproveShuls` were saved by the admin permissions dialog and read by
 * no code anywhere — ticking one gave a success toast and changed nothing.
 *
 * Each attaches here to the one real approval step in its area. They are pure
 * functions on purpose: the decision is the part worth testing, and keeping it
 * out of the route handlers means a test does not need a request, a session or
 * a database.
 *
 * Note "auto-approve" means something different in each area, because the areas
 * differ — see the individual functions. Ask the Rabbi *questions* have no
 * approval step at all (they are answered, not approved), so the flag governs
 * comment moderation instead.
 */

import { decideComment } from "@/lib/comments/moderation";

export type BusinessApprovalInput = {
  /** Waiting on PayPal. Nothing is paid for yet, so nothing may go live. */
  pendingPayment: boolean;
  /**
   * The requested plan's monthly price, as stored (a decimal string).
   *
   * SECURITY: `subscriptionPlanId` is client-supplied on business creation and
   * nothing used to compare it against a price, so POSTing Elite with
   * `pendingPayment` omitted landed a $120/mo listing in the ordinary review
   * queue — with no signal to the approving admin that it was never paid for.
   *
   * Anything that is not a parseable zero is treated as paid. Fail closed: an
   * unknown price must not grant a free pass.
   */
  planPriceMonthly?: string | null;
  /** Legacy flag, still the live path for business creation. */
  isTrusted: boolean | null | undefined;
  canAutoApproveBusinesses: boolean | null | undefined;
};

/**
 * pending_payment > approved > pending.
 *
 * pendingPayment wins over both flags: a listing awaiting payment is not
 * visible anywhere, and a permission to skip *review* must not be read as a
 * permission to skip *paying*.
 */
export function resolveBusinessApprovalStatus({
  pendingPayment,
  isTrusted,
  canAutoApproveBusinesses,
  planPriceMonthly,
}: BusinessApprovalInput): "pending_payment" | "approved" | "pending" {
  if (pendingPayment) return "pending_payment";

  // A paid plan always awaits payment, whatever the caller claimed and
  // whatever permissions they hold. Permission to skip REVIEW is not
  // permission to skip PAYING.
  const price = Number.parseFloat(planPriceMonthly ?? "");
  const isFree = Number.isFinite(price) && price === 0;
  if (!isFree) return "pending_payment";

  if (canAutoApproveBusinesses || isTrusted) return "approved";
  return "pending";
}

export type CommentApprovalInput = {
  /** Admin or canManageAskTheRabbi — already bypassed moderation. */
  isManager: boolean;
  /** users.commentPermission: "allowed" | "moderated" | "requires_approval". */
  commentPermission: string | null | undefined;
  canAutoApproveAskTheRabbi: boolean | null | undefined;
};

/**
 * Ask the Rabbi questions are answered, not approved, so there is no approval
 * step there for a flag to skip. The one real approval step in Ask the Rabbi is
 * comment moderation, which is what this governs: a holder's comments go live
 * even if their account is set to moderated.
 *
 * Delegates to `decideComment`, which is now the single implementation shared
 * with the blog. Kept as a named wrapper because this file is where the
 * "is this permission toggle actually wired to anything" question is answered,
 * and `tests/dead-permission-toggles.test.ts` asks it here.
 *
 * It omits the site-wide setting on purpose: callers that need the full
 * decision (including a block) should use `decideComment` directly. This one
 * answers only "does this person's account force review".
 */
export function resolveCommentApprovalStatus({
  isManager,
  commentPermission,
  canAutoApproveAskTheRabbi,
}: CommentApprovalInput): "approved" | "pending" {
  const outcome = decideComment({
    isAdmin: isManager,
    canSkipModeration: canAutoApproveAskTheRabbi === true,
    commentPermission,
    siteModeration: "open",
  });
  // A block cannot reach here: callers check it separately and return 403.
  return outcome === "hold" ? "pending" : "approved";
}

export type ShulRequestInput = {
  canAutoApproveShuls: boolean | null | undefined;
};

/**
 * Grants a request to MANAGE a shul without admin review.
 *
 * Worth being clear about what this hands over: not the ability to submit
 * something for approval, but control of a shul's public listing — name,
 * address, rabbi, davening times, documents — all of which go live without
 * review once assigned. That is why it is a per-user permission and not a
 * default, and why nobody holds it today.
 */
export function shouldAutoGrantShulRequest({
  canAutoApproveShuls,
}: ShulRequestInput): boolean {
  return canAutoApproveShuls === true;
}
