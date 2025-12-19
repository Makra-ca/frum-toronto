import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { businesses, businessCategories } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Phone,
  Mail,
  Globe,
  Clock,
  ChevronRight,
  ArrowLeft,
  ExternalLink,
  Navigation,
} from "lucide-react";
import { OpenNowBadge } from "@/components/directory/OpenNowBadge";
import { ShareButton } from "@/components/directory/ShareButton";
import { getDirectionsUrl, getPhoneLink, formatPhoneDisplay } from "@/lib/directory/utils";

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface BusinessHours {
  [key: string]: { open: string; close: string } | null;
}

interface BusinessData {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  hours: BusinessHours | null;
  isKosher: boolean | null;
  kosherCertification: string | null;
  categoryId: number | null;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const business = await db
    .select({ name: businesses.name, description: businesses.description })
    .from(businesses)
    .where(eq(businesses.slug, slug))
    .limit(1);

  if (!business[0]) {
    return { title: "Business Not Found" };
  }

  return {
    title: `${business[0].name} - FrumToronto Business Directory`,
    description: business[0].description || `${business[0].name} - Toronto Jewish community business`,
  };
}

async function getBusinessData(slug: string) {
  const businessResult = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      slug: businesses.slug,
      description: businesses.description,
      address: businesses.address,
      city: businesses.city,
      postalCode: businesses.postalCode,
      phone: businesses.phone,
      email: businesses.email,
      website: businesses.website,
      logoUrl: businesses.logoUrl,
      hours: businesses.hours,
      isKosher: businesses.isKosher,
      kosherCertification: businesses.kosherCertification,
      categoryId: businesses.categoryId,
    })
    .from(businesses)
    .where(eq(businesses.slug, slug))
    .limit(1);

  if (!businessResult[0]) {
    return null;
  }

  const rawBusiness = businessResult[0];
  const business: BusinessData = {
    ...rawBusiness,
    hours: rawBusiness.hours as BusinessHours | null,
  };

  // Get category info
  let category = null;
  let parentCategory = null;

  if (business.categoryId) {
    const catResult = await db
      .select({
        id: businessCategories.id,
        name: businessCategories.name,
        slug: businessCategories.slug,
        parentId: businessCategories.parentId,
      })
      .from(businessCategories)
      .where(eq(businessCategories.id, business.categoryId))
      .limit(1);

    if (catResult[0]) {
      category = catResult[0];

      if (category.parentId) {
        const parentResult = await db
          .select({
            name: businessCategories.name,
            slug: businessCategories.slug,
          })
          .from(businessCategories)
          .where(eq(businessCategories.id, category.parentId))
          .limit(1);

        parentCategory = parentResult[0] || null;
      }
    }
  }

  // Get related businesses in same category
  const relatedBusinesses = business.categoryId
    ? await db
        .select({
          id: businesses.id,
          name: businesses.name,
          slug: businesses.slug,
          city: businesses.city,
          isKosher: businesses.isKosher,
          kosherCertification: businesses.kosherCertification,
        })
        .from(businesses)
        .where(
          sql`${businesses.categoryId} = ${business.categoryId}
            AND ${businesses.id} != ${business.id}
            AND ${businesses.isActive} = true
            AND ${businesses.approvalStatus} = 'approved'`
        )
        .limit(5)
    : [];

  // Increment view count
  await db
    .update(businesses)
    .set({ viewCount: sql`COALESCE(${businesses.viewCount}, 0) + 1` })
    .where(eq(businesses.id, business.id));

  return {
    business,
    category,
    parentCategory,
    relatedBusinesses,
  };
}

export default async function BusinessPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getBusinessData(slug);

  if (!data) {
    notFound();
  }

  const { business, category, parentCategory, relatedBusinesses } = data;

  const fullAddress = [business.address, business.city, business.postalCode]
    .filter(Boolean)
    .join(", ");

  const googleMapsUrl = business.address
    ? getDirectionsUrl(business.address, business.city ?? undefined)
    : null;

  const websiteUrl = business.website
    ? business.website.startsWith("http")
      ? business.website
      : `https://${business.website}`
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 text-white py-8">
        <div className="container mx-auto px-4">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-blue-200 mb-4 flex-wrap">
            <Link href="/directory" className="hover:text-white">
              Directory
            </Link>
            {parentCategory && (
              <>
                <ChevronRight className="h-4 w-4" />
                <Link
                  href={`/directory/category/${parentCategory.slug}`}
                  className="hover:text-white"
                >
                  {parentCategory.name}
                </Link>
              </>
            )}
            {category && (
              <>
                <ChevronRight className="h-4 w-4" />
                <Link
                  href={`/directory/${category.slug}`}
                  className="hover:text-white"
                >
                  {category.name}
                </Link>
              </>
            )}
            <ChevronRight className="h-4 w-4" />
            <span className="text-white truncate">{business.name}</span>
          </nav>

          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex gap-4">
              {/* Logo */}
              <div className="w-20 h-20 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                {business.logoUrl ? (
                  <img
                    src={business.logoUrl}
                    alt={business.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-bold text-white/50">
                    {business.name.charAt(0)}
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <h1 className="text-2xl md:text-3xl font-bold">
                    {business.name}
                  </h1>
                  {business.isKosher && (
                    <Badge className="bg-green-500 hover:bg-green-600">
                      {business.kosherCertification || "Kosher"}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-blue-200">
                  {category && <span>{category.name}</span>}
                  {business.city && (
                    <>
                      <span>•</span>
                      <span>{business.city}</span>
                    </>
                  )}
                  {business.hours && (
                    <>
                      <span>•</span>
                      <OpenNowBadge hours={business.hours} variant="light" />
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex gap-2 flex-wrap">
              {business.phone && (
                <Button asChild className="bg-white text-blue-900 hover:bg-blue-50">
                  <a href={getPhoneLink(business.phone)}>
                    <Phone className="h-4 w-4 mr-2" />
                    Call
                  </a>
                </Button>
              )}
              {googleMapsUrl && (
                <Button asChild variant="secondary" className="bg-white/20 hover:bg-white/30 text-white">
                  <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                    <Navigation className="h-4 w-4 mr-2" />
                    Directions
                  </a>
                </Button>
              )}
              <ShareButton
                title={business.name}
                text={`Check out ${business.name} on FrumToronto`}
                className="bg-white/20 hover:bg-white/30 text-white border-0"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Content */}
          <main className="flex-1 space-y-6">
            {/* About */}
            {business.description && (
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle>About</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 whitespace-pre-line leading-relaxed">
                    {business.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Contact Information */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {fullAddress && (
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <MapPin className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Address</p>
                        <p className="text-gray-600 text-sm">{fullAddress}</p>
                        {googleMapsUrl && (
                          <a
                            href={googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1"
                          >
                            Get Directions
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {business.phone && (
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                        <Phone className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Phone</p>
                        <a
                          href={getPhoneLink(business.phone)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          {formatPhoneDisplay(business.phone)}
                        </a>
                      </div>
                    </div>
                  )}

                  {business.email && (
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                        <Mail className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Email</p>
                        <a
                          href={`mailto:${business.email}`}
                          className="text-blue-600 hover:text-blue-800 text-sm break-all"
                        >
                          {business.email}
                        </a>
                      </div>
                    </div>
                  )}

                  {websiteUrl && (
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                        <Globe className="h-5 w-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Website</p>
                        <a
                          href={websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
                        >
                          {business.website?.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Business Hours */}
            {business.hours && (
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Business Hours
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].map(
                      (day) => {
                        const hours = business.hours?.[day];
                        const isToday = new Date().toLocaleDateString("en-US", {
                          weekday: "long",
                          timeZone: "America/Toronto",
                        }).toLowerCase() === day;

                        return (
                          <div
                            key={day}
                            className={`flex justify-between py-2 px-3 rounded-lg ${
                              isToday ? "bg-blue-50" : ""
                            }`}
                          >
                            <span className={`capitalize ${isToday ? "font-semibold text-blue-900" : "text-gray-700"}`}>
                              {day}
                              {isToday && <span className="text-xs ml-2 text-blue-600">(Today)</span>}
                            </span>
                            <span className={isToday ? "font-medium text-blue-900" : "text-gray-600"}>
                              {hours ? `${hours.open} - ${hours.close}` : "Closed"}
                            </span>
                          </div>
                        );
                      }
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Map */}
            {fullAddress && (
              <Card className="border-0 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  <div className="aspect-video w-full bg-gray-100">
                    <iframe
                      src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodeURIComponent(fullAddress)}`}
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      title={`Map showing location of ${business.name}`}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </main>

          {/* Sidebar */}
          <aside className="lg:w-80 flex-shrink-0 space-y-6">
            {/* Quick Contact Card */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Quick Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {business.phone && (
                  <Button asChild className="w-full">
                    <a href={getPhoneLink(business.phone)}>
                      <Phone className="h-4 w-4 mr-2" />
                      Call Now
                    </a>
                  </Button>
                )}
                {business.email && (
                  <Button asChild variant="outline" className="w-full">
                    <a href={`mailto:${business.email}`}>
                      <Mail className="h-4 w-4 mr-2" />
                      Send Email
                    </a>
                  </Button>
                )}
                {websiteUrl && (
                  <Button asChild variant="outline" className="w-full">
                    <a href={websiteUrl} target="_blank" rel="noopener noreferrer">
                      <Globe className="h-4 w-4 mr-2" />
                      Visit Website
                    </a>
                  </Button>
                )}
                {googleMapsUrl && (
                  <Button asChild variant="outline" className="w-full">
                    <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                      <Navigation className="h-4 w-4 mr-2" />
                      Get Directions
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Related Businesses */}
            {relatedBusinesses.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Related Businesses</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="space-y-2">
                    {relatedBusinesses.map((related) => (
                      <li key={related.id}>
                        <Link
                          href={`/directory/business/${related.slug}`}
                          className="block p-2 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm text-gray-900">
                              {related.name}
                            </p>
                            {related.isKosher && related.kosherCertification && (
                              <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                                {related.kosherCertification}
                              </Badge>
                            )}
                          </div>
                          {related.city && (
                            <p className="text-xs text-gray-500">{related.city}</p>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Back to Category */}
            {category && (
              <Button asChild variant="outline" className="w-full">
                <Link href={`/directory/${category.slug}`}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to {category.name}
                </Link>
              </Button>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
