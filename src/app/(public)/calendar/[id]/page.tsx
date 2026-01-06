import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { events, shuls } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Calendar, MapPin, Clock, User, Mail, Phone, DollarSign, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EVENT_TYPES } from "@/lib/validations/content";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getEvent(id: number) {
  const [event] = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      location: events.location,
      startTime: events.startTime,
      endTime: events.endTime,
      isAllDay: events.isAllDay,
      eventType: events.eventType,
      shulId: events.shulId,
      shulName: shuls.name,
      contactName: events.contactName,
      contactEmail: events.contactEmail,
      contactPhone: events.contactPhone,
      cost: events.cost,
      imageUrl: events.imageUrl,
    })
    .from(events)
    .leftJoin(shuls, eq(events.shulId, shuls.id))
    .where(eq(events.id, id))
    .limit(1);

  return event;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getEventTypeLabel(type: string | null): string {
  return EVENT_TYPES.find((t) => t.value === type)?.label || type || "General";
}

export default async function EventDetailPage({ params }: PageProps) {
  const { id } = await params;
  const eventId = parseInt(id);

  if (isNaN(eventId)) {
    notFound();
  }

  const event = await getEvent(eventId);

  if (!event) {
    notFound();
  }

  const startDate = new Date(event.startTime);
  const endDate = event.endTime ? new Date(event.endTime) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-400 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 py-12 relative">
          <Link href="/calendar">
            <Button variant="ghost" className="text-white hover:bg-white/10 mb-6">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Calendar
            </Button>
          </Link>
          <div className="max-w-4xl">
            <Badge className="bg-white/20 text-white mb-4">
              {getEventTypeLabel(event.eventType)}
            </Badge>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">{event.title}</h1>
            {event.shulName && (
              <p className="text-xl text-blue-100">Hosted by {event.shulName}</p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="md:col-span-2 space-y-6">
              {event.description && (
                <Card>
                  <CardContent className="p-6">
                    <h2 className="text-lg font-semibold mb-4">About This Event</h2>
                    <p className="text-gray-600 whitespace-pre-wrap">{event.description}</p>
                  </CardContent>
                </Card>
              )}

              {event.location && (
                <Card>
                  <CardContent className="p-6">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-blue-600" />
                      Location
                    </h2>
                    <p className="text-gray-600">{event.location}</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Date & Time Card */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-blue-100 rounded-xl">
                      <Calendar className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold">{formatDate(startDate)}</p>
                      {event.isAllDay ? (
                        <p className="text-sm text-gray-500">All Day Event</p>
                      ) : (
                        <p className="text-sm text-gray-500">
                          {formatTime(startDate)}
                          {endDate && ` - ${formatTime(endDate)}`}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cost Card */}
              {event.cost && (
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-green-100 rounded-xl">
                        <DollarSign className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Cost</p>
                        <p className="font-semibold">{event.cost}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Contact Card */}
              {(event.contactName || event.contactEmail || event.contactPhone) && (
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-semibold mb-4">Contact Information</h3>
                    <div className="space-y-3">
                      {event.contactName && (
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-gray-400" />
                          <span>{event.contactName}</span>
                        </div>
                      )}
                      {event.contactEmail && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <a
                            href={`mailto:${event.contactEmail}`}
                            className="text-blue-600 hover:underline"
                          >
                            {event.contactEmail}
                          </a>
                        </div>
                      )}
                      {event.contactPhone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <a
                            href={`tel:${event.contactPhone}`}
                            className="text-blue-600 hover:underline"
                          >
                            {event.contactPhone}
                          </a>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
