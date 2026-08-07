import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, statSync } from "fs";
import path from "path";
import { mainNavigation } from "@/lib/constants/navigation";

/**
 * Every link in the site navigation must resolve to a real route.
 *
 * This is the exact defect that produced the eruv work: EruvWidget linked to
 * /eruv from two places for months while no such route existed, so the homepage
 * carried two links to a 404. Nothing in the build, the type checker or the
 * test suite objected, because a dead `href` is just a string.
 *
 * The dropdown children make this worse to catch by hand: Radix mounts
 * NavigationMenuContent lazily, so they are absent from the server-rendered
 * HTML and a curl of the homepage cannot see them at all. Someone has to open
 * each menu and click through. This test does it instead.
 */

const APP_DIR = path.resolve(__dirname, "../../src/app");

/** Route groups — "(public)", "(admin)" — structure files without affecting URLs. */
const isRouteGroup = (segment: string) => segment.startsWith("(") && segment.endsWith(")");

/** A dynamic segment: "[id]", "[slug]", "[...rest]". */
const isDynamic = (segment: string) => segment.startsWith("[");

/**
 * Whether `segments` can be reached in `dir`, descending through route groups.
 *
 * Route groups are transparent, so "/eruv" matches src/app/(public)/eruv, and a
 * dynamic segment matches any single value.
 */
function routeExists(dir: string, segments: string[]): boolean {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return false;

  // Consumed every segment: this directory must actually render something.
  if (segments.length === 0) {
    return ["page.tsx", "page.ts", "page.jsx", "page.js", "route.ts", "route.tsx"].some(
      (file) => existsSync(path.join(dir, file)),
    );
  }

  const [head, ...rest] = segments;
  const entries = readdirSync(dir).filter((entry) =>
    statSync(path.join(dir, entry)).isDirectory(),
  );

  for (const entry of entries) {
    // A route group contributes no URL segment — look inside it for the same one.
    if (isRouteGroup(entry) && routeExists(path.join(dir, entry), segments)) return true;
    if (entry === head && routeExists(path.join(dir, entry), rest)) return true;
    if (isDynamic(entry) && routeExists(path.join(dir, entry), rest)) return true;
  }

  return false;
}

function toSegments(href: string): string[] {
  return href.split("?")[0].split("#")[0].split("/").filter(Boolean);
}

/**
 * The hrefs a visitor can actually reach.
 *
 * A top-level item WITH children renders as a dropdown trigger — a button on
 * both desktop and mobile (`Header.tsx:127`, `:284`). Its `href` is read only in
 * the childless branch (`:151`, `:291`), so it is never navigated to. Asserting
 * on it would fail for something no user can click.
 */
const linkedHrefs = mainNavigation.flatMap((item) => [
  ...(item.children ? [] : [{ label: item.label, href: item.href }]),
  ...(item.children ?? []).map((child) => ({
    label: `${item.label} → ${child.label}`,
    href: child.href,
  })),
]);

describe("every site navigation link resolves to a real route", () => {
  it.each(linkedHrefs)("$label → $href", ({ href }) => {
    expect(href.startsWith("/"), `${href} should be an internal path`).toBe(true);
    expect(routeExists(APP_DIR, toSegments(href))).toBe(true);
  });

  // Guards the guard: if routeExists returned true for everything, the suite
  // above would pass while checking nothing.
  it("rejects a route that does not exist", () => {
    expect(routeExists(APP_DIR, toSegments("/definitely-not-a-real-page"))).toBe(false);
  });

  it("finds a page nested inside a route group", () => {
    // /eruv lives at src/app/(public)/eruv — the group must be transparent.
    expect(routeExists(APP_DIR, toSegments("/eruv"))).toBe(true);
  });
});

describe("a dropdown parent whose href does not resolve must keep its children", () => {
  // "Community" points at /community, which has no page — only /community/calendar
  // and friends. Harmless today because a parent with children is a button, but
  // it becomes a live 404 the moment someone removes those children or makes the
  // parent linkable. This fails at that moment rather than in production.
  it.each(mainNavigation.filter((item) => !routeExists(APP_DIR, toSegments(item.href))))(
    "$label ($href) has no page, so it must render as a dropdown",
    (item) => {
      expect(
        item.children?.length ?? 0,
        `${item.label} points at ${item.href}, which does not exist. It is only safe ` +
          `while it has children and therefore renders as a button rather than a link.`,
      ).toBeGreaterThan(0);
    },
  );
});

describe("the Alerts menu carries the eruv status", () => {
  it("links to /eruv", () => {
    const alerts = mainNavigation.find((item) => item.label === "Alerts");
    expect(alerts?.children?.some((child) => child.href === "/eruv")).toBe(true);
  });
});
