import { describe, it, expect } from "vitest";
import { SUBMISSION_TYPES } from "@/lib/submissions/types";
import {
  sendEventLiveEmail,
  sendShivaNoticeEmail,
  sendKosherAlertBroadcast,
} from "@/lib/email/send";

/**
 * Each type is wired to ITS OWN broadcaster.
 *
 * setApprovalStatus calls `broadcaster(row as never)`, which is the only way to
 * call three functions with three different row types through one config field
 * — and `as never` switches off the checking that would otherwise catch a
 * mix-up. Wire shiva's announcement under `event` and nothing complains: the
 * wrong email goes to the whole subscriber list, and the failure is swallowed
 * by the try/catch around the send.
 *
 * Identity comparison, not a snapshot of names, so renaming a function moves
 * this test with it.
 *
 * Integration project on purpose: @/lib/email/send imports @/lib/db, which
 * throws without DATABASE_URL. That is also why the config imports it lazily.
 */

const expected = {
  event: sendEventLiveEmail,
  shiva: sendShivaNoticeEmail,
  kosherAlert: sendKosherAlertBroadcast,
} as const;

describe("broadcaster wiring", () => {
  it.each(Object.entries(expected))(
    "%s announces through its own sender",
    async (type, fn) => {
      const config = SUBMISSION_TYPES[type as keyof typeof expected];
      expect(config.broadcast).not.toBeNull();
      const resolved = await config.broadcast!();
      expect(resolved).toBe(fn);
    }
  );

  it("no other type resolves a broadcaster", async () => {
    const silent = Object.entries(SUBMISSION_TYPES)
      .filter(([name]) => !(name in expected))
      .map(([name, config]) => [name, config.broadcast] as const);

    for (const [name, broadcast] of silent) {
      expect(broadcast, `${name} unexpectedly announces`).toBeNull();
    }
  });
});
