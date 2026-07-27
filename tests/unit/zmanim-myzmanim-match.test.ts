import { describe, it, expect } from "vitest";
import { getZmanimForDate } from "@/lib/zmanim";
import { TORONTO_LOCATION } from "@/lib/zmanim-location";

// Reference values read from myzmanim.com for Toronto, Monday 27 July 2026.
// MyZmanim states the rule for each row on the page itself, which is what makes
// these checkable rather than magic numbers.
const day = new Date(Date.UTC(2026, 6, 27, 12));
const at = (d: Date | null) =>
  d ? d.toLocaleTimeString("en-US", { timeZone: TORONTO_LOCATION.tzid, hour12: true }) : "—";

/** Seconds between our value and MyZmanim's published one. */
function driftSeconds(ours: Date, theirs: string): number {
  const [hms, ap] = theirs.split(" ");
  const [h, m, s] = hms.split(":").map(Number);
  const hour24 = ap === "PM" && h !== 12 ? h + 12 : ap === "AM" && h === 12 ? 0 : h;
  const ref = new Date(ours);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TORONTO_LOCATION.tzid, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(ours);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const oursSecs = get("hour") * 3600 + get("minute") * 60 + get("second");
  const theirSecs = hour24 * 3600 + m * 60 + s;
  void ref;
  return Math.abs(oursSecs - theirSecs);
}

describe("misheyakir follows MyZmanim's stated 10.2 degrees", () => {
  it("is within 30s of MyZmanim's 4:59:20 AM", () => {
    const r = getZmanimForDate(day, TORONTO_LOCATION);
    expect(driftSeconds(r.zmanim.misheyakir, "4:59:20 AM")).toBeLessThan(30);
  });

  it("is NOT hebcal's 11.5-degree default, which is ~9.5 minutes early", () => {
    const r = getZmanimForDate(day, TORONTO_LOCATION);
    // The old value was 4:49:50 AM. Anything near it means the degree was not applied.
    expect(driftSeconds(r.zmanim.misheyakir, "4:49:50 AM")).toBeGreaterThan(300);
  });
});

describe("Magen Avraham shema and tefila (72 minutes as 16.1 degrees)", () => {
  it("sof zman shma MGA is within 30s of MyZmanim's 8:48:49 AM", () => {
    const r = getZmanimForDate(day, TORONTO_LOCATION);
    expect(r.zmanim.sofZmanShmaMGA).toBeInstanceOf(Date);
    expect(driftSeconds(r.zmanim.sofZmanShmaMGA, "8:48:49 AM")).toBeLessThan(30);
  });

  it("MGA shema is earlier than the GRA shema", () => {
    const r = getZmanimForDate(day, TORONTO_LOCATION);
    expect(r.zmanim.sofZmanShmaMGA.getTime()).toBeLessThan(r.zmanim.sofZmanShma.getTime());
  });

  it("exposes sof zman tefila MGA, earlier than the GRA tefila", () => {
    const r = getZmanimForDate(day, TORONTO_LOCATION);
    expect(r.zmanim.sofZmanTfillaMGA).toBeInstanceOf(Date);
    expect(r.zmanim.sofZmanTfillaMGA.getTime()).toBeLessThan(r.zmanim.sofZmanTfilla.getTime());
  });
});

describe("the zmanim MyZmanim and we already agree on stay agreeing", () => {
  it.each([
    ["alotHaShachar", "4:14:03 AM"],
    ["sunrise", "6:01:38 AM"],
    ["sofZmanShma", "9:42:45 AM"],
    ["sofZmanTfilla", "10:56:28 AM"],
    ["chatzot", "1:23:53 PM"],
    ["minchaGedola", "2:00:44 PM"],
    ["plagHaMincha", "7:14:00 PM"],
    ["sunset", "8:46:09 PM"],
    ["tzait", "9:36:17 PM"],
    ["tzait72", "9:58:09 PM"],
  ])("%s is within 15s of %s", (key, theirs) => {
    const r = getZmanimForDate(day, TORONTO_LOCATION);
    const ours = (r.zmanim as unknown as Record<string, Date>)[key];
    expect(at(ours)).toBeTruthy();
    expect(driftSeconds(ours, theirs)).toBeLessThan(15);
  });
});
