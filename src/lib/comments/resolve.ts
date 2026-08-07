import { db } from "@/lib/db";
import { users, siteSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  decideComment,
  parseModeration,
  COMMENT_SURFACES,
  type CommentSurface,
  type CommentOutcome,
} from "@/lib/comments/moderation";

/**
 * Reads everything `decideComment` needs and returns its verdict.
 *
 * Four call sites need this now — post and edit, on each of the two surfaces —
 * and an edit that resolved moderation differently from a create would be a
 * hole rather than an inconsistency: post something innocuous, wait for
 * approval, edit it into whatever you wanted to say. Keeping the reads and the
 * decision together means the two paths cannot diverge.
 */
export async function resolveCommentOutcome({
  userId,
  isAdmin,
  surface,
  itemModeration,
  canSkipModeration = false,
}: {
  userId: number;
  isAdmin: boolean;
  surface: CommentSurface;
  /** The per-item override, where the surface has one. */
  itemModeration?: string | null;
  /** Ask the Rabbi's `canAutoApproveAskTheRabbi`. */
  canSkipModeration?: boolean;
}): Promise<CommentOutcome> {
  const [dbUser] = await db
    .select({ commentPermission: users.commentPermission })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // Only consulted when there is no per-item override, so a post that has
  // already decided for itself costs no extra query.
  let siteModeration = parseModeration(null);
  if (!itemModeration) {
    const [setting] = await db
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, COMMENT_SURFACES[surface].key))
      .limit(1);
    siteModeration = parseModeration(setting?.value);
  }

  return decideComment({
    isAdmin,
    canSkipModeration,
    commentPermission: dbUser?.commentPermission,
    itemModeration,
    siteModeration,
  });
}
