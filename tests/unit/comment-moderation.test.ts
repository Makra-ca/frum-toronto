import { describe, it, expect } from "vitest";
import {
  decideBlogComment,
  decideComment,
  parseModeration,
  DEFAULT_SITE_MODERATION,
  BLOG_COMMENT_MODERATION_KEY,
  COMMENT_SURFACES,
} from "@/lib/comments/moderation";

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

/* ------------------------------------------------------------------ *
 * The surface-agnostic decision, shared by blog and Ask the Rabbi.
 * ------------------------------------------------------------------ */

describe("decideComment across both surfaces", () => {
  const atr = {
    isAdmin: false,
    commentPermission: "allowed" as string | null | undefined,
    siteModeration: DEFAULT_SITE_MODERATION,
  };

  it("gives each surface its own settings key", () => {
    // Sharing one key would mean supervising the blog silently supervised
    // Torah Q&A as well.
    expect(COMMENT_SURFACES.blog.key).toBe("blog_comment_moderation");
    expect(COMMENT_SURFACES.askTheRabbi.key).toBe("atr_comment_moderation");
    expect(COMMENT_SURFACES.blog.key).not.toBe(COMMENT_SURFACES.askTheRabbi.key);
  });

  it("holds an Ask the Rabbi comment when its site setting says approved", () => {
    // Ask the Rabbi had no policy layer at all before this.
    expect(decideComment({ ...atr, siteModeration: "approved" })).toBe("hold");
  });

  it("publishes when Ask the Rabbi's setting is open", () => {
    expect(decideComment({ ...atr, siteModeration: "open" })).toBe("publish");
  });

  describe("canSkipModeration (canAutoApproveAskTheRabbi)", () => {
    it("beats a Requires Approval account, as it always did", () => {
      expect(
        decideComment({
          ...atr,
          canSkipModeration: true,
          commentPermission: "requires_approval",
        })
      ).toBe("publish");
    });

    it("beats a site setting of approved", () => {
      expect(
        decideComment({
          ...atr,
          canSkipModeration: true,
          siteModeration: "approved",
        })
      ).toBe("publish");
    });

    it("does NOT override a block", () => {
      // The flag says "your comments need no review", not "you may comment
      // after being barred". Only an admin overrides a block.
      expect(
        decideComment({
          ...atr,
          canSkipModeration: true,
          commentPermission: "blocked",
        })
      ).toBe("blocked");
    });
  });

  it("has no per-item override on Ask the Rabbi", () => {
    // There is no per-question moderation column, so the site setting is the
    // only policy input. Passing undefined must not accidentally open it up.
    expect(
      decideComment({
        ...atr,
        itemModeration: undefined,
        siteModeration: "approved",
      })
    ).toBe("hold");
  });
});
