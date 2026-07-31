// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { lockBodyScroll, __resetScrollLockForTests } from "@/lib/scroll-lock";

/**
 * The bug this replaces:
 *
 * Each dialog saved `document.body.style.overflow` on mount and restored it on
 * unmount. With two open at once, the second captured the FIRST one's applied
 * value ("hidden"), so whichever unmounted last restored "hidden" — leaving the
 * page permanently unscrollable with nothing on screen.
 *
 * The homepage mounts three independent ad rotators, each with its own lightbox,
 * and Escape closes them together — which guarantees the bad ordering.
 */
describe("lockBodyScroll", () => {
  beforeEach(() => {
    __resetScrollLockForTests();
    document.body.style.overflow = "";
  });

  it("locks and restores for a single dialog", () => {
    const release = lockBodyScroll();
    expect(document.body.style.overflow).toBe("hidden");
    release();
    expect(document.body.style.overflow).toBe("");
  });

  it("stays locked while a second dialog is open, and restores once", () => {
    const releaseA = lockBodyScroll();
    const releaseB = lockBodyScroll();
    expect(document.body.style.overflow).toBe("hidden");

    releaseA();
    // B is still open — unlocking here would let the page scroll behind a dialog.
    expect(document.body.style.overflow).toBe("hidden");

    releaseB();
    expect(document.body.style.overflow).toBe("");
  });

  it("survives the exact ordering that broke it — outer released first", () => {
    // This is the Escape-closes-both case, in the order React runs cleanups.
    const releaseOuter = lockBodyScroll();
    const releaseInner = lockBodyScroll();
    releaseOuter();
    releaseInner();
    expect(document.body.style.overflow).toBe("");
  });

  it("is idempotent, so a double cleanup cannot unlock early", () => {
    const releaseA = lockBodyScroll();
    const releaseB = lockBodyScroll();

    releaseA();
    releaseA(); // React can invoke a cleanup twice in development.
    expect(document.body.style.overflow).toBe("hidden");

    releaseB();
    expect(document.body.style.overflow).toBe("");
  });

  it("preserves a pre-existing overflow value rather than assuming empty", () => {
    document.body.style.overflow = "scroll";
    const release = lockBodyScroll();
    expect(document.body.style.overflow).toBe("hidden");
    release();
    expect(document.body.style.overflow).toBe("scroll");
  });

  it("handles three concurrent locks, one per homepage position", () => {
    const releases = [lockBodyScroll(), lockBodyScroll(), lockBodyScroll()];
    releases.forEach((release, index) => {
      release();
      const expected = index === releases.length - 1 ? "" : "hidden";
      expect(document.body.style.overflow).toBe(expected);
    });
  });
});
