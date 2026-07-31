// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import SubmissionsPage from "@/app/(dashboard)/dashboard/submissions/page";
import type { Submission } from "@/lib/submissions/list-query";

/**
 * The page's job is to pick a formatter per row.
 *
 * `formatSubmissionDetail` being correct proves nothing about the page calling
 * it: inlining `formatInstant` here would render every simcha and shiva notice
 * a day early with the whole unit suite green. That is the exact regression
 * the detailKind mechanism exists to prevent, so it is tested where it can
 * actually happen.
 */

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

function submission(overrides: Partial<Submission>): Submission {
  return {
    id: 1,
    type: "event",
    typeLabel: "Event",
    title: "[TEST] item",
    detail: null,
    detailKind: "instant",
    approvalStatus: "approved",
    rejectionReason: null,
    isPast: false,
    canEdit: true,
    createdAt: "2026-07-30T12:00:00.000Z",
    editHref: "/dashboard/submissions/events/1/edit",
    publicHref: null,
    ...overrides,
  };
}

function mockList(submissions: Submission[]) {
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ submissions }),
  })) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("submissions page", () => {
  it("renders a date-only row on the day it stores", async () => {
    // The stored day is the 22nd. Through an instant formatter this reads the
    // 21st for a Toronto viewer.
    mockList([
      submission({
        id: 7,
        type: "simcha",
        typeLabel: "Simcha",
        title: "[TEST] Cohen",
        detail: "2027-06-22",
        detailKind: "date",
      }),
    ]);

    render(<SubmissionsPage />);

    expect(await screen.findByText(/Jun 22, 2027/)).toBeDefined();
    expect(screen.queryByText(/Jun 21, 2027/)).toBeNull();
  });

  it("renders an instant row in Toronto time", async () => {
    mockList([
      submission({ detail: "2027-06-22T00:30:00.000Z", detailKind: "instant" }),
    ]);

    render(<SubmissionsPage />);

    // 00:30 UTC is 8:30pm the previous evening in Toronto.
    expect(await screen.findByText(/Jun 21, 2027/)).toBeDefined();
  });

  it("gives a corrected item its own wording, not the raw status", async () => {
    mockList([submission({ approvalStatus: "pending_edit" })]);

    render(<SubmissionsPage />);

    expect(await screen.findByText("Awaiting re-approval")).toBeDefined();
    expect(screen.queryByText("pending_edit")).toBeNull();
  });

  it("shows the admin's reason on a rejected row", async () => {
    mockList([
      submission({
        approvalStatus: "rejected",
        rejectionReason: "Clashes with an existing listing",
        canEdit: true,
      }),
    ]);

    render(<SubmissionsPage />);

    expect(
      await screen.findByText("Clashes with an existing listing")
    ).toBeDefined();
    // The action has to say what it does — resubmitting, not just editing.
    expect(screen.getByText("Edit & resubmit")).toBeDefined();
  });

  it("writes fallback copy when an admin rejected without a reason", async () => {
    mockList([submission({ approvalStatus: "rejected", rejectionReason: null })]);

    render(<SubmissionsPage />);

    expect(await screen.findByText(/Reply to the email/)).toBeDefined();
  });

  it("hides past items until asked", async () => {
    mockList([
      submission({ id: 1, title: "[TEST] current", isPast: false }),
      submission({ id: 2, title: "[TEST] finished", isPast: true }),
    ]);

    render(<SubmissionsPage />);

    expect(await screen.findByText("[TEST] current")).toBeDefined();
    expect(screen.queryByText("[TEST] finished")).toBeNull();
    // And the toggle says how many are hidden, so nothing looks lost.
    expect(screen.getByText(/Show past submissions \(1\)/)).toBeDefined();
  });

  it("offers no edit action when the item cannot be edited", async () => {
    mockList([submission({ canEdit: false, editHref: null })]);

    render(<SubmissionsPage />);

    await waitFor(() => expect(screen.getByText("[TEST] item")).toBeDefined());
    expect(screen.queryByText("Edit")).toBeNull();
  });
});
