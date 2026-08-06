import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { and, eq, ne, or, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { logAudit, getIpFromRequest } from "@/lib/audit";
import { wouldRemoveLastAdmin } from "@/lib/permissions/last-admin";
import { canDeleteUser } from "@/lib/admin/user-deletion-guards";
import {
  inventoryUserContent,
  deleteUserWithContent,
} from "@/lib/admin/user-deletion";

export const dynamic = "force-dynamic";

/**
 * This route had no schema at all: every field was destructured off the body
 * and written raw. `role` in particular was an unvalidated string, so a typo
 * (or a crafted request) could store "Admin", "administrator" or anything else.
 * Every check in the codebase compares `role === "admin"` exactly, so a bad
 * value fails closed rather than escalating — it locks the account out of
 * everything instead, which is still a real way to lose an admin.
 *
 * The values here are exactly the ones the admin UI offers
 * (`UserTable.tsx`). `commentPermission` additionally accepts "moderated",
 * which `resolveCommentApprovalStatus` handles and older rows may carry.
 */
const ROLES = ["member", "business", "shul", "content_contributor", "admin"] as const;

const updateUserSchema = z.object({
  role: z.enum(ROLES).optional(),
  isTrusted: z.boolean().optional(),
  isActive: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
  canAutoApproveShiva: z.boolean().optional(),
  canAutoApproveTehillim: z.boolean().optional(),
  canAutoApproveBusinesses: z.boolean().optional(),
  canAutoApproveAskTheRabbi: z.boolean().optional(),
  canAutoApproveKosherAlerts: z.boolean().optional(),
  canAutoApproveShuls: z.boolean().optional(),
  canAutoApproveSimchas: z.boolean().optional(),
  canAutoApproveEvents: z.boolean().optional(),
  canAutoApproveClassifieds: z.boolean().optional(),
  canAutoApproveShiurim: z.boolean().optional(),
  canAutoApproveAlerts: z.boolean().optional(),
  canAutoApproveBlog: z.boolean().optional(),
  canPostSpecials: z.boolean().optional(),
  canManageAskTheRabbi: z.boolean().optional(),
  commentPermission: z
    .enum(["allowed", "moderated", "requires_approval", "blocked"])
    .optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const targetId = parseInt(id);
    if (!Number.isSafeInteger(targetId) || targetId <= 0) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const {
      role,
      isTrusted,
      isActive,
      emailVerified,
      canAutoApproveShiva,
      canAutoApproveTehillim,
      canAutoApproveBusinesses,
      canAutoApproveAskTheRabbi,
      canAutoApproveKosherAlerts,
      canAutoApproveShuls,
      canAutoApproveSimchas,
      canAutoApproveEvents,
      canAutoApproveClassifieds,
      canAutoApproveShiurim,
      canAutoApproveAlerts,
      canAutoApproveBlog,
      canPostSpecials,
      canManageAskTheRabbi,
      commentPermission,
    } = parsed.data;

    // Read the row before the write: needed for the last-admin guard, and for
    // the audit entry's before/after diff.
    const [before] = await db
      .select()
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1);

    if (!before) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Demoting or disabling the LAST active admin locks everybody out of
    // /admin permanently — see src/lib/permissions/last-admin.ts. Only counted
    // when the request could actually cause it, so the ordinary case adds no
    // query.
    if (before.role === "admin" && before.isActive !== false) {
      const [remaining] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(users)
        .where(
          and(
            eq(users.role, "admin"),
            or(eq(users.isActive, true), isNull(users.isActive)),
            ne(users.id, targetId)
          )
        );

      if (
        wouldRemoveLastAdmin({
          targetIsAdmin: true,
          targetIsActive: true,
          otherActiveAdmins: Number(remaining?.n ?? 0),
          nextRole: role,
          nextIsActive: isActive,
        })
      ) {
        return NextResponse.json(
          {
            error:
              "This is the only active admin account. Promote another admin before changing this one.",
          },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (role !== undefined) updateData.role = role;
    if (isTrusted !== undefined) updateData.isTrusted = isTrusted;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (emailVerified !== undefined) {
      updateData.emailVerified = emailVerified ? new Date() : null;
    }
    // Auto-approve permissions
    if (canAutoApproveShiva !== undefined) updateData.canAutoApproveShiva = canAutoApproveShiva;
    if (canAutoApproveTehillim !== undefined) updateData.canAutoApproveTehillim = canAutoApproveTehillim;
    if (canAutoApproveBusinesses !== undefined) updateData.canAutoApproveBusinesses = canAutoApproveBusinesses;
    if (canAutoApproveAskTheRabbi !== undefined) updateData.canAutoApproveAskTheRabbi = canAutoApproveAskTheRabbi;
    if (canAutoApproveKosherAlerts !== undefined) updateData.canAutoApproveKosherAlerts = canAutoApproveKosherAlerts;
    if (canAutoApproveShuls !== undefined) updateData.canAutoApproveShuls = canAutoApproveShuls;
    if (canAutoApproveSimchas !== undefined) updateData.canAutoApproveSimchas = canAutoApproveSimchas;
    if (canAutoApproveEvents !== undefined) updateData.canAutoApproveEvents = canAutoApproveEvents;
    if (canAutoApproveClassifieds !== undefined) updateData.canAutoApproveClassifieds = canAutoApproveClassifieds;
    if (canAutoApproveShiurim !== undefined) updateData.canAutoApproveShiurim = canAutoApproveShiurim;
    if (canAutoApproveAlerts !== undefined) updateData.canAutoApproveAlerts = canAutoApproveAlerts;
    // Both halves matter: the dialog alone would flip a switch the API drops,
    // and the toast would still say saved.
    if (canAutoApproveBlog !== undefined) updateData.canAutoApproveBlog = canAutoApproveBlog;
    if (canPostSpecials !== undefined) updateData.canPostSpecials = canPostSpecials;
    if (canManageAskTheRabbi !== undefined) updateData.canManageAskTheRabbi = canManageAskTheRabbi;
    if (commentPermission !== undefined) updateData.commentPermission = commentPermission;

    await db.update(users).set(updateData).where(eq(users.id, targetId));

    // `logAudit` existed with zero callers, so the audit_log table and its
    // admin page recorded nothing at all — which is why the privilege
    // escalation fixed in ad81bdb left no reconstructible trail. This is the
    // first call site, and it is the right one: every grant, demotion and block
    // in the system passes through here.
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const [key, after] of Object.entries(updateData)) {
      if (key === "updatedAt") continue;
      const prior = (before as Record<string, unknown>)[key];
      // emailVerified is a Date in the row and a Date|null in the update, so
      // compare on presence rather than value — a re-verify is not a change.
      const priorValue = key === "emailVerified" ? prior !== null : prior;
      const afterValue = key === "emailVerified" ? after !== null : after;
      if (priorValue !== afterValue) {
        changes[key] = { before: priorValue, after: afterValue };
      }
    }

    if (Object.keys(changes).length > 0) {
      await logAudit({
        actorId: session.user.id ? parseInt(session.user.id) : null,
        actorEmail: session.user.email ?? "unknown",
        action: "UPDATE",
        entityType: "user",
        entityId: targetId,
        entityTitle: before.email,
        changes,
        ipAddress: getIpFromRequest(request),
      });
    }

    return NextResponse.json({ message: "User updated successfully" });
  } catch (error) {
    console.error("Failed to update user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/[id]
 *
 * Three-step by design, because deletion is irreversible and 19 foreign keys
 * would otherwise turn a delete button into an error toast:
 *
 *   no ?mode      -> DRY RUN. Counts what the account owns. Writes nothing.
 *                    Returns 200 with an empty inventory when the account is
 *                    clean, or 409 WITH the inventory when it is not — so the
 *                    UI can show the admin exactly what is at stake before
 *                    asking a second time.
 *   ?mode=reassign -> blog posts and comments move to the Archive account,
 *                    every other owner reference is cleared, then delete.
 *   ?mode=purge    -> the account's content is deleted, then the account.
 *
 * Every path writes an audit row, refusals included — "who tried to delete
 * whom" is worth as much as "who did".
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const targetId = parseInt(id);
    if (!Number.isSafeInteger(targetId) || targetId <= 0) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    const actorId = session.user.id ? parseInt(session.user.id) : null;
    const actorEmail = session.user.email ?? "unknown";
    const ipAddress = getIpFromRequest(request);

    const [target] = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1);

    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const verdict = canDeleteUser({
      targetId,
      targetRole: target.role,
      actorId: actorId ?? -1,
    });

    if (!verdict.allowed) {
      await logAudit({
        actorId,
        actorEmail,
        action: "DELETE",
        entityType: "user",
        entityId: targetId,
        entityTitle: target.email,
        changes: { refused: { before: null, after: verdict.reason } },
        ipAddress,
      });
      return NextResponse.json({ error: verdict.reason }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    if (mode !== "reassign" && mode !== "purge") {
      // Dry run. Nothing is written, including no audit row — an admin opening
      // a dialog and closing it again is not an event.
      const inventory = await inventoryUserContent(targetId);

      if (inventory.totalOwned > 0) {
        return NextResponse.json(
          {
            error: "This account owns content. Choose what happens to it.",
            requiresMode: true,
            email: target.email,
            ...inventory,
          },
          { status: 409 }
        );
      }

      return NextResponse.json({ email: target.email, ...inventory });
    }

    const inventory = await deleteUserWithContent(targetId, mode);

    await logAudit({
      actorId,
      actorEmail,
      action: "DELETE",
      entityType: "user",
      entityId: targetId,
      entityTitle: target.email,
      // The inventory as it stood BEFORE the delete — afterwards there is
      // nothing left to count, and this is the only record of what went.
      changes: {
        mode: { before: null, after: mode },
        content: { before: inventory.owned, after: null },
        destroyed: { before: inventory.destroyed, after: null },
      },
      ipAddress,
    });

    return NextResponse.json({
      message: "User deleted",
      email: target.email,
      mode,
      ...inventory,
    });
  } catch (error) {
    console.error("Failed to delete user:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
