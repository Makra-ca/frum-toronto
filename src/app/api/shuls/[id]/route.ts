import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { shuls, daveningSchedules } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { canUserManageShul } from "@/lib/auth/permissions";
import { notifyAdminOfSubmission } from "@/lib/notifications";
import { normalizeExternalUrl } from "@/lib/safe-url";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * This route previously wrote `body.*` straight into the update with no
 * validation of any kind. Combined with the public shul page rendering
 * `href={shul.website}` raw, and this route's own "edits go live without review"
 * behaviour, a shul manager could store `javascript:...` and have it become a
 * clickable link on a public page.
 *
 * `website` is deliberately a plain string here, not `z.string().url()`:
 *  - `.url()` REJECTS "myshul.com", which is what people actually type, and
 *  - `.url()` ACCEPTS "javascript:alert(1)", because it is `new URL()` underneath.
 *
 * It is normalised through `normalizeExternalUrl` below instead, which adds the
 * missing scheme and rejects unsafe ones.
 */
const shulUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().max(5000).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email("Enter a valid email address").max(255).optional().nullable().or(z.literal("")),
  website: z.string().max(255).optional().nullable(),
  rabbi: z.string().max(200).optional().nullable(),
  denomination: z.string().max(50).optional().nullable(),
  nusach: z.string().max(50).optional().nullable(),
  hasMinyan: z.boolean().optional(),
});

// GET shul details (for shul managers)
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const shulId = parseInt(id);
    const userId = parseInt(session.user.id);

    // Check permissions
    const canManage = await canUserManageShul(userId, shulId, session.user.role);
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get shul
    const [shul] = await db
      .select()
      .from(shuls)
      .where(eq(shuls.id, shulId))
      .limit(1);

    if (!shul) {
      return NextResponse.json({ error: "Shul not found" }, { status: 404 });
    }

    // Get davening schedules
    const schedules = await db
      .select()
      .from(daveningSchedules)
      .where(eq(daveningSchedules.shulId, shulId));

    return NextResponse.json({ ...shul, daveningSchedules: schedules });
  } catch (error) {
    console.error("Failed to fetch shul:", error);
    return NextResponse.json(
      { error: "Failed to fetch shul" },
      { status: 500 }
    );
  }
}

// PUT update shul (for shul managers)
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const shulId = parseInt(id);
    const userId = parseInt(session.user.id);

    // Check permissions
    const canManage = await canUserManageShul(userId, shulId, session.user.role);
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const result = shulUpdateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }
    const data = result.data;

    // Reject an unusable website rather than silently storing null — dropping
    // what someone typed without telling them is a decision made on their behalf.
    const rawWebsite = data.website?.trim();
    const website = rawWebsite ? normalizeExternalUrl(rawWebsite) : null;
    if (rawWebsite && !website) {
      return NextResponse.json(
        { error: "Enter a valid website address, e.g. myshul.com or https://myshul.com" },
        { status: 400 }
      );
    }

    // Update shul directly (no more business table)
    await db
      .update(shuls)
      .set({
        name: data.name,
        description: data.description,
        address: data.address,
        city: data.city,
        postalCode: data.postalCode,
        phone: data.phone,
        email: data.email || null,
        website,
        rabbi: data.rabbi,
        denomination: data.denomination,
        nusach: data.nusach,
        hasMinyan: data.hasMinyan,
        updatedAt: new Date(),
      })
      .where(eq(shuls.id, shulId));

    // Notify admins (Tier C FYI — shul manager edits go live without review)
    await notifyAdminOfSubmission({
      contentType: "shul_edit",
      title: `Shul details updated: ${data.name || `Shul #${shulId}`}`,
      body:
        `Shul: ${data.name || `#${shulId}`}\n` +
        `Updated by: ${session.user.name || session.user.email || "Unknown user"}`,
      linkUrl: "/admin/shuls",
      status: "auto_approved",
    });

    return NextResponse.json({ message: "Shul updated successfully" });
  } catch (error) {
    console.error("Failed to update shul:", error);
    return NextResponse.json(
      { error: "Failed to update shul" },
      { status: 500 }
    );
  }
}
