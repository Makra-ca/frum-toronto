import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { assertCanPost } from "@/lib/auth/require-verified";
import {
  notifyAdminOfSubmission,
  notifyAdminOfTrustedEdit,
  type SubmissionContentType,
} from "@/lib/notifications";
import { applyEdit, SubmissionEditError } from "@/lib/submissions/apply-edit";
import { canEditRow } from "@/lib/submissions/ownership";
import { SUBMISSION_TYPES, type SubmissionType } from "@/lib/submissions/types";
import { SUBMISSION_EDIT_SCHEMAS } from "@/lib/validations/submission-edits";

/**
 * GET and PATCH for a submitter's own item, for every type except events.
 *
 * Events keep their own route: they carry a shul link, a conflict check and a
 * different validation schema, and folding that in would make this handler
 * branch on type — which is what having a shared handler is meant to avoid.
 *
 * The six mandatory steps from the spec: 401 unauthenticated, assertCanPost,
 * 403 for non-owners (NULL owner is unowned), field whitelist, shared status
 * resolution, and a conditional write that 409s. Steps 3 to 6 are applyEdit's;
 * the first two need the session and live here.
 */

interface RouteConfig {
  /** How the admin notification is filed. */
  contentType: SubmissionContentType;
  /** Public pages whose cache must be dropped when this changes. */
  revalidate: (id: number) => string[];
}

const ROUTE_CONFIG: Record<Exclude<SubmissionType, "event" | "blog">, RouteConfig> = {
  classified: {
    contentType: "classified",
    revalidate: (id) => ["/classifieds", `/classifieds/${id}`],
  },
  simcha: {
    contentType: "simcha",
    revalidate: (id) => ["/simchas", `/simchas/${id}`],
  },
  kosherAlert: {
    contentType: "kosher_alert",
    revalidate: () => ["/kosher-alerts"],
  },
  alert: {
    contentType: "community_alert",
    revalidate: () => ["/alerts"],
  },
  tehillim: {
    contentType: "tehillim",
    // /community/tehillim, not /tehillim — the latter is not a route, and
    // revalidatePath does not error on a path that matches nothing.
    revalidate: () => ["/community/tehillim"],
  },
  shiva: {
    contentType: "shiva",
    revalidate: () => ["/shiva"],
  },
};

export type EditableRouteType = keyof typeof ROUTE_CONFIG;

type AnyTable = PgTable & Record<string, PgColumn>;

/** The submitter's own copy, for populating the edit form. */
export async function handleSubmissionGet(
  type: EditableRouteType,
  params: Promise<{ id: string }>
) {
  const { id } = await params;
  const rowId = parseInt(id);
  if (Number.isNaN(rowId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const table = SUBMISSION_TYPES[type].table as AnyTable;
  const [row] = (await db
    .select()
    .from(table)
    .where(eq(table.id, rowId))
    .limit(1)) as unknown as Record<string, unknown>[];

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // The SAME check PATCH runs. An owner-only check here would refuse someone
  // the form for something they are allowed to save.
  const mayEdit = await canEditRow(
    type,
    row,
    parseInt(session.user.id),
    session.user.role
  );

  if (!mayEdit) {
    return NextResponse.json(
      { error: "You can only edit things you submitted" },
      { status: 403 }
    );
  }

  return NextResponse.json(row);
}

export async function handleSubmissionEdit(
  type: EditableRouteType,
  request: Request,
  params: Promise<{ id: string }>
) {
  try {
    const { id } = await params;
    const rowId = parseInt(id);
    if (Number.isNaN(rowId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // The same gate as creating: verified, and not blocked.
    const notAllowed = await assertCanPost(session.user.id);
    if (notAllowed) return notAllowed;

    const body = await request.json();
    const parsed = SUBMISSION_EDIT_SCHEMAS[type].safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const config = SUBMISSION_TYPES[type];
    const routeConfig = ROUTE_CONFIG[type];

    const table = SUBMISSION_TYPES[type].table as PgTable & Record<string, PgColumn>;
    const [before] = (await db
      .select()
      .from(table)
      .where(eq(table.id, rowId))
      .limit(1)) as unknown as Record<string, unknown>[];

    const result = await applyEdit(
      type,
      rowId,
      parseInt(session.user.id),
      parsed.data as Record<string, unknown>,
      session.user.role
    );

    const editorName = session.user.name || session.user.email || "Unknown user";
    const stillLive = result.status === "approved";

    // Every branch reads the RESOLVED status. An auto-approver's item never
    // leaves the site, and saying otherwise is a lie the UI repeats back.
    await notifyAdminOfSubmission({
      contentType: routeConfig.contentType,
      title: `${config.label} edited by submitter`,
      body:
        `Edited by: ${editorName}\n` +
        (result.wasUnpublished
          ? "This was live and has been taken off the site pending re-approval."
          : stillLive
            ? "This stayed live — the editor has auto-approve for this type."
            : "This was already awaiting approval."),
      linkUrl: "/admin/approvals",
      status: stillLive ? "auto_approved" : "pending",
      replyTo: session.user.email ?? undefined,
    });

    // The spec's mitigation for letting auto-approvers' edits stay live: an
    // in-app trail when already-public content changes without review.
    if (stillLive) {
      await notifyAdminOfTrustedEdit({
        typeLabel: config.label,
        // The row's own title. Passing the id made every trail entry read
        // "Simcha edited while live — 4211", which tells an admin nothing.
        itemTitle: String(before?.[config.titleColumn] ?? rowId),
        editorName,
        linkUrl: "/admin/approvals",
      });
    }

    for (const path of routeConfig.revalidate(rowId)) {
      revalidatePath(path);
    }

    return NextResponse.json({
      ...result,
      message: result.wasUnpublished
        ? "Your changes were saved. This has been removed from the site until an admin re-approves it."
        : stillLive
          ? "Your changes were saved and this is still on the site."
          : "Your changes were saved. This is still awaiting approval.",
    });
  } catch (error) {
    if (error instanceof SubmissionEditError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(`[API] Error editing ${type}:`, error);
    return NextResponse.json(
      { error: "Failed to save your changes" },
      { status: 500 }
    );
  }
}
