/**
 * Reference-counted body scroll lock.
 *
 * ## Why counting is necessary
 *
 * The naive version — each dialog saves `document.body.style.overflow` on mount
 * and restores it on unmount — breaks as soon as two can be open at once:
 *
 *   1. Dialog A mounts, saves `""`, sets `hidden`.
 *   2. Dialog B mounts, saves `"hidden"` (A's value!), sets `hidden`.
 *   3. Both close. Cleanups run in tree order: A restores `""`, then B restores
 *      `"hidden"`.
 *   4. Nothing is on screen and the page can no longer be scrolled, until a
 *      full reload.
 *
 * That was reachable on the homepage, which mounts three independent ad
 * rotators, each with its own lightbox. Pressing Escape closes both at once,
 * which guarantees the bad ordering.
 *
 * Counting fixes it: the FIRST lock records the original value, the LAST unlock
 * restores it, and everything in between is a no-op. Releases are idempotent, so
 * a double-unmount cannot drive the count negative.
 */

let lockCount = 0;
let previousOverflow: string | null = null;

export function lockBodyScroll(): () => void {
  if (typeof document === "undefined") return () => {};

  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;

  let released = false;
  return function release() {
    // Idempotent: React can invoke a cleanup more than once in development, and
    // an unguarded decrement would unlock while another dialog is still open.
    if (released) return;
    released = true;

    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      document.body.style.overflow = previousOverflow ?? "";
      previousOverflow = null;
    }
  };
}

/** Test-only: reset module state between cases. */
export function __resetScrollLockForTests() {
  lockCount = 0;
  previousOverflow = null;
}
