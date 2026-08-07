// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { EruvWidget } from "@/components/widgets/EruvWidget";

/**
 * Two defects lived here.
 *
 * 1. Both "Eruv Information" links pointed at /eruv, a route that did not
 *    exist. With the table empty the homepage showed "Unavailable" AND a link
 *    to a 404 -- the worst combination.
 * 2. The widget could only say UP, DOWN or "Unavailable". Since the eruv is
 *    generally not confirmed until Friday, "Unavailable" was what the homepage
 *    showed for most of every week, implying a site fault rather than a status
 *    that simply is not in yet.
 */

const shabbosRow = (over: Record<string, unknown> = {}) => ({
  id: 1,
  statusDate: "2026-08-08",
  isUp: true,
  message: null,
  updatedBy: null,
  updatedAt: "2026-08-07T14:00:00.000Z",
  ...over,
});

function mockApi(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok, json: async () => body })),
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("EruvWidget links", () => {
  it("points 'Eruv Information' at the real /eruv page", async () => {
    mockApi({ shabbosDate: "2026-08-08", status: shabbosRow(), previous: null });
    render(<EruvWidget />);

    const link = await screen.findByRole("link", { name: /eruv/i });
    expect(link).toHaveAttribute("href", "/eruv");
  });

  it("still offers the link when the API fails", async () => {
    mockApi({ error: "boom" }, false);
    render(<EruvWidget />);

    const link = await screen.findByRole("link", { name: /eruv/i });
    expect(link).toHaveAttribute("href", "/eruv");
  });
});

describe("EruvWidget states", () => {
  it("shows UP and names the Shabbos it applies to", async () => {
    mockApi({ shabbosDate: "2026-08-08", status: shabbosRow(), previous: null });
    render(<EruvWidget />);

    expect(await screen.findByText(/^up$/i)).toBeInTheDocument();
    // An undated UP is the thing that made a stale status dangerous.
    expect(screen.getByText(/August 8, 2026/)).toBeInTheDocument();
  });

  it("says 'not yet checked' rather than 'Unavailable' midweek", async () => {
    mockApi({
      shabbosDate: "2026-08-15",
      status: null,
      previous: shabbosRow({ statusDate: "2026-08-08", isUp: true }),
    });
    render(<EruvWidget />);

    expect(await screen.findByText(/not yet checked/i)).toBeInTheDocument();
    expect(screen.queryByText(/unavailable/i)).not.toBeInTheDocument();
    // Absence must not be reported as DOWN.
    expect(screen.queryByText(/^down$/i)).not.toBeInTheDocument();
  });

  it("offers the previous Shabbos as dated context", async () => {
    mockApi({
      shabbosDate: "2026-08-15",
      status: null,
      previous: shabbosRow({ statusDate: "2026-08-08", isUp: true }),
    });
    render(<EruvWidget />);

    expect(await screen.findByText(/August 8/)).toBeInTheDocument();
  });

  it("reserves 'Unavailable' for a genuine failure", async () => {
    mockApi({ error: "boom" }, false);
    render(<EruvWidget />);

    // "Unavailable" appears twice here: the badge and the sentence below it.
    await waitFor(() =>
      expect(screen.getByText(/^unavailable$/i)).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/status information is currently unavailable/i),
    ).toBeInTheDocument();
  });
});
