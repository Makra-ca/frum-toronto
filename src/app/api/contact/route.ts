import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contactSubmissions } from "@/lib/db/schema";

const VALID_CATEGORIES = [
  "General Inquiries",
  "Comments",
  "Questions",
  "Calendar Events",
  "Shiurim",
  "On-Line Shopping",
  "Simchas",
  "Yom Tov Needs",
  "Website",
  "Advertising",
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { category, name, email, subject, message } = body;

    // Validate required fields
    if (!category || !name || !email || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate category
    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: "Invalid category" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Save to database
    await db.insert(contactSubmissions).values({
      category,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject?.trim() || null,
      message: message.trim(),
      status: "new",
    });

    return NextResponse.json(
      { success: true, message: "Message sent successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
