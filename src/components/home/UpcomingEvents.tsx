import Link from "next/link";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { gte, and, eq } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, ArrowRight } from "lucide-react";

const eventTypeColors: Record<string, string> = {
  community: "bg-green-100 text-green-800",
  fundraising: "bg-orange-100 text-orange-800",
  school: "bg-yellow-100 text-yellow-800",
  wedding: "bg-pink-100 text-pink-800",
  shiur: "bg-purple-100 text-purple-800",
  special: "bg-orange-100 text-orange-800",
  shul: "bg-blue-100 text-blue-800",
};

const eventTypeLabels: Record<string, string> = {
  community: "Community",
  fundraising: "Fundraising",
  school: "School",
  wedding: "Wedding",
  shiur: "Shiur",
  special: "Special",
  shul: "Shul",
};

async function getUpcomingEvents() {
  const now = new Date();
  return db
    .select({
      id: events.id,
      title: events.title,
      location: events.location,
      startTime: events.startTime,
      eventType: events.eventType,
    })
    .from(events)
    .where(
      and(
        eq(events.isActive, true),
        eq(events.approvalStatus, "approved"),
        gte(events.startTime, now)
      )
    )
    .orderBy(events.startTime)
    .limit(6);
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {upcomingEvents.map((event) => {
            const eventDate = event.startTime ? new Date(event.startTime) : new Date();
            const month = eventDate.toLocaleDateString("en-US", { month: "short" });
            const day = eventDate.getDate();
            const weekday = eventDate.toLocaleDateString("en-US", { weekday: "short" });
            const time = eventDate.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            });

            return (
              <Link key={event.id} href={`/community/calendar/${event.id}`} className="block group">
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow h-full">
                  <CardContent className="p-4 flex flex-col h-full">
                    <div className="flex gap-3 flex-1">
                      <div className="flex-shrink-0 w-12 h-14 bg-blue-900 text-white rounded-lg flex flex-col items-center justify-center">
                        <span className="text-[10px] uppercase leading-none">{weekday}</span>
                        <span className="text-xl font-bold leading-tight">{day}</span>
                        <span className="text-[10px] uppercase leading-none">{month}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors line-clamp-2 text-sm leading-snug">
                          {event.title}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">{time}</p>
                        {event.location && (
                          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1 line-clamp-1">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            {event.location}
                          </p>
                        )}
                      </div>
                    </div>
                    {event.eventType && (
                      <div className="mt-3">
                        <Badge
                          className={`text-xs ${
                            eventTypeColors[event.eventType] ?? eventTypeColors.community
                          }`}
                        >
                          {eventTypeLabels[event.eventType] ?? event.eventType}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}

          {/* Full-width CTA row */}
          <div className="col-span-1 sm:col-span-2 lg:col-span-3">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 py-4 border border-dashed border-gray-200 rounded-lg bg-gray-50">
              <span className="text-sm text-gray-600">Looking for something to do?</span>
              <Button asChild size="sm">
                <Link href="/community/calendar">
                  View All Events <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/community/calendar/new">Submit an Event</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-8 text-center">
            <p className="text-gray-500">No upcoming events scheduled.</p>
            <div className="flex justify-center gap-3 mt-3">
              <Button asChild variant="link">
                <Link href="/community/calendar">View Calendar</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/community/calendar/new">Submit an Event</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
