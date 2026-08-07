// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommentThread } from "@/components/shared/CommentThread";

/**
 * The first test in this work that actually renders the component.
 *
 * Everything else verified routes and pure functions, which is why a browser
 * found three things the suite could not: a native `window.confirm`, and a
 * reply's Edit and Delete buttons sitting outside the flex row the top-level
 * comment uses. A route test cannot see either.
 */

const OWNER = 7;
const STRANGER = 8;

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { id: String(OWNER), role: "member", name: "Ada" } },
    status: "authenticated",
  }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const thread = [
  {
    id: 1,
    authorId: OWNER,
    authorName: "Ada Lovelace",
    content: "the parent",
    parentId: null,
    createdAt: new Date().toISOString(),
    editedAt: null,
    isDeleted: false,
  },
  {
    id: 2,
    authorId: OWNER,
    authorName: "Ada Lovelace",
    content: "the reply",
    parentId: 1,
    createdAt: new Date().toISOString(),
    editedAt: null,
    isDeleted: false,
  },
  {
    id: 3,
    authorId: STRANGER,
    authorName: "Someone Else",
    content: "not mine",
    parentId: null,
    createdAt: new Date("2020-03-01T15:00:00Z").toISOString(),
    editedAt: null,
    isDeleted: false,
  },
];

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(thread), { status: 200 }))
  );
  // If the component ever falls back to the native dialog, this catches it.
  vi.stubGlobal("confirm", vi.fn(() => true));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function renderThread() {
  render(<CommentThread apiBase="/api/blog/x/comments" />);
  await waitFor(() => expect(screen.getByText("the parent")).toBeTruthy());
}

describe("deleting", () => {
  it("opens the site dialog, NOT window.confirm", async () => {
    // The regression a browser caught: an OS-native alert on a styled site.
    await renderThread();

    const deletes = screen.getAllByRole("button", { name: "" });
    await userEvent.click(deletes[0]);

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).toBeTruthy()
    );
    expect(globalThis.confirm).not.toHaveBeenCalled();
  });

  it("warns that replies survive when the comment has them", async () => {
    await renderThread();

    const buttons = screen.getAllByRole("button");
    const parentDelete = buttons.find(
      (b) => b.querySelector("svg") && b.textContent === ""
    )!;
    await userEvent.click(parentDelete);

    await waitFor(() => {
      const dialog = screen.getByRole("alertdialog");
      // The old wording said only "Delete this comment?" — which was untrue
      // for a comment whose replies were about to outlive it.
      expect(dialog.textContent).toMatch(/replies/i);
    });
  });
});

describe("the reply's action row", () => {
  it("keeps Edit and Delete on one row, as the parent does", async () => {
    // My regression: Edit was added to replies as a bare sibling, so the two
    // buttons were not laid out as the row above them.
    await renderThread();

    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    // One on the parent, one on the reply — both mine.
    expect(editButtons.length).toBe(2);

    for (const edit of editButtons) {
      const row = edit.parentElement!;
      expect(row.className).toContain("flex");
      expect(row.className).toContain("items-center");
      // The delete button is its sibling, not adrift somewhere else.
      expect(row.querySelectorAll("button").length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("who sees what", () => {
  it("offers Edit only on your own comments", async () => {
    await renderThread();
    expect(screen.getAllByRole("button", { name: /edit/i })).toHaveLength(2);
    // Comment 3 belongs to someone else, so there is no third Edit.
  });

  it("offers Reply on the parent and not on the reply", async () => {
    // Nesting is capped at one level; the server refuses a reply to a reply,
    // so the button must not be offered.
    await renderThread();
    const replies = screen.getAllByRole("button", { name: /reply/i });
    expect(replies).toHaveLength(2); // the two top-level comments
  });
});

describe("timestamps", () => {
  it("shows a real date once a comment is older than a week", async () => {
    // "5 years ago" told a reader almost nothing, and the archive goes to 2005.
    await renderThread();
    expect(screen.getByText(/Mar 1, 2020/)).toBeTruthy();
  });

  it("keeps relative wording while a comment is fresh", async () => {
    await renderThread();
    expect(screen.getAllByText(/just now|minute|hour/i).length).toBeGreaterThan(0);
  });
});
