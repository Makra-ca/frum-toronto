import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";
import type { NextRequest } from "next/server";

interface AuditPayload {
  actorId?: number | null;
  actorEmail: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "REJECT" | "PUBLISH" | "LOGIN";
  entityType: string;
  entityId?: number | null;
  entityTitle?: string | null;
  changes?: Record<string, { before: unknown; after: unknown }> | null;
  ipAddress?: string | null;
}

/**
 * Writes an entry to the audit log.
 * Failures are caught and logged — audit logging never fails an API request.
 */
export async function logAudit(payload: AuditPayload): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actorId: payload.actorId ?? null,
      actorEmail: payload.actorEmail,
      action: payload.action,
      entityType: payload.entityType,
      entityId: payload.entityId ?? null,
      entityTitle: payload.entityTitle ?? null,
      changes: payload.changes ?? null,
      ipAddress: payload.ipAddress ?? null,
    });
  } catch (error) {
    // Never let audit logging fail an API request
    console.error("[AUDIT] Failed to write audit log entry:", error);
  }
}

/**
 * Extracts the client IP address from a Next.js request.
 */
export function getIpFromRequest(request: Request | NextRequest): string {
  const forwarded = (request as NextRequest).headers?.get?.("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  const realIp = (request as NextRequest).headers?.get?.("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}
