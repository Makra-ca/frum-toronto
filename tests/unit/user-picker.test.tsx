// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserPicker, type PickableUser } from "../../src/components/admin/UserPicker";

const ROCHEL: PickableUser = {
  id: 9,
  email: "rochel@frumtoronto.com",
  firstName: "Rochel",
  lastName: "R",
  role: "member",
};
const AHUVA: PickableUser = {
  id: 768,
  email: "ahuva@jacstoronto.org",
  firstName: "Ahuva",
  lastName: "Edell",
  role: "member",
};

/** Resolves the next fetch with the given rows, optionally after a delay. */
function mockFetchSequence(responses: { rows: PickableUser[]; delayMs?: number }[]) {
  let call = 0;
  return vi.fn((_url: string, init?: RequestInit) => {
    const resp = responses[Math.min(call, responses.length - 1)];
    call++;
    return new Promise((resolve, reject) => {
      const signal = init?.signal;
      const timer = setTimeout(
        () => resolve({ ok: true, status: 200, json: async () => ({ data: resp.rows }) }),
        resp.delayMs ?? 0
      );
      signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        const err = new Error("aborted");
        err.name = "AbortError";
        reject(err);
      });
    });
  });
}

beforeEach(() => {
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

describe("UserPicker", () => {
  it("keeps every character typed, even as requests resolve", async () => {
    vi.stubGlobal("fetch", mockFetchSequence([{ rows: [ROCHEL] }]));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<UserPicker value={null} onChange={() => {}} />);

    const input = screen.getByRole("combobox");
    await user.type(input, "roc");
    await advance(350);
    await user.type(input, "hel");
    await advance(350);

    // Local state is the only source of truth here, so nothing can clobber it.
    expect(input).toHaveValue("rochel");
  });

  it("shows matches and selects one, reporting it to the caller", async () => {
    vi.stubGlobal("fetch", mockFetchSequence([{ rows: [AHUVA] }]));
    const onChange = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<UserPicker value={null} onChange={onChange} />);

    await user.type(screen.getByRole("combobox"), "edell");
    await advance(350);

    const option = await waitFor(() => screen.getByText("Ahuva"));
    await user.click(option);

    expect(onChange).toHaveBeenCalledWith(AHUVA);
    expect(screen.getByRole("combobox")).toHaveValue(
      "Ahuva Edell (ahuva@jacstoronto.org)"
    );
  });

  it("invalidates the selection when the text is edited afterwards", async () => {
    vi.stubGlobal("fetch", mockFetchSequence([{ rows: [AHUVA] }]));
    const onChange = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    // Start already holding a selection, as the dialog does after a pick.
    render(<UserPicker value={AHUVA} onChange={onChange} />);

    await user.type(screen.getByRole("combobox"), "x");

    // Submitting a stale id while the field reads something else would assign
    // the wrong person, so editing must clear the selection.
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("does not let a slow earlier response overwrite a newer one", async () => {
    // First query is slow and would land last; the abort must discard it.
    vi.stubGlobal(
      "fetch",
      mockFetchSequence([
        // 2000ms so this stale response cannot possibly resolve before the
        // second request. With a shorter delay it lands first and the
        // out-of-order race the test exists to catch never happens.
        { rows: [ROCHEL], delayMs: 2000 },
        { rows: [AHUVA], delayMs: 0 },
      ])
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<UserPicker value={null} onChange={() => {}} />);

    const input = screen.getByRole("combobox");
    await user.type(input, "ro");
    await advance(350); // fires the slow request

    await user.type(input, "!!");
    await advance(350); // fires the fast request, aborting the slow one
    await advance(2500); // the slow one's timer would fire by now if not aborted

    // Matched on the email with a regex rather than an exact name match: when
    // the query highlights nothing, the name renders as a single text node
    // ("Ahuva Edell"), so an exact getByText("Ahuva") would not find it.
    await waitFor(() =>
      expect(screen.getByText(/ahuva@jacstoronto\.org/)).toBeInTheDocument()
    );
    expect(screen.queryByText(/rochel@frumtoronto\.com/)).not.toBeInTheDocument();
  });

  it("closes the dropdown on Escape", async () => {
    vi.stubGlobal("fetch", mockFetchSequence([{ rows: [AHUVA] }]));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<UserPicker value={null} onChange={() => {}} />);

    const input = screen.getByRole("combobox");
    await user.type(input, "edell");
    await advance(350);
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("selects with the keyboard", async () => {
    vi.stubGlobal("fetch", mockFetchSequence([{ rows: [AHUVA, ROCHEL] }]));
    const onChange = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<UserPicker value={null} onChange={onChange} />);

    await user.type(screen.getByRole("combobox"), "to");
    await advance(350);
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());

    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith(ROCHEL);
  });
});
