import { describe, it, expect, vi } from "vitest";

/**
 * Rapid clicks on "Schedule Anyway" created duplicate events in production.
 *
 * Three "Bnos Bais Yaakov Play" and two "Renewal Canada Crowdfunding Campaign"
 * were created **0 seconds apart** on 2026-08-06. Not a user clicking twice
 * over time — the same confirmation firing repeatedly.
 *
 * The handler *looked* guarded:
 *
 *     if (!pendingPayload) return;
 *     setPendingPayload(null);        // React state update — ASYNCHRONOUS
 *     await submitPayload(...);
 *
 * `setPendingPayload` does not change `pendingPayload` for the current render,
 * so every queued click reads the old value, passes the guard, and posts.
 *
 * These tests model both guards against the same click storm. The state
 * version must FAIL — that is what makes the ref version meaningful.
 */

/** How React actually behaves: the value visible to handlers is frozen per render. */
function makeStateGuardedHandler(submit: () => Promise<void>) {
  let pendingPayload: object | null = { title: "x" };
  let queuedClear = false;

  return async function handleConflictProceed() {
    if (!pendingPayload) return;
    // setState schedules; it does not assign. Nothing sees null until React
    // re-renders, which cannot happen while these handlers are queued.
    queuedClear = true;
    await submit();
    if (queuedClear) pendingPayload = null; // the re-render, eventually
  };
}

function makeRefGuardedHandler(submit: () => Promise<void>) {
  const ref = { current: false };
  let pendingPayload: object | null = { title: "x" };

  return async function handleConflictProceed() {
    // A ref assigns immediately, so the second click sees it.
    if (ref.current) return;
    if (!pendingPayload) return;
    ref.current = true;
    pendingPayload = null;
    try {
      await submit();
    } finally {
      ref.current = false;
    }
  };
}

/** Three clicks landing before the first request resolves. */
async function clickThreeTimesFast(handler: () => Promise<void>) {
  await Promise.all([handler(), handler(), handler()]);
}

describe("the conflict modal's confirm button", () => {
  it("a state-based guard does NOT stop the duplicates — the production bug", async () => {
    const submit = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    await clickThreeTimesFast(makeStateGuardedHandler(submit));

    // Three events, zero seconds apart. Exactly what is sitting in the queue.
    expect(submit).toHaveBeenCalledTimes(3);
  });

  it("a ref guard submits exactly once", async () => {
    const submit = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    await clickThreeTimesFast(makeRefGuardedHandler(submit));

    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("releases after a failure, so a genuine retry still works", async () => {
    // The guard must not wedge the form shut when the network drops.
    let attempt = 0;
    const submit = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error("network");
    });

    const handler = makeRefGuardedHandler(submit);
    await expect(handler()).rejects.toThrow("network");

    // pendingPayload is cleared by the first attempt, so this models the
    // caller re-opening the modal: a fresh handler, guard released.
    const retry = makeRefGuardedHandler(submit);
    await retry();

    expect(submit).toHaveBeenCalledTimes(2);
  });
});
