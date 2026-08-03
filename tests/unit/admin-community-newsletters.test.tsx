// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CommunityNewslettersPage from "@/app/(admin)/admin/community/newsletters/page";

/**
 * This screen's stated job is "what is live on the public newsletters page".
 * The list API has no isActive filter and the UI only ever offered a hard
 * delete, so a deactivated newsletter looked published here while being absent
 * from the public page — a screen whose purpose is "what is live" lying about
 * exactly that.
 *
 * Asserted through the rendered DOM rather than the handlers, because the
 * defect these guard against is a rendering one.
 */

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

interface Row {
  id: number;
  title: string;
  publisher: string | null;
  fileUrl: string;
  fileSize: number | null;
  description: string | null;
  publishedAt: string | null;
  isActive: boolean | null;
}

const row = (o: Partial<Row> & { id: number }): Row => ({
  title: `[TEST] issue ${o.id}`,
  publisher: "Israel News",
  fileUrl: "https://example.com/x.pdf",
  fileSize: null,
  description: null,
  publishedAt: "2026-08-03T16:00:00.000Z",
  isActive: true,
  ...o,
});

interface ShulRow {
  id: number;
  title: string;
  fileUrl: string;
  fileSize: number | null;
  description: string | null;
  publishedAt: string | null;
  shulId: number;
  shulName: string;
}

let patched: Array<{ url: string; body: unknown }>;

function mockList(rows: Row[], shulRows: ShulRow[] = []) {
  patched = [];
  global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") {
      patched.push({ url, body: JSON.parse(String(init.body)) });
      return { ok: true, json: async () => ({}) };
    }
    if (url.includes("shul-list")) {
      return { ok: true, json: async () => shulRows };
    }
    return { ok: true, json: async () => rows };
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  window.scrollTo = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("admin community newsletters", () => {
  it("marks a deactivated newsletter as Hidden and leaves a live one unmarked", async () => {
    mockList([row({ id: 1, title: "[TEST] Live one" }), row({ id: 2, title: "[TEST] Hidden one", isActive: false })]);

    render(<CommunityNewslettersPage />);

    await screen.findByText("[TEST] Hidden one");
    // Exactly one badge — a rule that marked everything, or nothing, would
    // still satisfy "renders a badge".
    expect(screen.getAllByText("Hidden")).toHaveLength(1);
  });

  it("treats a null isActive as live, matching the public page", async () => {
    // The column is nullable and defaults true, so only an explicit false
    // hides a row. Reading it as falsy would mark legacy rows Hidden here
    // while they render publicly — the same lie in the other direction.
    mockList([row({ id: 1, isActive: null })]);

    render(<CommunityNewslettersPage />);

    await screen.findByText("[TEST] issue 1");
    expect(screen.queryByText("Hidden")).toBeNull();
  });

  it("hides a live newsletter through the toggle", async () => {
    mockList([row({ id: 7, isActive: true })]);
    render(<CommunityNewslettersPage />);
    await screen.findByText("[TEST] issue 7");

    await userEvent.click(screen.getByTitle("Hide from the public page"));

    await waitFor(() => expect(patched).toHaveLength(1));
    expect(patched[0].url).toBe("/api/admin/community-newsletters/7");
    expect(patched[0].body).toEqual({ isActive: false });
  });

  it("restores a hidden newsletter through the same toggle", async () => {
    mockList([row({ id: 8, isActive: false })]);
    render(<CommunityNewslettersPage />);
    await screen.findByText("[TEST] issue 8");

    await userEvent.click(screen.getByTitle("Show on the public page"));

    await waitFor(() => expect(patched).toHaveLength(1));
    expect(patched[0].body).toEqual({ isActive: true });
  });

  it("offers each publisher already in use once, so a series is not split by a typo", async () => {
    mockList([
      row({ id: 1, publisher: "Israel News" }),
      row({ id: 2, publisher: "Israel News" }),
      row({ id: 3, publisher: "BAYT Bulletin" }),
      row({ id: 4, publisher: null }),
      row({ id: 5, publisher: "   " }),
    ]);

    render(<CommunityNewslettersPage />);
    await screen.findByText("[TEST] issue 1");

    const options = Array.from(
      document.querySelectorAll("#publisher-options option")
    ).map((o) => o.getAttribute("value"));

    // Deduped, and neither a null nor a whitespace-only publisher becomes a
    // blank suggestion.
    expect(options).toEqual(["BAYT Bulletin", "Israel News"]);
  });

  it("lists shul newsletters read-only, linking into that shul's Docs dialog", async () => {
    mockList(
      [row({ id: 1, title: "[TEST] Community issue" })],
      [
        {
          id: 55,
          title: "[TEST] Parshas Devarim",
          fileUrl: "https://example.com/d.pdf",
          fileSize: null,
          description: null,
          publishedAt: null,
          shulId: 12,
          shulName: "[TEST] Clanton Park",
        },
      ]
    );

    render(<CommunityNewslettersPage />);

    await screen.findByText("[TEST] Parshas Devarim");
    expect(screen.getByText("[TEST] Clanton Park")).toBeTruthy();
    // The shul, not the document: Docs is a per-shul dialog.
    expect(screen.getByText("Manage in Shuls").closest("a")).toHaveAttribute(
      "href",
      "/admin/shuls?docs=12"
    );

    // Read-only. Shul managers own these rows, and the edit/delete controls
    // here would act on community newsletters they do not belong to.
    const shulCard = screen.getByText("[TEST] Parshas Devarim").closest("div.p-4");
    expect(shulCard?.querySelector("button")).toBeNull();
  });

  it("shows no shul section when there are no shul newsletters", async () => {
    mockList([row({ id: 1 })], []);

    render(<CommunityNewslettersPage />);

    await screen.findByText("[TEST] issue 1");
    expect(screen.queryByText("Shul newsletters")).toBeNull();
  });

  it("wires the datalist to the publisher field", async () => {
    // An option list nothing points at is invisible — the whole guard against
    // "Israel News" / "Israeli News" depends on this attribute.
    mockList([row({ id: 1 })]);

    render(<CommunityNewslettersPage />);
    await screen.findByText("[TEST] issue 1");

    expect(screen.getByLabelText("Publisher / Source")).toHaveAttribute(
      "list",
      "publisher-options"
    );
  });
});
