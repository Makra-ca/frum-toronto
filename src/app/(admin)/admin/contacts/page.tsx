import { Metadata } from "next";
import { db } from "@/lib/db";
import { contactSubmissions } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { ContactTable } from "@/components/admin/ContactTable";

export const metadata: Metadata = {
  title: "Contact Messages - Admin",
};

export default async function AdminContactsPage() {
  const submissions = await db
    .select({
      id: contactSubmissions.id,
      category: contactSubmissions.category,
      name: contactSubmissions.name,
      email: contactSubmissions.email,
      subject: contactSubmissions.subject,
      message: contactSubmissions.message,
      status: contactSubmissions.status,
      createdAt: contactSubmissions.createdAt,
    })
    .from(contactSubmissions)
    .orderBy(desc(contactSubmissions.createdAt));

  const newCount = submissions.filter((s) => s.status === "new").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Contact Messages</h1>
          <p className="text-gray-600 mt-1">
            View and respond to messages from the contact form
          </p>
        </div>
        <div className="text-sm text-gray-500">
          {submissions.length} total messages
          {newCount > 0 && (
            <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">
              {newCount} new
            </span>
          )}
        </div>
      </div>

      <ContactTable submissions={submissions} />
    </div>
  );
}
