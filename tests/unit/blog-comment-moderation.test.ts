import { describe, it, expect } from "vitest";
import {
  decideBlogComment,
  parseModeration,
  DEFAULT_SITE_MODERATION,
  BLOG_COMMENT_MODERATION_KEY,
} from "@/lib/blog/comment-moderation";

/**
 * Before this module the blog comment route read the post override and the
 * site setting, and never looked at `users.commentPermission` at all — so an
 * account set to "Blocked" in Admin → Users could still comment on any post.
 * The cases marked THE BUG are the ones that were broken in production.
 */

const base = {
  isAdmin: false,
  commentPermission: "allowed" as string | null | undefined,
  postModeration: null as string | null | undefined,
  siteModeration: DEFAULT_SITE_MODERATION,
};

describe("the site-wide setting key", () => {
  it("matches the key the route has always read", () => {
    // Renaming this silently reverts the site to auto-publish, because the
    // lookup would miss and fall through to the default.
    expect(BLOG_COMMENT_MODERATION_KEY).toBe("blog_comment_moderation");
  });

  it("defaults to open, preserving the behaviour of the missing row", () => {
    expect(DEFAULT_SITE_MODERATION).toBe("open");
  });
});

describe("parseModeration", () => {
  it.each(["open", "approved"])("keeps the valid value %s", (v) => {
    expect(parseModeration(v)).toBe(v);
  });

  it.each([null, undefined, "", "OPEN", "moderated", "yes"])(
    "falls back to the default for %s",
    (v) => {
      expect(parseModeration(v)).toBe(DEFAULT_SITE_MODERATION);
    }
  );
});

describe("a person set to Blocked", () => {
  it("is blocked — THE BUG: the blog used to publish their comment", () => {
    expect(
      decideBlogComment({ ...base, commentPermission: "blocked" })
    ).toBe("blocked");
  });

  it("stays blocked even where the post is wide open", () => {
    // An "open" post must not be a way around an account-level block.
    expect(
      decideBlogComment({
        ...base,
        commentPermission: "blocked",
        postModeration: "open",
        siteModeration: "open",
      })
    ).toBe("blocked");
  });

  it("is blocked, not held — the row must never reach the queue", () => {
    // If a block produced "hold", the text would sit in the moderation queue
    // where an admin could approve it without realising who wrote it.
    expect(
      decideBlogComment({
        ...base,
        commentPermission: "blocked",
        siteModeration: "approved",
      })
    ).toBe("blocked");
  });
});

describe("a person set to Requires Approval", () => {
  it("is held — THE BUG: the blog used to publish immediately", () => {
    expect(
      decideBlogComment({ ...base, commentPermission: "requires_approval" })
    ).toBe("hold");
  });

  it("treats the legacy 'moderated' value identically", () => {
    // The API schema still accepts it and old rows may carry it, though the
    // admin UI has never offered it.
    expect(
      decideBlogComment({ ...base, commentPermission: "moderated" })
    ).toBe("hold");
  });

  it("is still held on a post explicitly set to open", () => {
    expect(
      decideBlogComment({
        ...base,
        commentPermission: "requires_approval",
        postModeration: "open",
      })
    ).toBe("hold");
  });
});

describe("an ordinary member", () => {
  it("publishes under the default settings", () => {
    expect(decideBlogComment(base)).toBe("publish");
  });

  it.each([null, undefined, "allowed"])(
    "treats %s as allowed",
    (permission) => {
      expect(decideBlogComment({ ...base, commentPermission: permission })).toBe(
        "publish"
      );
    }
  );

  it("is held when the site setting says approved", () => {
    expect(decideBlogComment({ ...base, siteModeration: "approved" })).toBe(
      "hold"
    );
  });
});

describe("the post override beats the site setting", () => {
  it("open post, approved site → publish", () => {
    expect(
      decideBlogComment({
        ...base,
        postModeration: "open",
        siteModeration: "approved",
      })
    ).toBe("publish");
  });

  it("approved post, open site → hold", () => {
    expect(
      decideBlogComment({
        ...base,
        postModeration: "approved",
        siteModeration: "open",
      })
    ).toBe("hold");
  });

  it("a null override defers to the site setting", () => {
    expect(
      decideBlogComment({
        ...base,
        postModeration: null,
        siteModeration: "approved",
      })
    ).toBe("hold");
  });

  it("an unrecognised override defers to the site rather than opening up", () => {
    // Coercing garbage to "open" would let a bad write disable moderation for
    // one post while the admin screen still showed the site as locked down.
    expect(
      decideBlogComment({
        ...base,
        postModeration: "whatever",
        siteModeration: "approved",
      })
    ).toBe("hold");
  });
});

describe("admins", () => {
  it("publish regardless of the site setting", () => {
    expect(
      decideBlogComment({ ...base, isAdmin: true, siteModeration: "approved" })
    ).toBe("publish");
  });

  it("bypass an account-level block, matching Ask the Rabbi's manager bypass", () => {
    expect(
      decideBlogComment({
        ...base,
        isAdmin: true,
        commentPermission: "blocked",
      })
    ).toBe("publish");
  });
});
