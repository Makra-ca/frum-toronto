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
  Phone,
  Mail,
  Globe,
  ArrowLeft,
  Building,
  DollarSign,
  ExternalLink,
  Users,
  GraduationCap,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

function getGoogleMapsQuery(shiur: Shiur): string | null {
  if (shiur.locationAddress) {
    const parts = [shiur.locationAddress];
    if (shiur.locationPostalCode) parts.push(shiur.locationPostalCode);
    parts.push("Toronto, ON, Canada");
    return encodeURIComponent(parts.join(", "));
  }
  if (shiur.locationName) {
    return encodeURIComponent(`${shiur.locationName}, Toronto, ON, Canada`);
  }
  if (shiur.shulName) {
    return encodeURIComponent(`${shiur.shulName}, Toronto, ON, Canada`);
  }
  return null;
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
        <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 h-48" />
        <div className="container mx-auto px-4 -mt-20">
          <div className="bg-white rounded-2xl shadow-lg p-8 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-4" />
            <div className="h-10 bg-gray-200 rounded w-1/2 mb-4" />
            <div className="h-4 bg-gray-200 rounded w-1/3" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !shiur) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto text-center bg-white rounded-2xl shadow-lg p-8">
            <BookOpen className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {error || "Shiur not found"}
            </h3>
            <p className="text-gray-500 mb-6">
              This shiur may no longer be available.
            </p>
            <Button onClick={() => router.push("/shiurim")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Shiurim
            </Button>
          </div>
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
  const mapsQuery = getGoogleMapsQuery(shiur);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 text-white pb-24 pt-6">
        <div className="container mx-auto px-4">
          <Link
            href="/shiurim"
            className="inline-flex items-center gap-1.5 text-blue-200 hover:text-white transition-colors text-sm mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Shiurim
          </Link>

          <div className="max-w-4xl">
            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              {shiur.category && (
                <Badge className="bg-white/15 text-white border-white/20 backdrop-blur-sm">
                  {getCategoryLabel(shiur.category)}
                </Badge>
              )}
              {shiur.classType && (
                <Badge className="bg-white/15 text-white border-white/20 backdrop-blur-sm">
                  {getClassTypeLabel(shiur.classType)}
                </Badge>
              )}
              {shiur.level && (
                <Badge className="bg-white/15 text-white border-white/20 backdrop-blur-sm">
                  {getLevelLabel(shiur.level)}
                </Badge>
              )}
              {shiur.gender && (
                <Badge className="bg-white/15 text-white border-white/20 backdrop-blur-sm">
                  {getGenderLabel(shiur.gender)}
                </Badge>
              )}
            </div>

            <h1 className="text-3xl md:text-4xl font-bold mb-3">{shiur.title}</h1>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-blue-100">
              <span className="flex items-center gap-2">
                <User className="h-5 w-5" />
                <span className="text-lg font-medium">{shiur.teacherName}</span>
              </span>
              {shiur.projectOf && (
                <span className="flex items-center gap-2 text-blue-200">
                  <Building className="h-4 w-4" />
                  {shiur.projectOf}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - overlaps hero */}
      <div className="container mx-auto px-4 -mt-16">
        <div className="grid lg:grid-cols-3 gap-6 max-w-6xl">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description Card */}
            <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
              {shiur.description ? (
                <>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">About This Shiur</h2>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{shiur.description}</p>
                </>
              ) : (
                <div className="text-center py-4">
                  <BookOpen className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">Contact the organizer for more details about this shiur.</p>
                </div>
              )}
            </div>

            {/* Schedule */}
            {hasSchedule && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  Weekly Schedule
                </h2>

                {scheduleDays.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {scheduleDays.map((day) => {
                      const entry = shiur.schedule?.[day.value.toString()];
                      if (!entry?.start) return null;

                      return (
                        <div
                          key={day.value}
                          className="flex justify-between items-start py-3 first:pt-0 last:pb-0"
                        >
                          <span className="font-medium text-gray-900">
                            {day.label}
                          </span>
                          <div className="text-right">
                            <span className="text-gray-700 font-medium">
                              {formatTime(entry.start)}
                              {entry.end && ` – ${formatTime(entry.end)}`}
                            </span>
                            {entry.notes && (
                              <p className="text-sm text-gray-500 mt-0.5">
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
                    <span className="text-gray-700 font-medium">
                      {formatTime(shiur.time)}
                      {shiur.duration && ` (${shiur.duration} min)`}
                    </span>
                  </div>
                ) : null}

                {hasDateRange && (
                  <div className="flex items-center gap-2 text-sm text-gray-500 mt-4 pt-4 border-t border-gray-100">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {shiur.startDate && `Starts ${formatDate(shiur.startDate)}`}
                      {shiur.startDate && shiur.endDate && " · "}
                      {shiur.endDate && `Ends ${formatDate(shiur.endDate)}`}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Location & Map */}
            {hasLocation && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-blue-600" />
                  Location
                </h2>

                <div className="space-y-2 mb-4">
                  {shiur.shulName ? (
                    <div className="space-y-1">
                      <Link
                        href={`/shuls/${shiur.shulSlug || shiur.shulId}`}
                        className="text-blue-600 hover:underline font-medium text-lg inline-flex items-center gap-1.5"
                      >
                        <Building className="h-4 w-4" />
                        {shiur.shulName}
                      </Link>
                    </div>
                  ) : (
                    <>
                      {shiur.locationName && (
                        <p className="font-medium text-gray-900 text-lg">{shiur.locationName}</p>
                      )}
                      {shiur.locationAddress && (
                        <p className="text-gray-600">{shiur.locationAddress}</p>
                      )}
                      {(shiur.locationArea || shiur.locationPostalCode) && (
                        <p className="text-gray-500 text-sm">
                          {getAreaLabel(shiur.locationArea)}
                          {shiur.locationArea && shiur.locationPostalCode && " · "}
                          {shiur.locationPostalCode}
                        </p>
                      )}
                      {shiur.location && !shiur.locationName && (
                        <p className="text-gray-600">{shiur.location}</p>
                      )}
                    </>
                  )}
                </div>

                {/* Google Maps Link */}
                {mapsQuery && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 mt-2"
                  >
                    View on Google Maps
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Quick Details Card */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Details</h3>
              <div className="space-y-4">
                {shiur.category && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Layers className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Category</p>
                      <p className="font-medium text-gray-900">{getCategoryLabel(shiur.category)}</p>
                    </div>
                  </div>
                )}
                {shiur.classType && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-50 rounded-lg">
                      <BookOpen className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Type</p>
                      <p className="font-medium text-gray-900">{getClassTypeLabel(shiur.classType)}</p>
                    </div>
                  </div>
                )}
                {shiur.level && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-50 rounded-lg">
                      <GraduationCap className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Level</p>
                      <p className="font-medium text-gray-900">{getLevelLabel(shiur.level)}</p>
                    </div>
                  </div>
                )}
                {shiur.gender && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-teal-50 rounded-lg">
                      <Users className="h-4 w-4 text-teal-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">For</p>
                      <p className="font-medium text-gray-900">{getGenderLabel(shiur.gender)}</p>
                    </div>
                  </div>
                )}
                {shiur.cost && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-50 rounded-lg">
                      <DollarSign className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Cost</p>
                      <p className="font-medium text-gray-900">{shiur.cost}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Contact Card */}
            {hasContact && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Contact</h3>
                <div className="space-y-3">
                  {shiur.contactName && (
                    <div className="flex items-center gap-3 text-gray-700">
                      <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span>{shiur.contactName}</span>
                    </div>
                  )}
                  {shiur.contactPhone && (
                    <a
                      href={`tel:${shiur.contactPhone}`}
                      className="flex items-center gap-3 text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <Phone className="h-4 w-4 flex-shrink-0" />
                      <span>{shiur.contactPhone}</span>
                    </a>
                  )}
                  {shiur.contactEmail && (
                    <a
                      href={`mailto:${shiur.contactEmail}`}
                      className="flex items-center gap-3 text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <Mail className="h-4 w-4 flex-shrink-0" />
                      <span className="break-all">{shiur.contactEmail}</span>
                    </a>
                  )}
                  {shiur.website && (
                    <a
                      href={shiur.website.startsWith("http") ? shiur.website : `https://${shiur.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <Globe className="h-4 w-4 flex-shrink-0" />
                      <span className="break-all">{shiur.website.replace(/^https?:\/\//, "")}</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom spacing */}
      <div className="h-16" />
    </div>
  );
}
