/**
 * Approval statuses, in one place.
 *
 * `pending_edit` marks a correction to an item that was already approved. It
 * exists for one reason: approving does not merely flip a status, it can
 * broadcast to every subscriber. Without a way to distinguish a correction
 * from a new submission, re-approving a fixed typo re-emails the community —
 * for a shiva notice, that means re-sending a bereavement announcement because
 * someone corrected a street address.
 *
 * Two rules follow, and they pull in opposite directions:
 *
 *   - Anything asking "does an admin still need to look at this?" must treat
 *     BOTH values as awaiting review. Use `isPending` / `PENDING_STATUSES`.
 *     Miss one and an edited item disappears from every queue while also being
 *     off the public site — worse than the problem this feature solves.
 *
 *   - Anything asking "was this newly submitted?" — every broadcast guard —
 *     must keep comparing against the literal `"pending"`. Widening those is
 *     how the mass-email bug comes back, silently, with all tests green.
 */

export const PENDING_STATUSES = ["pending", "pending_edit"] as const;

/**
 * Every status, in the tuple shape `z.enum()` needs.
 *
 * Admin request schemas must build their enum from this rather than writing
 * the list out again — an admin route whose enum omits `pending_edit` rejects
 * any attempt to approve a corrected item with a 400, and zod strips unknown
 * keys silently, so the field simply vanishes instead of erroring.
 */
export const APPROVAL_STATUSES = [
  "pending",
  "pending_edit",
  "approved",
  "rejected",
] as const;

export type PendingStatus = (typeof PENDING_STATUSES)[number];
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

/**
 * Is this item still awaiting an admin decision?
 *
 * Accepts a loose string because `approval_status` is a nullable varchar on
 * several tables rather than a database enum.
 */
export function isPending(status: string | null | undefined): boolean {
  return (PENDING_STATUSES as readonly string[]).includes(status ?? "");
}
