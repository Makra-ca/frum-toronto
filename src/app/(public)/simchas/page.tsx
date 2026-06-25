import { db } from "@/lib/db";
import { simchas, simchaTypes } from "@/lib/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PartyPopper, Calendar, MapPin, Info } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { SimchaSubmitModal } from "@/components/simchas/SimchaSubmitModal";

export const metadata = {
  title: "Simchas - FrumToronto",
  description: "Celebrate simchas with the Toronto Jewish community - mazal tovs, engagements, weddings, and more",
};

export const revalidate = 300; // Cache for 5 minutes

async function getSimchas(typeSlug?: string) {
  const conditions = [
    eq(simchas.isActive, true),
    eq(simchas.approvalStatus, "approved"),
  ];
  if (typeSlug) {
    conditions.push(eq(simchaTypes.slug, typeSlug));
  }

  const simchasList = await db
    .select({
      id: simchas.id,
      familyName: simchas.familyName,
      announcement: simchas.announcement,
      eventDate: simchas.eventDate,
      location: simchas.location,
      photoUrl: simchas.photoUrl,
      createdAt: simchas.createdAt,
      typeName: simchaTypes.name,
      typeSlug: simchaTypes.slug,
    })
    .from(simchas)
    .leftJoin(simchaTypes, eq(simchas.typeId, simchaTypes.id))
    .where(and(...conditions))
    .orderBy(desc(simchas.createdAt));

  return simchasList;
}

async function getSimchaTypes() {
  const types = await db
    .select()
    .from(simchaTypes)
    .orderBy(simchaTypes.displayOrder);

  return types;
}

export default async function SimchasPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type: activeType } = await searchParams;
  const [simchasList, types] = await Promise.all([
    getSimchas(activeType),
    getSimchaTypes(),
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <PartyPopper className="h-8 w-8" />
                <h1 className="text-3xl md:text-4xl font-bold">Simchas</h1>
              </div>
              <p className="text-purple-200 max-w-2xl">
                Celebrate with the Toronto Jewish community! Share in the joy of
                engagements, weddings, births, bar/bat mitzvahs, and other simchas.
              </p>
            </div>
            <SimchaSubmitModal />
          </div>
        </div>
      </div>

      {/* Quick filters */}
      {types.length > 0 && (
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-wrap gap-2">
            <Link href="/simchas">
              <Badge
                variant={!activeType ? "default" : "outline"}
                className={`cursor-pointer ${!activeType ? "bg-purple-600 hover:bg-purple-700" : "hover:bg-purple-50"}`}
              >
                All
              </Badge>
            </Link>
            {types.map((type) => {
              const isActive = activeType === type.slug;
              return (
                <Link key={type.id} href={`/simchas?type=${type.slug}`}>
                  <Badge
                    variant={isActive ? "default" : "outline"}
                    className={`cursor-pointer ${isActive ? "bg-purple-600 hover:bg-purple-700" : "hover:bg-purple-50"}`}
                  >
                    {type.name}
                  </Badge>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {simchasList.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Info className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {activeType ? "No simchas of this type yet" : "No Simchas Posted"}
              </h3>
              <p className="text-gray-500">
                {activeType ? (
                  <>
                    There are no simchas in this category right now.{" "}
                    <Link href="/simchas" className="text-purple-600 hover:underline">
                      View all simchas
                    </Link>
                  </>
                ) : (
                  "There are currently no simchas to display. Check back later to celebrate with our community!"
                )}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {simchasList.map((simcha) => (
              <Card key={simcha.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                {simcha.photoUrl && (
                  <div className="relative h-48 bg-gray-100">
                    <Image
                      src={simcha.photoUrl}
                      alt={simcha.familyName}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg text-gray-900">
                      {simcha.familyName}
                    </CardTitle>
                    {simcha.typeName && (
                      <Badge className="bg-purple-100 text-purple-800">
                        {simcha.typeName}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 mb-4 line-clamp-3">
                    {simcha.announcement}
                  </p>
                  <div className="space-y-2 text-sm text-gray-500">
                    {simcha.eventDate && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {new Date(simcha.eventDate).toLocaleDateString()}
                      </div>
                    )}
                    {simcha.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {simcha.location}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
