"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  MapPin,
  Clock,
  User,
  Calendar,
  Tag,
  Phone,
  Mail,
  Globe,
  ArrowLeft,
  Building,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DAYS_OF_WEEK,
  SHIUR_LEVELS,
  SHIUR_GENDERS,
  SHIUR_CATEGORIES,
  SHIUR_CLASS_TYPES,
  LOCATION_AREAS,
} from "@/lib/validations/content";

interface ScheduleEntry {
  start?: string;
  end?: string;
  notes?: string;
}

interface Shiur {
  id: number;
  teacherName: string;
  title: string;
  description: string | null;
  location: string | null;
  shulId: number | null;
  shulName: string | null;
  shulSlug: string | null;
  locationName: string | null;
  locationAddress: string | null;
  locationPostalCode: string | null;
  locationArea: string | null;
  schedule: Record<string, ScheduleEntry> | null;
  startDate: string | null;
  endDate: string | null;
  dayOfWeek: number | null;
  time: string | null;
  duration: number | null;
  category: string | null;
  classType: string | null;
  level: string | null;
  gender: string | null;
  cost: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  website: string | null;
  projectOf: string | null;
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getDayLabel(day: number): string {
  return DAYS_OF_WEEK.find((d) => d.value === day)?.label || "Unknown";
}

function getLevelLabel(level: string | null): string {
  return SHIUR_LEVELS.find((l) => l.value === level)?.label || level || "";
}

function getGenderLabel(gender: string | null): string {
  return SHIUR_GENDERS.find((g) => g.value === gender)?.label || gender || "";
}

function getCategoryLabel(category: string | null): string {
  return SHIUR_CATEGORIES.find((c) => c.value === category)?.label || category || "";
}

function getClassTypeLabel(classType: string | null): string {
  return SHIUR_CLASS_TYPES.find((t) => t.value === classType)?.label || classType || "";
}

function getAreaLabel(area: string | null): string {
  return LOCATION_AREAS.find((a) => a.value === area)?.label || area || "";
}

export default function ShiurDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [shiur, setShiur] = useState<Shiur | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchShiur() {
      try {
        const response = await fetch(`/api/shiurim/${resolvedParams.id}`);
        if (response.ok) {
          const data = await response.json();
          setShiur(data);
        } else if (response.status === 404) {
          setError("Shiur not found");
        } else {
          setError("Failed to load shiur");
        }
      } catch (err) {
        console.error("Error fetching shiur:", err);
        setError("Failed to load shiur");
      } finally {
        setLoading(false);
      }
    }

    fetchShiur();
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !shiur) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {error || "Shiur not found"}
              </h3>
              <p className="text-gray-500 mb-4">
                This shiur may no longer be available.
              </p>
              <Button onClick={() => router.push("/shiurim")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Shiurim
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Get active schedule days
  const scheduleDays = shiur.schedule
    ? DAYS_OF_WEEK.filter((day) => {
        const entry = shiur.schedule?.[day.value.toString()];
        return entry?.start;
      })
    : [];

  const hasSchedule = scheduleDays.length > 0 || (shiur.dayOfWeek !== null && shiur.time);
  const hasLocation = shiur.shulName || shiur.locationName || shiur.location;
  const hasContact = shiur.contactName || shiur.contactPhone || shiur.contactEmail || shiur.website;
  const hasDateRange = shiur.startDate || shiur.endDate;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 text-white">
        <div className="container mx-auto px-4 py-8">
          <Button
            variant="ghost"
            className="text-white/80 hover:text-white hover:bg-white/10 mb-4"
            onClick={() => router.push("/shiurim")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Shiurim
          </Button>

          <div className="max-w-4xl">
            <div className="flex flex-wrap gap-2 mb-3">
              {shiur.category && (
                <Badge className="bg-white/20 text-white border-0">
                  <Tag className="h-3 w-3 mr-1" />
                  {getCategoryLabel(shiur.category)}
                </Badge>
              )}
              {shiur.classType && (
                <Badge className="bg-white/20 text-white border-0">
                  {getClassTypeLabel(shiur.classType)}
                </Badge>
              )}
              {shiur.level && (
                <Badge className="bg-white/20 text-white border-0">
                  {getLevelLabel(shiur.level)}
                </Badge>
              )}
              {shiur.gender && (
                <Badge className="bg-white/20 text-white border-0">
                  {getGenderLabel(shiur.gender)}
                </Badge>
              )}
            </div>

            <h1 className="text-3xl md:text-4xl font-bold mb-2">{shiur.title}</h1>

            <div className="flex items-center gap-2 text-blue-100">
              <User className="h-5 w-5" />
              <span className="text-lg">{shiur.teacherName}</span>
            </div>

            {shiur.projectOf && (
              <p className="text-blue-200 mt-2">A project of {shiur.projectOf}</p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6 max-w-6xl">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            {shiur.description && (
              <Card>
                <CardHeader>
                  <CardTitle>About This Shiur</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 whitespace-pre-wrap">{shiur.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Schedule */}
            {hasSchedule && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-600" />
                    Schedule
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {scheduleDays.length > 0 ? (
                    <div className="space-y-3">
                      {scheduleDays.map((day) => {
                        const entry = shiur.schedule?.[day.value.toString()];
                        if (!entry?.start) return null;

                        return (
                          <div
                            key={day.value}
                            className="flex justify-between items-start py-2 border-b last:border-0"
                          >
                            <span className="font-medium text-gray-900">
                              {day.label}
                            </span>
                            <div className="text-right">
                              <span className="text-gray-700">
                                {formatTime(entry.start)}
                                {entry.end && ` - ${formatTime(entry.end)}`}
                              </span>
                              {entry.notes && (
                                <p className="text-sm text-gray-500 mt-1">
                                  {entry.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : shiur.dayOfWeek !== null && shiur.time ? (
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-900">
                        {getDayLabel(shiur.dayOfWeek)}
                      </span>
                      <span className="text-gray-700">
                        {formatTime(shiur.time)}
                        {shiur.duration && ` (${shiur.duration} min)`}
                      </span>
                    </div>
                  ) : null}

                  {hasDateRange && (
                    <>
                      <Separator className="my-4" />
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {shiur.startDate && `Starts ${formatDate(shiur.startDate)}`}
                          {shiur.startDate && shiur.endDate && " • "}
                          {shiur.endDate && `Ends ${formatDate(shiur.endDate)}`}
                        </span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Location */}
            {hasLocation && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-blue-600" />
                    Location
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {shiur.shulName ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-gray-400" />
                        <Link
                          href={`/directory/${shiur.shulSlug || shiur.shulId}`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          {shiur.shulName}
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {shiur.locationName && (
                        <p className="font-medium text-gray-900">{shiur.locationName}</p>
                      )}
                      {shiur.locationAddress && (
                        <p className="text-gray-600">{shiur.locationAddress}</p>
                      )}
                      {(shiur.locationArea || shiur.locationPostalCode) && (
                        <p className="text-gray-500 text-sm">
                          {getAreaLabel(shiur.locationArea)}
                          {shiur.locationArea && shiur.locationPostalCode && " • "}
                          {shiur.locationPostalCode}
                        </p>
                      )}
                      {shiur.location && !shiur.locationName && (
                        <p className="text-gray-600">{shiur.location}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Cost */}
            {shiur.cost && (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-100 rounded-xl">
                      <DollarSign className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Cost</p>
                      <p className="font-semibold text-gray-900">{shiur.cost}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Contact */}
            {hasContact && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {shiur.contactName && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <User className="h-4 w-4 text-gray-400" />
                      <span>{shiur.contactName}</span>
                    </div>
                  )}
                  {shiur.contactPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <a
                        href={`tel:${shiur.contactPhone}`}
                        className="text-blue-600 hover:underline"
                      >
                        {shiur.contactPhone}
                      </a>
                    </div>
                  )}
                  {shiur.contactEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <a
                        href={`mailto:${shiur.contactEmail}`}
                        className="text-blue-600 hover:underline break-all"
                      >
                        {shiur.contactEmail}
                      </a>
                    </div>
                  )}
                  {shiur.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-gray-400" />
                      <a
                        href={shiur.website.startsWith("http") ? shiur.website : `https://${shiur.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline break-all"
                      >
                        {shiur.website.replace(/^https?:\/\//, "")}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Quick Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {shiur.category && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Category</span>
                    <span className="font-medium">{getCategoryLabel(shiur.category)}</span>
                  </div>
                )}
                {shiur.classType && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Type</span>
                    <span className="font-medium">{getClassTypeLabel(shiur.classType)}</span>
                  </div>
                )}
                {shiur.level && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Level</span>
                    <span className="font-medium">{getLevelLabel(shiur.level)}</span>
                  </div>
                )}
                {shiur.gender && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">For</span>
                    <span className="font-medium">{getGenderLabel(shiur.gender)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
