import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { formEmailRecipients } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

// Form types available for configuration
export const FORM_TYPES = [
  { value: "ask_the_rabbi", label: "Ask the Rabbi Submissions" },
  { value: "contact_form", label: "Contact Form" },
  { value: "business_registration", label: "Business Registration Requests" },
  { value: "shul_registration", label: "Shul Registration Requests" },
  { value: "event_submission", label: "Event Submissions" },
  { value: "classified_submission", label: "Classified Submissions" },
] as const;

const recipientSchema = z.object({
  formType: z.string().min(1, "Form type is required"),
  email: z.string().email("Valid email is required"),
  name: z.string().optional(),
});

// GET - Fetch all recipients grouped by form type
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const recipients = await db
      .select()
      .from(formEmailRecipients)
      .orderBy(formEmailRecipients.formType, formEmailRecipients.createdAt);

    // Group by form type
    const grouped = FORM_TYPES.reduce((acc, formType) => {
      acc[formType.value] = recipients.filter((r) => r.formType === formType.value);
      return acc;
    }, {} as Record<string, typeof recipients>);

    return NextResponse.json({ recipients: grouped, formTypes: FORM_TYPES });
  } catch (error) {
    console.error("[API] Error fetching form recipients:", error);
    return NextResponse.json({ error: "Failed to fetch recipients" }, { status: 500 });
  }
}

// POST - Add a new recipient
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = recipientSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const { formType, email, name } = result.data;

    // Check for duplicate
    const existing = await db
      .select()
      .from(formEmailRecipients)
      .where(
        and(
          eq(formEmailRecipients.formType, formType),
          eq(formEmailRecipients.email, email.toLowerCase())
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ error: "This email is already a recipient for this form type" }, { status: 400 });
    }

    const [newRecipient] = await db
      .insert(formEmailRecipients)
      .values({
        formType,
        email: email.toLowerCase(),
        name: name || null,
      })
      .returning();

    return NextResponse.json(newRecipient, { status: 201 });
  } catch (error) {
    console.error("[API] Error adding form recipient:", error);
    return NextResponse.json({ error: "Failed to add recipient" }, { status: 500 });
  }
}
