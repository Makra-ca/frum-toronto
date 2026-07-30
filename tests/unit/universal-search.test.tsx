// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UniversalSearch } from "../../src/components/search/UniversalSearch";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function mockSuggestions(rows: { id: string; title: string; url: string }[]) {
  return vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        suggestions: rows.map((r) => ({
          ...r,
          type: "simchas",
          relevanceScore: 1,
        })),
      }),
    })
  );
}

beforeEach(() => {
  push.mockClear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

const box = () => screen.getByPlaceholderText("Search…");

describe("UniversalSearch", () => {
  it("adopts a new applied query when the page navigates", async () => {
    // The reported confusion: the box kept showing an old query after the URL
    // dropped ?search=, so it displayed a filter that was not in effect.
    vi.stubGlobal("fetch", mockSuggestions([]));
    const view = render(
      <UniversalSearch searchType="simchas" placeholder="Search…" initialQuery="Buksbaum" />
    );
    expect(box()).toHaveValue("Buksbaum");

    view.rerender(
      <UniversalSearch searchType="simchas" placeholder="Search…" initialQuery="" />
    );
    expect(box()).toHaveValue("");
  });

  it("does not clobber typing when the applied query has not changed", async () => {
    vi.stubGlobal("fetch", mockSuggestions([]));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const view = render(
      <UniversalSearch searchType="simchas" placeholder="Search…" initialQuery="ro" />
    );

    await user.clear(box());
    await user.type(box(), "rochel");
    // A re-render with the same initialQuery must leave the input alone.
    view.rerender(
      <UniversalSearch searchType="simchas" placeholder="Search…" initialQuery="ro" />
    );
    expect(box()).toHaveValue("rochel");
  });

  it("does not echo its own submitted query back over later typing", async () => {
    vi.stubGlobal("fetch", mockSuggestions([]));
    const onSearch = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    const view = render(
      <UniversalSearch
        searchType="simchas"
        placeholder="Search…"
        initialQuery=""
        onSearch={onSearch}
      />
    );

    await user.type(box(), "guttman");
    await user.keyboard("{Enter}");
    expect(onSearch).toHaveBeenCalledWith("guttman");

    // The user keeps typing before the parent's navigation lands...
    await user.type(box(), " jenah");
    // ...and then it lands, carrying the older query.
    view.rerender(
      <UniversalSearch
        searchType="simchas"
        placeholder="Search…"
        initialQuery="guttman"
        onSearch={onSearch}
      />
    );

    expect(box()).toHaveValue("guttman jenah");
  });

  it("tells the user that Enter runs the search once the box diverges", async () => {
    vi.stubGlobal("fetch", mockSuggestions([]));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <UniversalSearch
        searchType="simchas"
        placeholder="Search…"
        initialQuery=""
        onSearch={() => {}}
      />
    );

    expect(screen.queryByText("Press Enter to search")).not.toBeInTheDocument();
    await user.type(box(), "guttman");
    await advance(350);
    expect(screen.getByText("Press Enter to search")).toBeInTheDocument();
  });

  it("does not show the hint when the parent cannot act on a submit", async () => {
    vi.stubGlobal("fetch", mockSuggestions([]));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    // No onSearch: this instance only navigates via suggestions.
    render(<UniversalSearch searchType="simchas" placeholder="Search…" initialQuery="" />);

    await user.type(box(), "guttman");
    await advance(350);
    expect(screen.queryByText("Press Enter to search")).not.toBeInTheDocument();
  });

  it("hides the hint once the query matches what is applied", async () => {
    vi.stubGlobal("fetch", mockSuggestions([]));
    render(
      <UniversalSearch
        searchType="simchas"
        placeholder="Search…"
        initialQuery="guttman"
        onSearch={() => {}}
      />
    );
    expect(screen.queryByText("Press Enter to search")).not.toBeInTheDocument();
  });

  it("navigates to a suggestion when one is clicked", async () => {
    vi.stubGlobal(
      "fetch",
      mockSuggestions([{ id: "1", title: "Guttman / Jenah", url: "/simchas/16549" }])
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<UniversalSearch searchType="simchas" placeholder="Search…" />);

    await user.type(box(), "guttman");
    await advance(350);

    const row = await waitFor(() => screen.getByText(/Jenah/));
    await user.click(row);
    expect(push).toHaveBeenCalledWith("/simchas/16549");
  });

  it("clears through the clear button and reports it to the parent", async () => {
    vi.stubGlobal("fetch", mockSuggestions([]));
    const onSearch = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <UniversalSearch
        searchType="simchas"
        placeholder="Search…"
        initialQuery="guttman"
        onSearch={onSearch}
      />
    );

    await user.click(screen.getByRole("button"));
    expect(box()).toHaveValue("");
    expect(onSearch).toHaveBeenCalledWith("");
  });
});
