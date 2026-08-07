/**
 * Who may comment, and whether that comment goes live.
 *
 * The site has two comment surfaces — blog posts and Ask the Rabbi questions —
 * and they had drifted badly apart:
 *
 *   - Ask the Rabbi honoured `users.commentPermission`; the blog ignored it, so
 *     an account set to "Blocked" could comment there freely.
 *   - The blog had a site-wide policy setting (which nothing could write);
 *     Ask the Rabbi had no policy layer at all.
 *
 * Three inputs now feed one decision on both surfaces:
 *
 *   1. The PERSON — `users.commentPermission`, set in Admin → Users.
 *   2. A BYPASS — admin, or a per-surface capability (Ask the Rabbi's
 *      `canManageAskTheRabbi` / `canAutoApproveAskTheRabbi`).
 *   3. The POLICY — an optional per-item override, falling back to the
 *      surface's site-wide setting.
 *
 * Each surface keeps its OWN site-wide setting rather than sharing one. They
 * are different kinds of content — a community blog and Torah Q&A — and an
 * admin should be able to supervise one without the other.
 */

/** The `site_settings.key` for each surface's site-wide default. */
export const COMMENT_SURFACES = {
  blog: {
    key: "blog_comment_moderation",
    label: "Blog comments",
    /** Blog posts carry their own `commentModeration` override. */
    hasPerItemOverride: true,
    description:
      "Default moderation for blog comments when a post has no override",
  },
  askTheRabbi: {
    key: "atr_comment_moderation",
    label: "Ask the Rabbi comments",
    hasPerItemOverride: false,
    description: "Default moderation for comments on Ask the Rabbi questions",
  },
} as const;

export type CommentSurface = keyof typeof COMMENT_SURFACES;

/** Every surface key, for iterating the settings screen and validating input. */
export const COMMENT_SURFACE_KEYS = Object.keys(
  COMMENT_SURFACES
) as CommentSurface[];

/**
 * Back-compat alias. The blog key predates the second surface and is the one
 * the comment route has read since the blog shipped.
 */
export const BLOG_COMMENT_MODERATION_KEY = COMMENT_SURFACES.blog.key;

export const MODERATION_VALUES = ["open", "approved"] as const;
export type CommentModeration = (typeof MODERATION_VALUES)[number];

/**
 * What an unset site setting means.
 *
 * "open" is not a neutral choice — it is the behaviour both surfaces have had
 * all along, because no settings row ever existed and the code fell through to
 * auto-publish. Changing this default would silently start holding comments
 * across the whole site, so it stays and an admin flips it deliberately.
 */
export const DEFAULT_SITE_MODERATION: CommentModeration = "open";

/** Anything unrecognised is treated as the default rather than throwing. */
export function parseModeration(
  raw: string | null | undefined
): CommentModeration {
  return (MODERATION_VALUES as readonly string[]).includes(raw ?? "")
    ? (raw as CommentModeration)
    : DEFAULT_SITE_MODERATION;
}

export type CommentOutcome = "blocked" | "publish" | "hold";

export type CommentDecisionInput = {
  /**
   * Admin, or a surface capability that stands in for one (Ask the Rabbi's
   * `canManageAskTheRabbi`). Bypasses both the person and the policy.
   */
  isAdmin: boolean;
  /**
   * A per-surface grant that skips moderation without granting management —
   * currently only `canAutoApproveAskTheRabbi`. Unlike `isAdmin` this does NOT
   * override a block: the flag says "your comments need no review", not "you
   * may comment after being barred".
   */
  canSkipModeration?: boolean;
  /** users.commentPermission: "allowed" | "moderated" | "requires_approval" | "blocked". */
  commentPermission: string | null | undefined;
  /** A per-item override, where the surface has one. Null defers to the site. */
  itemModeration?: string | null | undefined;
  /** The surface's site-wide setting, already read from site_settings. */
  siteModeration: CommentModeration;
};

/**
 * "moderated" is a legacy alias for "requires_approval". The admin UI has only
 * ever offered Allowed / Requires Approval / Blocked, but the API schema still
 * accepts it and old rows may carry it, so both map to the same outcome.
 */
const HOLD_PERMISSIONS = new Set(["moderated", "requires_approval"]);

/**
 * Note the ordering: blocked is checked before anything except the admin
 * bypass, because a block must prevent the row from being written at all.
 * Holding for approval is the opposite — the row IS written, it just is not
 * visible yet. Collapsing the two into one status would leave blocked users'
 * text sitting in the moderation queue for an admin to accidentally approve.
 */
export function decideComment({
  isAdmin,
  canSkipModeration = false,
  commentPermission,
  itemModeration,
  siteModeration,
}: CommentDecisionInput): CommentOutcome {
  if (isAdmin) return "publish";

  const permission = commentPermission ?? "allowed";

  if (permission === "blocked") return "blocked";

  if (canSkipModeration) return "publish";

  if (HOLD_PERMISSIONS.has(permission)) return "hold";

  // A per-item override wins over the site setting. Null defers to it — and so
  // does any unrecognised value, rather than being coerced to "open", which
  // would let a bad write silently disable moderation for that one item.
  const override = (MODERATION_VALUES as readonly string[]).includes(
    itemModeration ?? ""
  )
    ? (itemModeration as CommentModeration)
    : null;

  return (override ?? siteModeration) === "approved" ? "hold" : "publish";
}

/**
 * Back-compat wrapper for the blog call site, which has a per-post override.
 * Kept so the blog route reads in its own terms.
 */
export function decideBlogComment(input: {
  isAdmin: boolean;
  commentPermission: string | null | undefined;
  postModeration: string | null | undefined;
  siteModeration: CommentModeration;
}): CommentOutcome {
  return decideComment({
    isAdmin: input.isAdmin,
    commentPermission: input.commentPermission,
    itemModeration: input.postModeration,
    siteModeration: input.siteModeration,
  });
}

/**
 * Whether a given person may set a given per-item override.
 *
 * Authors get the control, but only to make their own post STRICTER. They may
 * choose "hold for approval" or defer to the site; they may not TURN
 * MODERATION OFF.
 *
 * The asymmetry is the point. Letting an author pick "open" hands them a way
 * around a decision that is not theirs — an admin who turns moderation on for
 * a post after comments turn abusive, or who holds the whole site, would be
 * overridden by the author editing their own post. Tightening carries no such
 * risk: the worst case is comments waiting for review.
 *
 * `current` matters. Without it, an author whose post an admin had already set
 * to "open" could not edit their post AT ALL — the editor resends the current
 * value with every save, so a typo fix would be refused. The rule is about
 * CHANGING the setting, not about carrying it.
 */
export function canSetModerationOverride(
  isAdmin: boolean,
  next: string | null | undefined,
  current?: string | null
): boolean {
  if (isAdmin) return true;

  const normalise = (v: string | null | undefined) => v ?? null;
  // Resubmitting whatever is already there is always fine, including "open".
  if (current !== undefined && normalise(next) === normalise(current)) {
    return true;
  }

  return normalise(next) === null || next === "approved";
}
