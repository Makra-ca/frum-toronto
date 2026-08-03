// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminShulsPage from "@/app/(admin)/admin/shuls/page";

/**
 * "Docs" is a client-state dialog, not a route, so /admin/shuls?docs=<id> has
 * to be wired by hand. The trap is that docsShul holds a whole Shul object
 * while the list arrives from an async fetch — a mount-time lookup runs
 * against [] and the dialog silently never opens, with every other test green.
 */

const params = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => params,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// The dialog body fetches its own documents; the deep link is what is under
// test, not the document list.
vi.mock("@/components/admin/ShulDocuments", () => ({
  ShulDocuments: ({ shulId }: { shulId: number }) => (
    <div data-testid="docs-body">docs for {shulId}</div>
  ),
}));

const shuls = [
  { id: 11, name: "[TEST] Ahavat Shalom", slug: "test-ahavat-shalom", isActive: true },
  { id: 12, name: "[TEST] Clanton Park", slug: "test-clanton-park", isActive: true },
];

beforeEach(() => {
  params.delete("docs");
  // A fresh array every call, as a real refetch produces — the identity change
  // is what re-runs the effect, and reusing one array would hide that.
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => shuls.map((s) => ({ ...s })),
  })) as unknown as typeof fetch;
});

afterEach(() => vi.restoreAllMocks());

describe("/admin/shuls?docs=<id>", () => {
  it("opens the Docs dialog for that shul once the list has loaded", async () => {
    params.set("docs", "12");

    render(<AdminShulsPage />);

    // Named, not merely present — opening the wrong shul's documents is the
    // failure that matters, and any dialog at all would satisfy a bare check.
    expect(await screen.findByText("Documents — [TEST] Clanton Park")).toBeTruthy();
    expect(screen.getByTestId("docs-body").textContent).toContain("12");
  });

  it("opens nothing without the param", async () => {
    render(<AdminShulsPage />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.queryByTestId("docs-body")).toBeNull();
  });

  it("opens nothing for an id that is not in the list", async () => {
    params.set("docs", "9999");

    render(<AdminShulsPage />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.queryByTestId("docs-body")).toBeNull();
  });

  it("stays closed after the admin closes it, even once the list refetches", async () => {
    // The param stays in the URL and the effect depends on `shuls`, which gets
    // a fresh identity on every refetch — so without a guard the next save or
    // delete anywhere on this page re-opens the dialog behind the admin.
    // A plain close-and-assert would pass without that guard, because nothing
    // in the test would have refetched.
    params.set("docs", "11");
    render(<AdminShulsPage />);
    await screen.findByText("Documents — [TEST] Ahavat Shalom");

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("docs-body")).toBeNull());

    // Delete another shul: the real path that ends in fetchShuls().
    // The row's delete control is icon-only, so it has no accessible name.
    const rowDelete = document.querySelectorAll<HTMLButtonElement>(
      "button.text-red-600"
    )[0];
    await userEvent.click(rowDelete);
    const confirm = await screen.findByRole("button", { name: "Delete" });
    await userEvent.click(confirm);

    await waitFor(() =>
      expect(
        (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length
      ).toBeGreaterThan(2)
    );
    expect(screen.queryByTestId("docs-body")).toBeNull();
  });
});
