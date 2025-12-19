import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { businesses, businessCategories } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, ArrowRight } from "lucide-react";

// Fetch real featured businesses from database
async function getFeaturedBusinesses() {
  const results = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      slug: businesses.slug,
      description: businesses.description,
      address: businesses.address,
      city: businesses.city,
      phone: businesses.phone,
      logoUrl: businesses.logoUrl,
      isKosher: businesses.isKosher,
      kosherCertification: businesses.kosherCertification,
      categoryName: businessCategories.name,
    })
    .from(businesses)
    .leftJoin(businessCategories, eq(businesses.categoryId, businessCategories.id))
    .where(and(
      eq(businesses.isActive, true),
      eq(businesses.approvalStatus, "approved")
    ))
    .orderBy(desc(businesses.viewCount))
    .limit(4);

  return results;
}

export async function FeaturedBusinesses() {
  const featuredBusinesses = await getFeaturedBusinesses();

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Featured Businesses</h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/directory">
            View All <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {featuredBusinesses.map((business) => (
          <Link key={business.id} href={`/directory/business/${business.slug}`}>
            <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer border-0 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="flex">
                  {/* Logo/Image placeholder */}
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-blue-50 flex-shrink-0 flex items-center justify-center">
                    {business.logoUrl ? (
                      <Image
                        src={business.logoUrl}
                        alt={business.name}
                        width={96}
                        height={96}
                        className="object-cover"
                      />
                    ) : (
                      <span className="text-3xl font-bold text-blue-300">
                        {business.name.charAt(0)}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-3 flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {business.name}
                      </h3>
                      {business.isKosher && business.kosherCertification && (
                        <Badge variant="secondary" className="text-xs flex-shrink-0 bg-green-100 text-green-800">
                          {business.kosherCertification}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-blue-600 mb-1">{business.categoryName || "Business"}</p>
                    {business.description && (
                      <p className="text-xs text-gray-500 line-clamp-2 mb-2">
                        {business.description}
                      </p>
                    )}
                    {(business.address || business.city) && (
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {business.address && `${business.address}, `}{business.city}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {featuredBusinesses.length === 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-8 text-center">
            <p className="text-gray-500">No featured businesses yet.</p>
            <Button asChild variant="link" className="mt-2">
              <Link href="/directory">Browse Directory</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
