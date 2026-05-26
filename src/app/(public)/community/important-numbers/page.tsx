import { Metadata } from "next";
import { db } from "@/lib/db";
import { importantNumbers } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { Phone, AlertTriangle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Important Numbers | FrumToronto",
  description:
    "Community emergency and important contact numbers for Toronto's Jewish community.",
};

export const dynamic = "force-dynamic";

async function getImportantNumbers() {
  return db
    .select()
    .from(importantNumbers)
    .orderBy(asc(importantNumbers.displayOrder), asc(importantNumbers.name));
}

export default async function ImportantNumbersPage() {
  const numbers = await getImportantNumbers();

  // Group by category so emergency entries and categories are visible at a glance
  const emergencyNumbers = numbers.filter((n) => n.isEmergency);
  const regularNumbers = numbers.filter((n) => !n.isEmergency);

  // Build a sorted list of unique categories from regular numbers
  const categories = Array.from(
    new Set(regularNumbers.map((n) => n.category ?? "General"))
  ).sort();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-3 mb-3">
            <Phone className="h-8 w-8" />
            <h1 className="text-3xl md:text-4xl font-bold">Important Numbers</h1>
          </div>
          <p className="text-blue-200 max-w-2xl">
            Community emergency and important contact numbers for Toronto&apos;s
            Orthodox Jewish community.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 space-y-10">
        {numbers.length === 0 ? (
          <div className="rounded-xl border bg-white shadow-sm p-12 text-center">
            <Info className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              No numbers listed yet
            </h3>
            <p className="text-gray-500 text-sm">
              Check back soon — community contact numbers will appear here.
            </p>
          </div>
        ) : (
          <>
            {/* Emergency Numbers */}
            {emergencyNumbers.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <h2 className="text-xl font-bold text-gray-900">
                    Emergency Numbers
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {emergencyNumbers.map((entry) => (
                    <NumberCard key={entry.id} entry={entry} isEmergency />
                  ))}
                </div>
              </section>
            )}

            {/* Regular Numbers grouped by category */}
            {regularNumbers.length > 0 && (
              <section className="space-y-8">
                {categories.map((category) => {
                  const group = regularNumbers.filter(
                    (n) => (n.category ?? "General") === category
                  );
                  if (group.length === 0) return null;
                  return (
                    <div key={category}>
                      <h2 className="text-xl font-bold text-gray-900 mb-4">
                        {category}
                      </h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {group.map((entry) => (
                          <NumberCard key={entry.id} entry={entry} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface NumberEntry {
  id: number;
  name: string;
  phone: string;
  category: string | null;
  description: string | null;
  isEmergency: boolean | null;
  displayOrder: number | null;
}

function NumberCard({
  entry,
  isEmergency = false,
}: {
  entry: NumberEntry;
  isEmergency?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow ${
        isEmergency ? "border-red-200" : "border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`flex-shrink-0 rounded-full p-2 ${
              isEmergency ? "bg-red-100" : "bg-blue-100"
            }`}
          >
            <Phone
              className={`h-4 w-4 ${
                isEmergency ? "text-red-600" : "text-blue-700"
              }`}
            />
          </div>
          <h3 className="font-semibold text-gray-900 leading-snug truncate">
            {entry.name}
          </h3>
        </div>
        {isEmergency && (
          <Badge className="flex-shrink-0 bg-red-100 text-red-700 border-red-200 text-xs">
            Emergency
          </Badge>
        )}
      </div>

      {entry.description && (
        <p className="text-sm text-gray-500 leading-relaxed">
          {entry.description}
        </p>
      )}

      <a
        href={`tel:${entry.phone}`}
        className={`inline-flex items-center gap-1.5 font-semibold text-lg mt-auto ${
          isEmergency
            ? "text-red-600 hover:text-red-700"
            : "text-blue-700 hover:text-blue-800"
        } transition-colors`}
      >
        <Phone className="h-4 w-4" />
        {entry.phone}
      </a>
    </div>
  );
}
