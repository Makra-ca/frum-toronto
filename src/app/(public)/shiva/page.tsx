import { db } from "@/lib/db";
import { shivaNotifications } from "@/lib/db/schema";
import { desc, eq, gte, and } from "drizzle-orm";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  MapPin,
  Clock,
  Phone,
  Heart,
  Utensils,
  Info,
  BookOpen,
} from "lucide-react";
import { ShivaSubmitModal } from "@/components/shiva/ShivaSubmitModal";

export const metadata = {
  title: "Shiva Notices - FrumToronto",
  description:
    "Shiva notices for the Toronto Jewish community. Pay a shiva call and comfort the mourners.",
};

export const dynamic = "force-dynamic";

async function getShivaNotices() {
  const today = new Date().toISOString().split("T")[0];

  const notices = await db
    .select()
    .from(shivaNotifications)
    .where(
      and(
        eq(shivaNotifications.approvalStatus, "approved"),
        gte(shivaNotifications.shivaEnd, today)
      )
    )
    .orderBy(shivaNotifications.shivaEnd);

  return notices;
}

function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatMournerNames(mournerNames: unknown): string[] {
  if (!mournerNames) return [];
  if (Array.isArray(mournerNames)) {
    return mournerNames.filter((name) => typeof name === "string" && name.trim());
  }
  return [];
}

export default async function ShivaPage() {
  const notices = await getShivaNotices();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - somber colors */}
      <div className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Heart className="h-8 w-8" />
                <h1 className="text-3xl md:text-4xl font-bold">Shiva Notices</h1>
              </div>
              <p className="text-slate-300 max-w-2xl">
                המקום ינחם אתכם בתוך שאר אבלי ציון וירושלים
              </p>
              <p className="text-slate-400 mt-2 max-w-2xl">
                May Hashem comfort you among the mourners of Zion and Jerusalem.
                Pay a shiva call to comfort the bereaved families of our community.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <ShivaSubmitModal />
              <Link href="/community/tehillim">
                <Button variant="secondary" className="w-full sm:w-auto">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Tehillim List
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {notices.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Info className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Current Shiva Notices
              </h3>
              <p className="text-gray-500">
                There are currently no active shiva notices.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {notices.map((notice) => {
              const mourners = formatMournerNames(notice.mournerNames);

              return (
                <Card
                  key={notice.id}
                  className="overflow-hidden border-l-4 border-l-slate-600"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-xl text-gray-900">
                          {notice.niftarName}
                        </CardTitle>
                        {notice.niftarNameHebrew && (
                          <p className="text-lg text-gray-600 mt-1 font-hebrew">
                            {notice.niftarNameHebrew}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-slate-600 border-slate-300">
                        Shiva
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Mourners */}
                    {mourners.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">
                          Mourners
                        </p>
                        <p className="text-gray-800">
                          {mourners.join(", ")}
                        </p>
                      </div>
                    )}

                    {/* Shiva Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      {/* Address */}
                      {notice.shivaAddress && (
                        <div className="flex items-start gap-2 text-gray-600">
                          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>{notice.shivaAddress}</span>
                        </div>
                      )}

                      {/* Dates */}
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="h-4 w-4 flex-shrink-0" />
                        <span>
                          {formatDate(notice.shivaStart)} - {formatDate(notice.shivaEnd)}
                        </span>
                      </div>

                      {/* Hours */}
                      {notice.shivaHours && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Clock className="h-4 w-4 flex-shrink-0" />
                          <span>{notice.shivaHours}</span>
                        </div>
                      )}

                      {/* Phone */}
                      {notice.contactPhone && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone className="h-4 w-4 flex-shrink-0" />
                          <a
                            href={`tel:${notice.contactPhone}`}
                            className="text-blue-600 hover:underline"
                          >
                            {notice.contactPhone}
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Meal Info */}
                    {notice.mealInfo && (
                      <div className="pt-3 border-t">
                        <div className="flex items-start gap-2">
                          <Utensils className="h-4 w-4 mt-0.5 text-gray-500 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">
                              Meal Information
                            </p>
                            <p className="text-gray-700 text-sm">
                              {notice.mealInfo}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Donation Info */}
                    {notice.donationInfo && (
                      <div className="pt-3 border-t">
                        <div className="flex items-start gap-2">
                          <Heart className="h-4 w-4 mt-0.5 text-gray-500 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">
                              Donations
                            </p>
                            <p className="text-gray-700 text-sm">
                              {notice.donationInfo}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Info box */}
        <div className="mt-8 p-6 bg-slate-100 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-2">
            About Paying a Shiva Call
          </h3>
          <p className="text-gray-600 text-sm">
            Visiting a shiva house to comfort mourners is a great mitzvah (nichum aveilim).
            It is customary to wait for the mourners to speak first, and to follow their lead
            in conversation. Traditionally, visitors do not greet or say goodbye to mourners
            in the usual way.
          </p>
        </div>
      </div>
    </div>
  );
}
