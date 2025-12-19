import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { classifieds, classifiedCategories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ShoppingBag, ChevronRight, Clock, Mail, Tag, MapPin, DollarSign } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const classified = await db
    .select({ title: classifieds.title })
    .from(classifieds)
    .where(eq(classifieds.id, parseInt(id)))
    .limit(1);

  if (!classified[0]) {
    return { title: "Classified Not Found" };
  }

  return {
    title: `${classified[0].title} - Classifieds`,
    description: `View classified listing: ${classified[0].title}`,
  };
}

async function getClassified(id: number) {
  const result = await db
    .select({
      id: classifieds.id,
      title: classifieds.title,
      description: classifieds.description,
      price: classifieds.price,
      priceType: classifieds.priceType,
      contactName: classifieds.contactName,
      contactEmail: classifieds.contactEmail,
      contactPhone: classifieds.contactPhone,
      location: classifieds.location,
      createdAt: classifieds.createdAt,
      expiresAt: classifieds.expiresAt,
      categoryId: classifieds.categoryId,
      categoryName: classifiedCategories.name,
      categorySlug: classifiedCategories.slug,
    })
    .from(classifieds)
    .leftJoin(classifiedCategories, eq(classifieds.categoryId, classifiedCategories.id))
    .where(eq(classifieds.id, id))
    .limit(1);

  return result[0] || null;
}

export default async function ClassifiedDetailPage({ params }: PageProps) {
  const { id } = await params;
  const classified = await getClassified(parseInt(id));

  if (!classified) {
    notFound();
  }

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Format the description with proper paragraphs
  const formatDescription = (text: string | null) => {
    if (!text) return null;
    return text.split(/\n+/).filter(p => p.trim()).map((paragraph, i) => (
      <p key={i} className="mb-4 last:mb-0">
        {paragraph}
      </p>
    ));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 text-white py-8">
        <div className="container mx-auto px-4">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-orange-200 mb-4">
            <Link href="/classifieds" className="hover:text-white">
              Classifieds
            </Link>
            {classified.categoryName && (
              <>
                <ChevronRight className="h-4 w-4" />
                <Link
                  href={`/classifieds?category=${classified.categorySlug}`}
                  className="hover:text-white"
                >
                  {classified.categoryName}
                </Link>
              </>
            )}
            <ChevronRight className="h-4 w-4" />
            <span className="text-white truncate max-w-xs">{classified.title}</span>
          </nav>

          <div className="flex items-center gap-3">
            <ShoppingBag className="h-7 w-7" />
            <h1 className="text-2xl md:text-3xl font-bold">{classified.title}</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Category & Date Badge */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            {classified.categoryName && (
              <Badge className="bg-orange-100 text-orange-800">
                <Tag className="h-3 w-3 mr-1" />
                {classified.categoryName}
              </Badge>
            )}
            {classified.createdAt && (
              <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                <Clock className="h-3 w-3 mr-1" />
                Posted {formatDate(classified.createdAt)}
              </Badge>
            )}
          </div>

          {/* Price */}
          {classified.price && (
            <Card className="border-0 shadow-md mb-6 bg-green-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-6 w-6 text-green-600" />
                  <span className="text-2xl font-bold text-green-700">
                    ${Number(classified.price).toLocaleString()}
                  </span>
                  {classified.priceType && classified.priceType !== "fixed" && (
                    <Badge variant="secondary" className="ml-2">
                      {classified.priceType}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Description */}
          <Card className="border-0 shadow-md mb-6">
            <CardContent className="p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Details</h2>
              <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {formatDescription(classified.description)}
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          {classified.location && (
            <Card className="border-0 shadow-md mb-6">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Location</h3>
                    <p className="text-gray-600">{classified.location}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contact Info */}
          {(classified.contactEmail || classified.contactPhone || classified.contactName) && (
            <Card className="border-0 shadow-md mb-6 bg-blue-50">
              <CardContent className="p-6">
                <h2 className="font-semibold text-gray-900 mb-4">Contact Information</h2>
                <div className="space-y-3">
                  {classified.contactName && (
                    <p className="text-gray-700">
                      <span className="font-medium">Name:</span> {classified.contactName}
                    </p>
                  )}
                  {classified.contactEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <a
                        href={`mailto:${classified.contactEmail}`}
                        className="text-blue-600 hover:underline"
                      >
                        {classified.contactEmail}
                      </a>
                    </div>
                  )}
                  {classified.contactPhone && (
                    <p className="text-gray-700">
                      <span className="font-medium">Phone:</span>{" "}
                      <a href={`tel:${classified.contactPhone}`} className="text-blue-600 hover:underline">
                        {classified.contactPhone}
                      </a>
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Expiry Notice */}
          {classified.expiresAt && (
            <div className="text-sm text-gray-500 text-center mb-6">
              This listing expires on {formatDate(classified.expiresAt)}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-center mt-8">
            <Button asChild variant="ghost">
              <Link href="/classifieds">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Classifieds
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
