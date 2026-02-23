import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { events, shuls } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  Calendar,
  MapPin,
  Clock,
  User,
  Mail,
  Phone,
  DollarSign,
  ArrowLeft,
  Building2,
  PartyPopper,
  GraduationCap,
  Heart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventActions } from "@/components/calendar/EventActions";
import { EVENT_TYPES } from "@/lib/validations/content";
import { HDate, gematriya } from "@hebcal/core";

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

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getEventTypeLabel(type: string | null): string {
  return EVENT_TYPES.find((t) => t.value === type)?.label || type || "Event";
}

function getEventTypeConfig(type: string | null) {
  const configs: Record<string, { bg: string; text: string; icon: typeof Calendar }> = {
    community: { bg: "bg-blue-100", text: "text-blue-700", icon: PartyPopper },
    fundraising: { bg: "bg-emerald-100", text: "text-emerald-700", icon: Heart },
    school: { bg: "bg-amber-100", text: "text-amber-700", icon: GraduationCap },
    wedding: { bg: "bg-pink-100", text: "text-pink-700", icon: Heart },
  };
  return configs[type || ""] || { bg: "bg-gray-100", text: "text-gray-700", icon: Calendar };
}

function getHebrewDate(date: Date): string {
  const hdate = new HDate(date);
  const day = gematriya(hdate.getDate());
  const month = hdate.getMonthName();
  return `${day} ${month}`;
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
  const typeConfig = getEventTypeConfig(event.eventType);
  const TypeIcon = typeConfig.icon;
  const hebrewDate = getHebrewDate(startDate);
  const hasContactInfo = event.contactName || event.contactEmail || event.contactPhone;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Decorative top section */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 h-48 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute top-20 left-1/4 w-64 h-64 bg-blue-400/20 rounded-full blur-2xl" />
        </div>
        <div className="container mx-auto px-4 py-4 relative">
          <Link href="/community/calendar">
            <Button variant="ghost" size="sm" className="text-white/90 hover:text-white hover:bg-white/10 -ml-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Calendar
            </Button>
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 -mt-28 pb-12 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Main content card */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Event header with subtle gradient */}
            <div className="p-6 md:p-8 bg-gradient-to-r from-slate-50 via-white to-blue-50/50 border-b">
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                {/* Date box */}
                <div className="flex-shrink-0">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 flex flex-col items-center justify-center text-white shadow-lg">
                    <span className="text-3xl font-bold leading-none">{startDate.getDate()}</span>
                    <span className="text-sm uppercase tracking-wide opacity-90">
                      {startDate.toLocaleDateString("en-US", { month: "short" })}
                    </span>
                  </div>
                </div>

                {/* Title and meta */}
                <div className="flex-1 min-w-0">
                  {/* Event type badge */}
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium mb-3 ${typeConfig.bg} ${typeConfig.text}`}>
                    <TypeIcon className="h-3.5 w-3.5" />
                    {getEventTypeLabel(event.eventType)}
                  </div>

                  {/* Title */}
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
                    {event.title}
                  </h1>

                  {/* Quick meta info */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>
                        {startDate.toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    {!event.isAllDay && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span>
                          {formatTime(startDate)}
                          {endDate && ` - ${formatTime(endDate)}`}
                        </span>
                      </div>
                    )}
                    {event.isAllDay && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span>All Day</span>
                      </div>
                    )}
                  </div>

                  {/* Hebrew date */}
                  <p className="text-sm text-gray-500 mt-2" dir="rtl">{hebrewDate}</p>

                  {/* Host */}
                  {event.shulName && (
                    <p className="text-gray-600 mt-3 flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      Hosted by {event.shulName}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex-shrink-0">
                  <EventActions
                    event={{
                      id: event.id,
                      title: event.title,
                      description: event.description,
                      location: event.location,
                      startTime: startDate,
                      endTime: endDate,
                      isAllDay: event.isAllDay,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Content area */}
            <div className="p-6 md:p-8 bg-gradient-to-b from-white to-slate-50/80">
              <div className="grid md:grid-cols-3 gap-8">
                {/* Main content - 2 columns */}
                <div className="md:col-span-2 space-y-8">
                  {/* Description */}
                  {event.description ? (
                    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                      <h2 className="text-lg font-semibold text-gray-900 mb-4">About This Event</h2>
                      <div className="prose prose-gray max-w-none">
                        <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
                          {event.description}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gradient-to-br from-gray-50 to-slate-100 rounded-xl p-6 text-center border border-gray-100">
                      <TypeIcon className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                      <p className="text-gray-500">
                        More details coming soon. Contact the organizer for information.
                      </p>
                    </div>
                  )}

                  {/* Location */}
                  {event.location && (
                    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                          <MapPin className="h-4 w-4 text-blue-600" />
                        </div>
                        Location
                      </h2>
                      <p className="text-gray-700 font-medium">{event.location}</p>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mt-3 font-medium"
                      >
                        View on Google Maps
                        <ArrowLeft className="h-3 w-3 rotate-[135deg]" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Sidebar - 1 column */}
                <div className="space-y-4">
                  {/* Cost */}
                  {event.cost && (
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-200 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <DollarSign className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wide">Cost</p>
                          <p className="text-gray-900 font-medium mt-0.5">{event.cost}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Contact */}
                  {hasContactInfo && (
                    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                      <h3 className="font-semibold text-gray-900 mb-3">Contact</h3>
                      <div className="space-y-2.5">
                        {event.contactName && (
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                              <User className="h-4 w-4 text-gray-500" />
                            </div>
                            <span className="text-gray-700 text-sm">{event.contactName}</span>
                          </div>
                        )}
                        {event.contactEmail && (
                          <a
                            href={`mailto:${event.contactEmail}`}
                            className="flex items-center gap-2.5 text-blue-600 hover:text-blue-700 transition-colors"
                          >
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <Mail className="h-4 w-4 text-blue-600" />
                            </div>
                            <span className="text-sm truncate">{event.contactEmail}</span>
                          </a>
                        )}
                        {event.contactPhone && (
                          <a
                            href={`tel:${event.contactPhone}`}
                            className="flex items-center gap-2.5 text-blue-600 hover:text-blue-700 transition-colors"
                          >
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <Phone className="h-4 w-4 text-blue-600" />
                            </div>
                            <span className="text-sm">{event.contactPhone}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Date & Time details */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100 shadow-sm">
                    <h3 className="font-semibold text-gray-900 mb-3">Date & Time</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Date</span>
                        <span className="text-gray-900 font-medium">
                          {startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Day</span>
                        <span className="text-gray-900 font-medium">
                          {startDate.toLocaleDateString("en-US", { weekday: "long" })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Time</span>
                        <span className="text-gray-900 font-medium">
                          {event.isAllDay ? "All Day" : formatTime(startDate)}
                        </span>
                      </div>
                      {endDate && !event.isAllDay && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Ends</span>
                          <span className="text-gray-900 font-medium">{formatTime(endDate)}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-2 border-t mt-2">
                        <span className="text-gray-500">Hebrew</span>
                        <span className="text-gray-900 font-medium" dir="rtl">{hebrewDate}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
