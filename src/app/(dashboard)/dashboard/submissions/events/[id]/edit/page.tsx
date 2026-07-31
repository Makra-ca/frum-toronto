import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PublicEventForm } from "@/components/events/PublicEventForm";
import { canEditRow } from "@/lib/submissions/ownership";
import { toDateInputValue, toTimeInputValue } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export default async function EditSubmittedEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const eventId = parseInt(id);
  if (Number.isNaN(eventId)) notFound();

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/dashboard/submissions/events/${eventId}/edit`);
  }

  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) notFound();

  // The SAME rule the GET and PATCH run. An owner-only check here made the
  // widening of those two inert: a shul manager was allowed to save the shul's
  // event but could never reach the form to do it.
  const mayEdit = await canEditRow(
    "event",
    event,
    parseInt(session.user.id),
    session.user.role
  );

  if (!mayEdit) notFound();

  return (
    <div className="max-w-3xl">
      <Link
        href="/dashboard/submissions"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to my submissions
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit event</h1>

      <PublicEventForm
        eventId={event.id}
        isLive={event.approvalStatus === "approved"}
        initialData={{
          title: event.title,
          description: event.description ?? "",
          location: event.location ?? "",
          startDate: toDateInputValue(event.startTime),
          startTime: event.isAllDay ? "" : toTimeInputValue(event.startTime),
          endDate: event.endTime ? toDateInputValue(event.endTime) : "",
          endTime:
            event.endTime && !event.isAllDay
              ? toTimeInputValue(event.endTime)
              : "",
          isAllDay: event.isAllDay ?? false,
          eventType: event.eventType ?? "",
          contactName: event.contactName ?? "",
          contactEmail: event.contactEmail ?? "",
          contactPhone: event.contactPhone ?? "",
          cost: event.cost ?? "",
          organization: event.organization ?? "",
          websiteUrl: event.websiteUrl ?? "",
          flyerUrl: event.flyerUrl ?? "",
          imageUrl: event.imageUrl ?? "",
        }}
      />
    </div>
  );
}
