// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PublicLocationHint } from "@/components/admin/PublicLocationHint";

/**
 * Admin sections do not say where their content surfaces publicly, and the two
 * can be filed under different menus: Important Numbers is administered under
 * Community but linked publicly under Alerts. That mismatch is why the owner
 * could not find the page at all.
 *
 * The nav path is the load-bearing half. A URL alone does not tell you how a
 * visitor is meant to arrive.
 */

describe("PublicLocationHint", () => {
  // Opened by focus rather than hover: it is the keyboard path, it is what
  // jsdom drives reliably, and Radix renders the content twice (a visible copy
  // plus a visually-hidden one for screen readers), hence getAllByText.
  it("names the public URL and the nav path", async () => {
    render(
      <PublicLocationHint
        href="/community/important-numbers"
        navPath="Alerts → Important Numbers"
      />,
    );

    fireEvent.focus(screen.getByRole("button"));

    await waitFor(() =>
      expect(
        screen.getAllByText("/community/important-numbers").length,
      ).toBeGreaterThan(0),
    );
    expect(
      screen.getAllByText(/Alerts → Important Numbers/).length,
    ).toBeGreaterThan(0);
  });

  it("links to the public page so it can be opened directly", () => {
    render(<PublicLocationHint href="/eruv" navPath="Community → Eruv" />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/eruv");
    // A new tab: the admin is mid-edit and should not lose the page.
    expect(link).toHaveAttribute("target", "_blank");
  });
});
