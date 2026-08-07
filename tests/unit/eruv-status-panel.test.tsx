// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EruvStatusPanel } from "@/components/eruv/EruvStatusPanel";

/**
 * The eruv is generally not confirmed until Friday, so Sunday through Thursday
 * there is no status for the coming Shabbos. That empty state is the panel's
 * NORMAL state, not an error, and it must never be rendered as "down".
 *
 * "Not checked" and "the eruv is down" lead to the same practical caution but
 * are different claims. Showing absence as DOWN would be the site asserting
 * something false about the eruv.
 */

const row = (over: Partial<Parameters<typeof EruvStatusPanel>[0]["status"]> = {}) => ({
  id: 1,
  statusDate: "2026-08-08",
  isUp: true,
  message: null,
  updatedBy: null,
  updatedAt: new Date("2026-08-07T14:00:00Z"),
  ...over,
});

describe("EruvStatusPanel with a status for this Shabbos", () => {
  it("shows UP and the Shabbos it applies to", () => {
    render(
      <EruvStatusPanel
        shabbosDate="2026-08-08"
        status={row({ message: "Checked Friday morning." })}
        previous={null}
      />,
    );

    expect(screen.getByText(/^up$/i)).toBeInTheDocument();
    expect(screen.getByText(/August 8, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Checked Friday morning\./)).toBeInTheDocument();
  });

  it("shows DOWN when the eruv is down", () => {
    render(
      <EruvStatusPanel
        shabbosDate="2026-08-08"
        status={row({ isUp: false, message: "Wire down on Bathurst." })}
        previous={null}
      />,
    );

    expect(screen.getByText(/^down$/i)).toBeInTheDocument();
  });
});

describe("EruvStatusPanel with nothing entered for this Shabbos", () => {
  it("says not yet checked, and does NOT say down", () => {
    render(
      <EruvStatusPanel
        shabbosDate="2026-08-15"
        status={null}
        previous={row({ statusDate: "2026-08-08", isUp: true })}
      />,
    );

    expect(screen.getByText(/not yet checked/i)).toBeInTheDocument();
    // The load-bearing assertion: absence must not be reported as DOWN.
    expect(screen.queryByText(/^down$/i)).not.toBeInTheDocument();
  });

  it("offers the previous Shabbos as dated context", () => {
    render(
      <EruvStatusPanel
        shabbosDate="2026-08-15"
        status={null}
        previous={row({ statusDate: "2026-08-08", isUp: true })}
      />,
    );

    // The date must appear alongside it so it cannot read as current.
    expect(screen.getByText(/last checked/i)).toBeInTheDocument();
    expect(screen.getByText(/August 8, 2026/)).toBeInTheDocument();
  });

  // The riskiest combination: last week was DOWN and this week is unchecked.
  // The headline must still be "not yet checked", with "down" appearing only
  // inside the dated context sentence -- never as the status of this Shabbos.
  it("does not present a previous DOWN as this Shabbos's status", () => {
    render(
      <EruvStatusPanel
        shabbosDate="2026-08-15"
        status={null}
        previous={row({ statusDate: "2026-08-08", isUp: false })}
      />,
    );

    expect(screen.getByText(/not yet checked/i)).toBeInTheDocument();

    // "down" is present, but only within the "Last checked ..." sentence.
    const down = screen.getByText(/^down$/i);
    expect(down.closest("p")?.textContent).toMatch(/last checked/i);
  });

  it("renders without a previous status at all", () => {
    render(<EruvStatusPanel shabbosDate="2026-08-15" status={null} previous={null} />);

    expect(screen.getByText(/not yet checked/i)).toBeInTheDocument();
    expect(screen.queryByText(/last checked/i)).not.toBeInTheDocument();
  });

  it("names the Shabbos it is waiting on", () => {
    render(<EruvStatusPanel shabbosDate="2026-08-15" status={null} previous={null} />);

    expect(screen.getByText(/August 15, 2026/)).toBeInTheDocument();
  });
});

describe("EruvStatusPanel dates are read as plain calendar dates", () => {
  // status_date is a DATE column. Formatting it through a timezone conversion
  // renders it a day early -- the exact bug fixed across the site in July.
  it("does not shift the date backwards", () => {
    render(<EruvStatusPanel shabbosDate="2026-08-08" status={row()} previous={null} />);

    expect(screen.getByText(/August 8, 2026/)).toBeInTheDocument();
    expect(screen.queryByText(/August 7, 2026/)).not.toBeInTheDocument();
  });
});
