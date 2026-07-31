// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubmissionEditForm } from "@/components/submissions/SubmissionEditForm";
import { EDIT_FORMS, liveWarningFor } from "@/lib/submissions/edit-form-fields";

/**
 * The edit form's two load-bearing behaviours: warning before the user commits
 * to unpublishing, and round-tripping a stored calendar day untouched.
 */

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));
const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (m: string) => toastError(m), success: (m: string) => toastSuccess(m) },
}));

function mockApi(
  row: Record<string, unknown>,
  patchResponse?: { ok?: boolean; status?: number; body?: unknown }
) {
  global.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") {
      return {
        ok: patchResponse?.ok ?? true,
        status: patchResponse?.status ?? 200,
        json: async () => patchResponse?.body ?? { message: "Saved" },
      };
    }
    return { ok: true, status: 200, json: async () => row };
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SubmissionEditForm", () => {
  it("calls the endpoint its spec names", async () => {
    // spec.folder is the only thing binding the form to its API route, and
    // nothing asserted it — a form pointed at /api/community/wrong/1 passed
    // every other test in this file.
    mockApi({ approvalStatus: "pending", niftarName: "x", mournerNames: [] });

    render(<SubmissionEditForm spec={EDIT_FORMS.shiva} id={42} />);

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith("/api/community/shiva/42")
    );
  });

  it("warns before saving when the item is live", async () => {
    mockApi({ approvalStatus: "approved", familyName: "Cohen", announcement: "x" });

    render(<SubmissionEditForm spec={EDIT_FORMS.simcha} id={1} />);

    expect(
      await screen.findByText(liveWarningFor(EDIT_FORMS.simcha))
    ).toBeDefined();
  });

  it("says nothing about unpublishing when nothing is published", async () => {
    mockApi({ approvalStatus: "pending", familyName: "Cohen", announcement: "x" });

    render(<SubmissionEditForm spec={EDIT_FORMS.simcha} id={1} />);

    await screen.findByLabelText(/Family name/);
    expect(screen.queryByText(/takes it down/)).toBeNull();
  });

  it("gives shiva its stronger warning, not the standard one", async () => {
    mockApi({ approvalStatus: "approved", niftarName: "[TEST]", mournerNames: [] });

    render(<SubmissionEditForm spec={EDIT_FORMS.shiva} id={1} />);

    const warning = await screen.findByText(liveWarningFor(EDIT_FORMS.shiva));
    expect(warning.textContent).toContain("during a shiva");
  });

  it("round-trips a stored calendar day untouched", async () => {
    // The whole date-shift class of bug in one assertion: the 22nd goes in and
    // the 22nd is what the control holds.
    mockApi({
      approvalStatus: "pending",
      familyName: "Cohen",
      announcement: "x",
      eventDate: "2027-06-22",
    });

    render(<SubmissionEditForm spec={EDIT_FORMS.simcha} id={1} />);

    const input = (await screen.findByLabelText(/^Date/)) as HTMLInputElement;
    expect(input.value).toBe("2027-06-22");
    expect(input.type).toBe("date");
  });

  it("sends a cleared optional field as null rather than an empty string", async () => {
    mockApi({ approvalStatus: "pending", familyName: "Cohen", announcement: "x", location: "Hall" });

    render(<SubmissionEditForm spec={EDIT_FORMS.simcha} id={1} />);
    const location = (await screen.findByLabelText(/Location/)) as HTMLInputElement;
    await userEvent.clear(location);
    await userEvent.click(screen.getByRole("button", { name: /Save changes/ }));

    // Found by method, not by index — the form also fetches lookup options,
    // so the PATCH is not reliably the second call.
    const patchCall = await waitFor(() => {
      const found = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
        (c) => (c[1] as RequestInit | undefined)?.method === "PATCH"
      );
      expect(found).toBeDefined();
      return found!;
    });
    const sent = JSON.parse((patchCall[1] as RequestInit).body as string);
    // "" would store an empty string where the column means "not given".
    expect(sent.location).toBeNull();
  });

  it("shows the conflict message instead of a generic failure", async () => {
    // A 409 tells the user someone reviewed it while they were editing and to
    // reload. Replacing that with "Could not save" loses the only instruction.
    mockApi(
      { approvalStatus: "pending", familyName: "Cohen", announcement: "x" },
      { ok: false, status: 409, body: { error: "Someone reviewed this while you were editing." } }
    );

    render(<SubmissionEditForm spec={EDIT_FORMS.simcha} id={1} />);
    await screen.findByLabelText(/Family name/);
    await userEvent.click(screen.getByRole("button", { name: /Save changes/ }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Someone reviewed this while you were editing."
      )
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("surfaces a refusal to load rather than showing an empty form", async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ error: "You can only edit things you submitted" }),
    })) as unknown as typeof fetch;

    render(<SubmissionEditForm spec={EDIT_FORMS.simcha} id={1} />);

    expect(
      await screen.findByText("You can only edit things you submitted")
    ).toBeDefined();
    expect(screen.queryByLabelText(/Family name/)).toBeNull();
  });
});
