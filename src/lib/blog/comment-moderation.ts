/**
 * Who may comment on a blog post, and whether that comment goes live.
 *
 * Two independent controls feed one decision, and before this module only one
 * of them was consulted:
 *
 *   1. The POLICY for the post — its own `commentModeration` override, falling
 *      back to the site-wide `blog_comment_moderation` setting.
 *   2. The PERSON — `users.commentPermission`, set per account in
 *      Admin → Users. Ask the Rabbi honoured this; the blog never read it, so
 *      an account set to "Blocked" could still comment here.
 *
 * Keeping the decision in one pure function means the route cannot drift from
 * the rules again, and the rules can be tested without a database.
 */

/** The `site_settings.key` holding the site-wide default. */
export const BLOG_COMMENT_MODERATION_KEY = "blog_comment_moderation";

export const MODERATION_VALUES = ["open", "approved"] as const;
export type CommentModeration = (typeof MODERATION_VALUES)[number];

/**
 * What an unset site setting means.
 *
 * "open" is not a neutral choice — it is the behaviour the site has had since
 * the blog shipped, because the settings row never existed and the old code
 * fell through to auto-publish. Changing this default would silently start
 * holding comments on 3,058 posts, so it stays and the admin flips it
 * deliberately instead.
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

export type BlogCommentDecisionInput = {
  /** Admins bypass both controls, matching Ask the Rabbi's manager bypass. */
  isAdmin: boolean;
  /** users.commentPermission: "allowed" | "moderated" | "requires_approval" | "blocked". */
  commentPermission: string | null | undefined;
  /** blog_posts.commentModeration — a per-post override, or null to defer. */
  postModeration: string | null | undefined;
  /** The site-wide setting, already read from site_settings. */
  siteModeration: CommentModeration;
};

/**
 * "moderated" is a legacy alias for "requires_approval". The admin UI has only
 * ever offered Allowed / Requires Approval / Blocked, but the API schema still
 * accepts it and old rows may carry it, so both map to the same outcome.
 */
const HOLD_PERMISSIONS = new Set(["moderated", "requires_approval"]);

/**
 * Note the ordering: blocked is checked before anything else, because a block
 * must prevent the row from being written at all. Holding for approval is the
 * opposite — the row IS written, it just is not visible yet. Collapsing the two
 * into one status would leave blocked users' text sitting in the moderation
 * queue for an admin to accidentally approve.
 */
export function decideBlogComment({
  isAdmin,
  commentPermission,
  postModeration,
  siteModeration,
}: BlogCommentDecisionInput): CommentOutcome {
  if (isAdmin) return "publish";

  if ((commentPermission ?? "allowed") === "blocked") return "blocked";

  if (HOLD_PERMISSIONS.has(commentPermission ?? "allowed")) return "hold";

  // A post-level override wins over the site setting. Null defers to it — and
  // so does any unrecognised value, rather than being coerced to "open", which
  // would let a bad write silently disable moderation for that one post.
  const override = (MODERATION_VALUES as readonly string[]).includes(
    postModeration ?? ""
  )
    ? (postModeration as CommentModeration)
    : null;

  return (override ?? siteModeration) === "approved" ? "hold" : "publish";
}
