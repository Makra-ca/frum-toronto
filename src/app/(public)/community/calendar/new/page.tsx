import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PublicEventForm } from "@/components/events/PublicEventForm";

export const dynamic = "force-dynamic";

export default async function SubmitEventPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/community/calendar/new");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Link
            href="/community/calendar"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Calendar
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Submit an Event</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Share your community event with the FrumToronto calendar. All
            submissions are reviewed before publishing.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border p-6 md:p-8">
          <PublicEventForm />
        </div>
      </div>
    </div>
  );
}
