import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resolveApprovalStatus } from "@/lib/submissions/auto-approve";
import type { ApprovalStatus } from "@/lib/submissions/statuses";

/**
 * Editing an event you submitted yourself.
 *
 * Policy: an edit to an already-approved event unpublishes it for re-review —
 * as `pending_edit`, never `pending`. Every broadcast guard fires on
 * `pending → approved`, so `pending` would mean a corrected typo re-emails the
 * entire subscriber list the moment an admin re-approves.
 *
 * An auto-approver's edit stays live. The status is resolved by the SAME helper
 * the create path uses, because this function used to set `pending`
 * unconditionally without ever loading the user row — so an admin or trusted
 * user editing their own live event self-unpublished it and had to ask someone
 * else to restore it. The permission means "your posts go live without review";
 * the edit path was silently revoking it.
 *
 * Kept out of the route handler so the ownership and re-approval rules can be
 * tested without going through HTTP or next-auth.
 */

export class EventEditError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "EventEditError";
  }
}

/** Fields a submitter is allowed to change. Anything else is ignored. */
const EDITABLE_FIELDS = [
  "title",
  "description",
  "location",
  "startTime",
  "endTime",
  "isAllDay",
  "eventType",
  "contactName",
  "contactEmail",
  "contactPhone",
  "cost",
  "organization",
  "websiteUrl",
  "flyerUrl",
  "imageUrl",
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number];
export type EventEditInput = Partial<Record<EditableField, unknown>>;

export interface EventEditResult {
  id: number;
  /** The status the edit landed on, resolved the same way a create is. */
  status: ApprovalStatus;
  /** True when the edit pulled a live event off the calendar for re-review. */
  wasUnpublished: boolean;
}

export async function applyEventEdit(
  eventId: number,
  userId: number,
  input: EventEditInput,
  role?: string
): Promise<EventEditResult> {
  const [existing] = await db
    .select({
      id: events.id,
      userId: events.userId,
      approvalStatus: events.approvalStatus,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!existing) {
    throw new EventEditError("Event not found", 404);
  }

  // An event with no userId came from the legacy import or an admin, so it has
  // no submitter who could own it.
  if (existing.userId === null || existing.userId !== userId) {
    throw new EventEditError("You can only edit events you submitted", 403);
  }

  // Whitelist, so a hostile client cannot reassign userId or self-approve by
  // posting extra keys.
  const updates: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in input && input[field] !== undefined) {
      updates[field] = input[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new EventEditError("No editable fields supplied", 400);
  }

  const status = await resolveApprovalStatus(
    "event",
    userId,
    role,
    existing.approvalStatus
  );

  // Only true when the edit actually took something off the calendar. An
  // auto-approver's event stays live, and telling them otherwise would be a
  // lie the UI then repeats back to them.
  const wasUnpublished =
    existing.approvalStatus === "approved" && status !== "approved";

  updates.approvalStatus = status;

  await db.update(events).set(updates).where(eq(events.id, eventId));

  return { id: eventId, status, wasUnpublished };
}
