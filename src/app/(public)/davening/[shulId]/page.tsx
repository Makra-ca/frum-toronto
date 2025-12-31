import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { daveningSchedules, shuls, businesses } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { Clock, MapPin, Phone, Mail, ArrowLeft, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DAYS_OF_WEEK, TEFILAH_TYPES } from "@/lib/validations/content";

interface PageProps {
  params: Promise<{ shulId: string }>;
}

async function getShul(id: number) {
  const [shul] = await db
    .select({
      id: shuls.id,
      businessId: shuls.businessId,
      name: businesses.name,
      address: businesses.address,
      phone: businesses.phone,
      email: businesses.email,
      rabbi: shuls.rabbi,
      denomination: shuls.denomination,
      nusach: shuls.nusach,
      hasMinyan: shuls.hasMinyan,
    })
    .from(shuls)
    .innerJoin(businesses, eq(shuls.businessId, businesses.id))
    .where(eq(shuls.id, id))
    .limit(1);

  return shul;
}

async function getDaveningSchedules(shulId: number) {
  const schedules = await db
    .select()
    .from(daveningSchedules)
    .where(eq(daveningSchedules.shulId, shulId))
    .orderBy(asc(daveningSchedules.dayOfWeek), asc(daveningSchedules.time));

  return schedules;
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function getDayLabel(day: number | null): string {
  if (day === null) return "Daily";
  return DAYS_OF_WEEK.find((d) => d.value === day)?.label || "Unknown";
}

function getTefilahLabel(type: string | null): string {
  return TEFILAH_TYPES.find((t) => t.value === type)?.label || type || "Unknown";
}

export default async function ShulDaveningPage({ params }: PageProps) {
  const { shulId } = await params;
  const id = parseInt(shulId);

  if (isNaN(id)) {
    notFound();
  }

  const shul = await getShul(id);

  if (!shul) {
    notFound();
  }

  const schedules = await getDaveningSchedules(id);

  // Group schedules by tefilah type
  const groupedByTefilah = schedules.reduce((acc, schedule) => {
    const type = schedule.tefilahType || "other";
    if (!acc[type]) acc[type] = [];
    acc[type].push(schedule);
    return acc;
  }, {} as Record<string, typeof schedules>);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-400 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 py-12 relative">
          <Link href="/davening">
            <Button variant="ghost" className="text-white hover:bg-white/10 mb-6">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Minyanim
            </Button>
          </Link>
          <div className="max-w-4xl">
            <div className="flex gap-2 mb-4">
              {shul.denomination && (
                <Badge className="bg-white/20 text-white">{shul.denomination}</Badge>
              )}
              {shul.nusach && (
                <Badge className="bg-white/20 text-white">{shul.nusach}</Badge>
              )}
              {shul.hasMinyan && (
                <Badge className="bg-green-500/80 text-white">Daily Minyan</Badge>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">{shul.name}</h1>
            {shul.rabbi && (
              <p className="text-xl text-blue-100">Rabbi: {shul.rabbi}</p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Main Content - Davening Schedule */}
            <div className="md:col-span-2 space-y-6">
              <h2 className="text-xl font-bold text-gray-900">Davening Schedule</h2>

              {schedules.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Clock className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No Schedule Posted
                    </h3>
                    <p className="text-gray-500">
                      Contact the shul for davening times.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {TEFILAH_TYPES.map((tefilah) => {
                    const tefilahSchedules = groupedByTefilah[tefilah.value];
                    if (!tefilahSchedules || tefilahSchedules.length === 0) return null;

                    return (
                      <Card key={tefilah.value}>
                        <CardContent className="p-6">
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">
                            {tefilah.label}
                          </h3>
                          <div className="space-y-2">
                            {tefilahSchedules.map((schedule) => (
                              <div
                                key={schedule.id}
                                className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="font-medium text-gray-900">
                                    {getDayLabel(schedule.dayOfWeek)}
                                  </span>
                                  <div className="flex gap-1">
                                    {schedule.isWinter && (
                                      <Badge variant="outline" className="text-xs">Winter</Badge>
                                    )}
                                    {schedule.isSummer && (
                                      <Badge variant="outline" className="text-xs">Summer</Badge>
                                    )}
                                    {schedule.isShabbos && (
                                      <Badge variant="outline" className="text-xs">Shabbos</Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="font-semibold text-blue-600">
                                    {formatTime(schedule.time)}
                                  </span>
                                  {schedule.notes && (
                                    <p className="text-xs text-gray-500">{schedule.notes}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sidebar - Contact Info */}
            <div className="space-y-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-blue-100 rounded-xl">
                      <Building2 className="h-6 w-6 text-blue-600" />
                    </div>
                    <h3 className="font-semibold">Shul Information</h3>
                  </div>

                  <div className="space-y-4">
                    {shul.address && (
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                        <span className="text-gray-600">{shul.address}</span>
                      </div>
                    )}
                    {shul.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <a
                          href={`tel:${shul.phone}`}
                          className="text-blue-600 hover:underline"
                        >
                          {shul.phone}
                        </a>
                      </div>
                    )}
                    {shul.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <a
                          href={`mailto:${shul.email}`}
                          className="text-blue-600 hover:underline"
                        >
                          {shul.email}
                        </a>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
