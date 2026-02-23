import { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { tehillimList } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus } from "lucide-react";

export const metadata: Metadata = {
  title: "Tehillim List | Frum Toronto",
  description: "Community Tehillim prayer list for those in need of healing and support",
};

export const revalidate = 60; // Revalidate every minute

export default async function TehillimPage() {
  const names = await db
    .select()
    .from(tehillimList)
    .where(
      and(
        eq(tehillimList.approvalStatus, "approved"),
        eq(tehillimList.isActive, true)
      )
    )
    .orderBy(desc(tehillimList.createdAt));

  return (
    <div className="container max-w-4xl mx-auto py-12 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tehillim List</h1>
          <p className="text-gray-600 mt-1">
            Please include these names in your Tehillim prayers
          </p>
        </div>
        <Link href="/community/tehillim/add">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Name
          </Button>
        </Link>
      </div>

      {names.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <p className="text-gray-500">No names on the Tehillim list at this time.</p>
              <Link href="/community/tehillim/add">
                <Button variant="outline">Add the First Name</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Names for Refuah Shleima</CardTitle>
            <CardDescription>
              {names.length} {names.length === 1 ? "name" : "names"} on the list
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {names.map((name) => (
                <div key={name.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between">
                    <div>
                      {name.hebrewName ? (
                        <>
                          <p className="text-lg font-medium" dir="rtl">
                            {name.hebrewName}
                            {name.motherHebrewName && (
                              <span className="text-gray-600"> בן/בת {name.motherHebrewName}</span>
                            )}
                          </p>
                          {name.englishName && (
                            <p className="text-sm text-gray-500">
                              {name.englishName}
                              {name.motherHebrewName && ` ben/bat ${name.motherHebrewName}`}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-lg font-medium">
                          {name.englishName}
                          {name.motherHebrewName && (
                            <span className="text-gray-600"> ben/bat {name.motherHebrewName}</span>
                          )}
                        </p>
                      )}
                      {name.reason && (
                        <p className="text-sm text-gray-400 mt-1">{name.reason}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800 text-center">
          May all those on this list merit a complete and speedy recovery.
          <br />
          <span className="font-hebrew">רפואה שלמה בקרוב</span>
        </p>
      </div>
    </div>
  );
}
