import { describe, it, expect } from "vitest";
import { getZmanimForDate } from "@/lib/zmanim";
import { formatZmanByKey, roundZman, ZMAN_DIRECTION } from "@/lib/zmanim-format";
import { TORONTO_LOCATION } from "@/lib/zmanim-location";

const TZ = TORONTO_LOCATION.tzid;

/** Noon-UTC anchor for a civil date, matching the library's own convention. */
const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

/** Ten consecutive Saturdays from 2026-01-03. */
const saturdays = Array.from({ length: 10 }, (_, i) => day(2026, 1, 3 + 7 * i));

// ---------------------------------------------------------------------------
// The site defines havdalah and tzeis as THE SAME MOMENT: src/lib/zmanim.ts
// passes `havdalahDeg: 8.5` to hebcal and computes `tzait` as `tzeit(8.5)`.
//
// A Saturday card in the week view renders both, one above the other. They must
// therefore print the same minute — otherwise the page states that Shabbos ends
// at two different times.
//
// They did not. hebcal pre-rounds its Havdalah event to the NEAREST minute, so
// the value arrives already at :00 seconds; `roundZman` returns early on a zero
// remainder, so the "up" direction in ZMAN_DIRECTION never applied to it. The
// raw tzeit(8.5) value meanwhile carries real seconds and was rounded up. Half
// the Saturdays in the year therefore disagreed by a minute.
// ---------------------------------------------------------------------------
describe("havdalah and tzeis print the same minute", () => {
  it.each(saturdays)("%s", (date) => {
    const subject = getZmanimForDate(date, TORONTO_LOCATION);

    const tzeis = formatZmanByKey("tzait", subject.zmanim.tzait, TZ);
    const havdalah = formatZmanByKey("havdalah", subject.havdalah, TZ);

    expect(havdalah).not.toBeNull();
    expect(havdalah).toBe(tzeis);
  });
});

// ---------------------------------------------------------------------------
// The invariant behind the bug, stated directly.
//
// `roundZman` is a no-op on any value already sitting at :00 seconds. So a zman
// that reaches it PRE-ROUNDED silently loses its rounding policy — the entry in
// ZMAN_DIRECTION is still present and the coverage test still passes, which is
// why this went unnoticed.
//
// Guarding the invariant rather than the symptom: the same defect exists for
// `sunriseOffset(-45, true)`, whose `roundMinute` argument truncates seconds.
// ---------------------------------------------------------------------------
describe("no zman reaches roundZman already rounded", () => {
  it("rounding an already-whole-minute value cannot move it", () => {
    const whole = new Date("2026-01-03T22:41:00.000Z");
    expect(roundZman(whole, "up").getTime()).toBe(whole.getTime());
    expect(roundZman(whole, "down").getTime()).toBe(whole.getTime());
  });

  it.each(saturdays)("havdalah carries real seconds on %s", (date) => {
    const { havdalah } = getZmanimForDate(date, TORONTO_LOCATION);
    expect(havdalah).not.toBeNull();

    // Not an assertion that seconds are non-zero — that would be luck-dependent.
    // The assertion is that the value is the SAME INSTANT as tzeit(8.5), which
    // is only true if it was taken from the zmanim calculation rather than from
    // hebcal's pre-rounded event.
    const { tzait } = getZmanimForDate(date, TORONTO_LOCATION).zmanim;
    expect(havdalah!.getTime()).toBe(tzait.getTime());
  });

  it("havdalah is registered as a permitted-from time, so it rounds up", () => {
    // Shabbos ENDS at havdalah, so the safe direction is later, never earlier.
    expect(ZMAN_DIRECTION.havdalah).toBe("up");
  });
});
