import { db } from "@/lib/db";
import { simchas, simchaTypes } from "@/lib/db/schema";
import { eq, and, desc, ne } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PartyPopper, Calendar, MapPin, ArrowLeft } from "lucide-react";
import { formatInstant, formatDateOnly } from "@/lib/datetime";

export const revalidate = 300;

async function getSimcha(id: number) {
  const [row] = await db
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
    .where(
      and(
        eq(simchas.id, id),
        // Same visibility rule as the list: unapproved or deactivated
        // announcements must not be reachable by guessing an id.
        eq(simchas.isActive, true),
        eq(simchas.approvalStatus, "approved")
      )
    )
    .limit(1);

  return row ?? null;
}

/** A few more of the same type, so the page is not a dead end. */
async function getRelated(typeSlug: string | null, excludeId: number) {
  if (!typeSlug) return [];
  return db
    .select({
      id: simchas.id,
      familyName: simchas.familyName,
      createdAt: simchas.createdAt,
    })
    .from(simchas)
    .leftJoin(simchaTypes, eq(simchas.typeId, simchaTypes.id))
    .where(
      and(
        eq(simchaTypes.slug, typeSlug),
        eq(simchas.isActive, true),
        eq(simchas.approvalStatus, "approved"),
        ne(simchas.id, excludeId)
      )
    )
    .orderBy(desc(simchas.createdAt), desc(simchas.id))
    .limit(4);
}

function parseId(raw: string): number | null {
  // Reject "12abc" and similar: Number.parseInt would happily return 12.
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: rawId } = await params;
  const id = parseId(rawId);
  const simcha = id ? await getSimcha(id) : null;

  if (!simcha) return { title: "Simcha not found - FrumToronto" };

  // The announcement is plain text, so it can be used as a description as-is
  // once newlines are flattened.
  const description = simcha.announcement.replace(/\s*\n\s*/g, " ").slice(0, 200);

  return {
    title: `${simcha.familyName} - Simchas - FrumToronto`,
    description,
    openGraph: {
      title: simcha.familyName,
      description,
      type: "article",
    },
  };
}

export default async function SimchaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (!id) notFound();

  const simcha = await getSimcha(id);
  if (!simcha) notFound();

  const related = await getRelated(simcha.typeSlug, simcha.id);

  const posted = simcha.createdAt
    ? formatInstant(simcha.createdAt, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 text-white py-10">
        <div className="container mx-auto px-4">
          <Link
            href={simcha.typeSlug ? `/simchas?type=${simcha.typeSlug}` : "/simchas"}
            className="inline-flex items-center gap-2 text-sm text-purple-200 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {simcha.typeName ? simcha.typeName.toLowerCase() + "s" : "simchas"}
          </Link>

          <div className="mt-4 flex items-start gap-3">
            <PartyPopper className="h-8 w-8 shrink-0" />
            <h1 className="text-2xl md:text-4xl font-bold">{simcha.familyName}</h1>
          </div>

          {simcha.typeName && (
            <Badge className="mt-4 bg-white/15 text-white hover:bg-white/25">
              {simcha.typeName}
            </Badge>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl">
          <Card>
            {simcha.photoUrl && (
              <div className="relative h-64 bg-gray-100">
                <Image
                  src={simcha.photoUrl}
                  alt={simcha.familyName}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <CardContent className="py-6">
              {/* whitespace-pre-line so the paragraph breaks in the announcement
                  survive. The list cards deliberately collapse them to fit. */}
              <p className="whitespace-pre-line text-gray-800 leading-relaxed">
                {simcha.announcement}
              </p>

              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500 border-t border-gray-100 pt-4">
                {simcha.eventDate && (
                  <span className="inline-flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {formatDateOnly(simcha.eventDate, { month: "numeric", day: "numeric", year: "numeric" })}
                  </span>
                )}
                {simcha.location && (
                  <span className="inline-flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {simcha.location}
                  </span>
                )}
                {posted && <span>Posted {posted}</span>}
              </div>
            </CardContent>
          </Card>

          {related.length > 0 && (
            <div className="mt-10">
              <h2 className="text-lg font-semibold text-gray-900">
                More {simcha.typeName ? simcha.typeName.toLowerCase() + "s" : "simchas"}
              </h2>
              <ul className="mt-3 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/simchas/${r.id}`}
                      className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-purple-50 transition-colors"
                    >
                      <span className="text-sm font-medium text-gray-900">
                        {r.familyName}
                      </span>
                      {r.createdAt && (
                        <span className="shrink-0 text-xs text-gray-500">
                          {formatInstant(r.createdAt, { month: "numeric", day: "numeric", year: "numeric" })}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
