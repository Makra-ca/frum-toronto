import { db } from "@/lib/db";
import { shuls, daveningSchedules, events, shulDocuments } from "@/lib/db/schema";
import { eq, and, gte, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Phone, Mail, Globe, ChevronLeft, Clock, Users, Calendar, FileText, Download, Newspaper, BookOpen } from "lucide-react";
import { DAYS_OF_WEEK } from "@/lib/validations/content";
import { ShulEventsCalendar } from "@/components/shuls/ShulEventsCalendar";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ShulPage({ params }: PageProps) {
  const { slug } = await params;

  // Fetch shul by slug
  const [shul] = await db
    .select()
    .from(shuls)
    .where(and(eq(shuls.slug, slug), eq(shuls.isActive, true)))
    .limit(1);

  if (!shul) {
    notFound();
  }

  // Fetch davening schedules
  const schedules = await db
    .select()
    .from(daveningSchedules)
    .where(eq(daveningSchedules.shulId, shul.id));

  // Fetch upcoming events
  const upcomingEvents = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.shulId, shul.id),
        eq(events.isActive, true),
        gte(events.startTime, new Date())
      )
    )
    .orderBy(events.startTime)
    .limit(20);

  // Fetch documents (newsletters & tefillos)
  const documents = await db
    .select()
    .from(shulDocuments)
    .where(and(eq(shulDocuments.shulId, shul.id), eq(shulDocuments.isActive, true)))
    .orderBy(desc(shulDocuments.publishedAt));

  const newsletters = documents.filter((d) => d.type === "newsletter");
  const tefillos = documents.filter((d) => d.type === "tefillah");

  function formatFileSize(bytes: number | null): string {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDocDate(dateStr: Date | null): string {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  // Group schedules by tefilah type
  const groupedSchedules = schedules.reduce((acc, schedule) => {
    const type = schedule.tefilahType || "other";
    if (!acc[type]) acc[type] = [];
    acc[type].push(schedule);
    return acc;
  }, {} as Record<string, typeof schedules>);

  const tefilahOrder = ["shacharis", "mincha", "maariv"];

  function formatTime(time: string): string {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  }

  function getDayLabel(dayOfWeek: number | null): string {
    if (dayOfWeek === null) return "Daily";
    const day = DAYS_OF_WEEK.find((d) => d.value === dayOfWeek);
    return day?.label || "Unknown";
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-900 text-white py-8">
        <div className="container mx-auto px-4">
          <Link
            href="/shuls"
            className="inline-flex items-center text-blue-200 hover:text-white mb-4 transition-colors"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Shul Directory
          </Link>

          <h1 className="text-3xl md:text-4xl font-bold mb-2">{shul.name}</h1>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mt-3">
            {shul.denomination && (
              <Badge className="bg-blue-800 text-white capitalize">
                {shul.denomination.replace("-", " ")}
              </Badge>
            )}
            {shul.nusach && (
              <Badge className="bg-blue-700 text-white capitalize">
                Nusach {shul.nusach.replace("-", " ")}
              </Badge>
            )}
            {shul.hasMinyan && (
              <Badge className="bg-green-600 text-white">
                <Users className="h-3 w-3 mr-1" />
                Regular Minyan
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content - Davening Times */}
          <div className="lg:col-span-2 space-y-6">
            {/* Davening Schedule */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Davening Schedule
                </CardTitle>
              </CardHeader>
              <CardContent>
                {schedules.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No davening times have been added yet.
                  </p>
                ) : (
                  <div className="space-y-6">
                    {tefilahOrder.map((tefilahType) => {
                      const typeSchedules = groupedSchedules[tefilahType];
                      if (!typeSchedules || typeSchedules.length === 0) return null;

                      return (
                        <div key={tefilahType}>
                          <h3 className="font-semibold text-lg capitalize mb-3 text-blue-900">
                            {tefilahType}
                          </h3>
                          <div className="grid gap-2">
                            {typeSchedules.map((schedule) => (
                              <div
                                key={schedule.id}
                                className="p-3 bg-gray-50 rounded-lg"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <span className="font-medium">
                                      {formatTime(schedule.time)}
                                    </span>
                                    <span className="text-gray-500">
                                      {getDayLabel(schedule.dayOfWeek)}
                                    </span>
                                  </div>
                                <div className="flex gap-1">
                                  {schedule.isShabbos && (
                                    <Badge variant="outline" className="text-xs">
                                      Shabbos
                                    </Badge>
                                  )}
                                  {schedule.isWinter && !schedule.isSummer && (
                                    <Badge variant="outline" className="text-xs">
                                      Winter
                                    </Badge>
                                  )}
                                  {schedule.isSummer && !schedule.isWinter && (
                                    <Badge variant="outline" className="text-xs">
                                      Summer
                                    </Badge>
                                  )}
                                </div>
                                </div>
                                {schedule.notes && (
                                  <p className="text-sm text-gray-500 mt-2 whitespace-pre-wrap border-t border-gray-200 pt-2">
                                    {schedule.notes}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Events Calendar */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Events & Special Programs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ShulEventsCalendar events={upcomingEvents} />
              </CardContent>
            </Card>

            {/* Newsletters */}
            {newsletters.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Newspaper className="h-5 w-5 text-blue-600" />
                    Newsletters
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {newsletters.map((doc) => (
                      <ShulDocumentCard key={doc.id} doc={doc} accent="blue" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tefillos */}
            {tefillos.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-purple-600" />
                    Tefillos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {tefillos.map((doc) => (
                      <ShulDocumentCard key={doc.id} doc={doc} accent="purple" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Contact Info */}
          <div className="space-y-6">
            {/* Contact Card */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {shul.rabbi && (
                  <div>
                    <p className="text-sm text-gray-500">Rabbi</p>
                    <p className="font-medium">{shul.rabbi}</p>
                  </div>
                )}

                {shul.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">{shul.address}</p>
                      {shul.city && (
                        <p className="text-sm text-gray-500">
                          {shul.city}
                          {shul.postalCode && `, ${shul.postalCode}`}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {shul.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-gray-400" />
                    <a
                      href={`tel:${shul.phone}`}
                      className="text-blue-600 hover:underline"
                    >
                      {shul.phone}
                    </a>
                  </div>
                )}

                {shul.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-gray-400" />
                    <a
                      href={`mailto:${shul.email}`}
                      className="text-blue-600 hover:underline truncate"
                    >
                      {shul.email}
                    </a>
                  </div>
                )}

                {shul.website && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-gray-400" />
                    <a
                      href={shul.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline truncate"
                    >
                      Visit Website
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Description */}
            {shul.description && (
              <Card>
                <CardHeader>
                  <CardTitle>About</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 whitespace-pre-wrap">{shul.description}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ShulDocumentCard({
  doc,
  accent,
}: {
  doc: { id: number; title: string; fileUrl: string; fileSize: number | null; publishedAt: Date | null; description: string | null };
  accent: "blue" | "purple";
}) {
  const isImage = /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(doc.fileUrl);
  const hoverBorder = accent === "blue" ? "hover:border-blue-200" : "hover:border-purple-200";

  return (
    <a
      href={doc.fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`block border border-gray-100 rounded-lg overflow-hidden ${hoverBorder} hover:shadow-md transition-all group`}
    >
      {/* Preview */}
      <div className="relative w-full h-48 bg-gray-100">
        {isImage ? (
          <img
            src={doc.fileUrl}
            alt={doc.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <iframe
            src={`${doc.fileUrl}#toolbar=0&navpanes=0&scrollbar=0`}
            className="w-full h-full pointer-events-none"
            title={doc.title}
          />
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className={`font-medium text-gray-900 text-sm truncate group-hover:text-${accent}-700`}>
          {doc.title}
        </p>
        {doc.description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{doc.description}</p>
        )}
        <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
          {doc.publishedAt && (
            <span>
              {new Date(doc.publishedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          )}
          {doc.fileSize && (
            <span>
              {doc.fileSize < 1024 * 1024
                ? `${(doc.fileSize / 1024).toFixed(1)} KB`
                : `${(doc.fileSize / (1024 * 1024)).toFixed(1)} MB`}
            </span>
          )}
          <Download className={`h-3 w-3 ml-auto text-gray-400 group-hover:text-${accent}-600`} />
        </div>
      </div>
    </a>
  );
}
