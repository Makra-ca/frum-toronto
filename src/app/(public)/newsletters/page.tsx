import { db } from "@/lib/db";
import { shulDocuments, shuls, communityNewsletters } from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Newspaper, FileText, Download, Building2, Info } from "lucide-react";

export const metadata = {
  title: "Newsletters - FrumToronto",
  description:
    "Community and shul newsletters for Toronto's Jewish community — all in one place.",
};

export const dynamic = "force-dynamic";

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date | string | null): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function getCommunityNewsletters() {
  return db
    .select()
    .from(communityNewsletters)
    .where(eq(communityNewsletters.isActive, true))
    .orderBy(desc(communityNewsletters.publishedAt));
}

async function getShulNewsletters() {
  return db
    .select({
      id: shulDocuments.id,
      title: shulDocuments.title,
      fileUrl: shulDocuments.fileUrl,
      fileSize: shulDocuments.fileSize,
      description: shulDocuments.description,
      publishedAt: shulDocuments.publishedAt,
      shulName: shuls.name,
      shulSlug: shuls.slug,
    })
    .from(shulDocuments)
    .leftJoin(shuls, eq(shulDocuments.shulId, shuls.id))
    .where(
      and(eq(shulDocuments.type, "newsletter"), eq(shulDocuments.isActive, true))
    )
    .orderBy(desc(shulDocuments.publishedAt));
}

export default async function NewslettersPage() {
  const [community, shulNewsletters] = await Promise.all([
    getCommunityNewsletters(),
    getShulNewsletters(),
  ]);

  const hasAny = community.length > 0 || shulNewsletters.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-3 mb-3">
            <Newspaper className="h-8 w-8" />
            <h1 className="text-3xl md:text-4xl font-bold">Newsletters</h1>
          </div>
          <p className="text-blue-200 max-w-2xl">
            Community and shul newsletters, all in one place — no need to visit each shul.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-10">
        {!hasAny && (
          <Card>
            <CardContent className="py-12 text-center">
              <Info className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Newsletters Yet</h3>
              <p className="text-gray-500">Check back soon for community and shul newsletters.</p>
            </CardContent>
          </Card>
        )}

        {/* Community newsletters */}
        {community.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Community Newsletters</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {community.map((n) => (
                <a
                  key={`c-${n.id}`}
                  href={n.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group"
                >
                  <Card className="h-full hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <FileText className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 group-hover:text-blue-700 transition-colors line-clamp-2">
                            {n.title}
                          </p>
                          {n.publisher && (
                            <p className="text-xs text-gray-500 mt-0.5">{n.publisher}</p>
                          )}
                          {n.description && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{n.description}</p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
                            <Download className="h-3 w-3" />
                            <span>
                              {formatDate(n.publishedAt)}
                              {n.fileSize ? ` · ${formatFileSize(n.fileSize)}` : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Shul newsletters */}
        {shulNewsletters.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Shul Newsletters</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {shulNewsletters.map((n) => (
                <a
                  key={`s-${n.id}`}
                  href={n.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group"
                >
                  <Card className="h-full hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                          <FileText className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 group-hover:text-blue-700 transition-colors line-clamp-2">
                            {n.title}
                          </p>
                          {n.shulName && (
                            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {n.shulName}
                            </p>
                          )}
                          {n.description && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{n.description}</p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
                            <Download className="h-3 w-3" />
                            <span>
                              {formatDate(n.publishedAt)}
                              {n.fileSize ? ` · ${formatFileSize(n.fileSize)}` : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
