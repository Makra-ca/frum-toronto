import Link from "next/link";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { gte, and, eq } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, ArrowRight } from "lucide-react";

const eventTypeColors: Record<string, string> = {
  community: "bg-green-100 text-green-800",
  shiur: "bg-purple-100 text-purple-800",
  special: "bg-orange-100 text-orange-800",
  shul: "bg-blue-100 text-blue-800",
};

// Fetch real upcoming events from database
async function getUpcomingEvents() {
  const now = new Date();
  const results = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      location: events.location,
      startTime: events.startTime,
      eventType: events.eventType,
    })
    .from(events)
    .where(and(
      eq(events.isActive, true),
      eq(events.approvalStatus, "approved"),
      gte(events.startTime, now)
    ))
    .orderBy(events.startTime)
    .limit(4);

  return results;
}

export async function UpcomingEvents() {
  const upcomingEvents = await getUpcomingEvents();
  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Upcoming Events</h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/community/calendar">
            View Calendar <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </div>

      {upcomingEvents.length > 0 ? (
        <div className="space-y-3">
          {upcomingEvents.map((event) => {
            const eventDate = event.startTime ? new Date(event.startTime) : new Date();
            const month = eventDate.toLocaleDateString("en-US", { month: "short" });
            const day = eventDate.getDate();
            const time = eventDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

            return (
              <Card
                key={event.id}
                className="border-0 shadow-sm hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Date box */}
                    <div className="flex-shrink-0 w-14 h-14 bg-blue-900 text-white rounded-lg flex flex-col items-center justify-center">
                      <span className="text-xs uppercase">{month}</span>
                      <span className="text-xl font-bold">{day}</span>
                    </div>

                    {/* Event details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-gray-900">{event.title}</h3>
                        {event.eventType && (
                          <Badge
                            className={`${
                              eventTypeColors[event.eventType] || eventTypeColors.community
                            } text-xs`}
                          >
                            {event.eventType}
                          </Badge>
                        )}
                      </div>
                      {event.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{event.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {time}
                        </span>
                        {event.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {event.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-8 text-center">
            <p className="text-gray-500">No upcoming events scheduled.</p>
            <Button asChild variant="link" className="mt-2">
              <Link href="/community/calendar">View Calendar</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 text-center">
        <Button asChild variant="outline">
          <Link href="/community/calendar/new">Submit an Event</Link>
        </Button>
      </div>
    </section>
  );
}
