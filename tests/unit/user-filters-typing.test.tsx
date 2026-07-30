// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserFilters } from "../../src/components/admin/UserFilters";

/**
 * Regression test for characters disappearing while typing in the /admin/users
 * search box.
 *
 * Cause: echoing the URL back into a controlled input. The debounce pushed "ab",
 * the user typed "c" so local state held "abc", then the navigation committed and
 * a `setSearch(urlSearch)` sync overwrote "abc" with the older "ab" — eating the
 * "c".
 *
 * Reproducing it requires the navigation to commit AFTER the next keystroke.
 * A mock that applies the new URL synchronously inside router.replace cannot
 * express that ordering, and a test built that way passes even against the bug.
 * So `replace` here only records a pending URL; `commitNavigation()` applies it,
 * which lets each test place the commit exactly where the race happens.
 */

const nav = {
  params: new URLSearchParams(),
  pending: null as string | null,
  replaceCalls: [] as string[],
};

let rerender: (() => void) | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: (url: string) => {
      nav.replaceCalls.push(url);
      nav.pending = url; // deliberately NOT applied yet
    },
  }),
  useSearchParams: () => nav.params,
}));

/** Applies the pending URL and lets the subtree re-render, as Next would. */
function commitNavigation() {
  if (nav.pending === null) return;
  nav.params = new URLSearchParams(nav.pending.split("?")[1] ?? "");
  nav.pending = null;
  act(() => {
    rerender?.();
  });
}

function renderFilters() {
  const view = render(<UserFilters />);
  rerender = () => view.rerender(<UserFilters />);
}

function searchBox() {
  return screen.getByLabelText("Search users by name or email");
}

beforeEach(() => {
  nav.params = new URLSearchParams();
  nav.pending = null;
  nav.replaceCalls = [];
  rerender = null;
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

describe("UserFilters search input", () => {
  it("keeps a character typed while the previous navigation is still in flight", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderFilters();

    await user.type(searchBox(), "ab");
    await advance(350); // debounce fires -> replace("?search=ab"), not yet committed
    expect(nav.replaceCalls.at(-1)).toContain("search=ab");

    // The user keeps typing before the router commits.
    await user.type(searchBox(), "c");
    expect(searchBox()).toHaveValue("abc");

    // Now the older navigation lands. This is the moment the bug struck.
    commitNavigation();

    expect(searchBox()).toHaveValue("abc");
  });

  it("keeps all characters when commits land between every keystroke", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderFilters();

    for (const ch of "edelstein") {
      await user.type(searchBox(), ch);
      await advance(310);
      commitNavigation();
    }

    expect(searchBox()).toHaveValue("edelstein");
  });

  it("converges on the final text after a burst of typing", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderFilters();

    await user.type(searchBox(), "ro");
    await advance(350);
    await user.type(searchBox(), "ch");
    commitNavigation(); // stale "ro" arrives mid-word
    await user.type(searchBox(), "el");
    await advance(350);
    commitNavigation();

    expect(searchBox()).toHaveValue("rochel");
    expect(nav.params.get("search")).toBe("rochel");
  });

  it("still adopts an external navigation, such as Clear filters", () => {
    nav.params = new URLSearchParams("search=preset");
    renderFilters();
    expect(searchBox()).toHaveValue("preset");

    // Something outside the component changes the URL: back/forward, or the
    // "Clear filters" link. This must win, unlike our own echo.
    nav.params = new URLSearchParams();
    act(() => {
      rerender?.();
    });

    expect(searchBox()).toHaveValue("");
  });

  it("clears the page number when the search changes", async () => {
    nav.params = new URLSearchParams("page=7");
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderFilters();

    await user.type(searchBox(), "x");
    await advance(350);

    // Staying on page 7 of a different result set would show an empty page.
    expect(nav.replaceCalls.at(-1)).not.toContain("page=");
  });

  it("drops the search param entirely when the box is emptied", async () => {
    nav.params = new URLSearchParams("search=ab");
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderFilters();

    await user.clear(searchBox());
    await advance(350);
    commitNavigation();

    expect(nav.params.get("search")).toBeNull();
    expect(searchBox()).toHaveValue("");
  });
});
