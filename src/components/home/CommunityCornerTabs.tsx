import Link from "next/link";
import { db } from "@/lib/db";
import { askTheRabbi, simchas, simchaTypes, shivaNotifications, tehillimList } from "@/lib/db/schema";
import { desc, eq, gte, and } from "drizzle-orm";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Heart, Users, BookOpen, ArrowRight } from "lucide-react";

// Fetch real Ask the Rabbi questions from database
async function getRecentQuestions() {
  const questions = await db
    .select({
      id: askTheRabbi.id,
      questionNumber: askTheRabbi.questionNumber,
      title: askTheRabbi.title,
    })
    .from(askTheRabbi)
    .where(eq(askTheRabbi.isPublished, true))
    .orderBy(desc(askTheRabbi.questionNumber))
    .limit(4);

  return questions;
}

// Fetch real simchas from database
async function getRecentSimchas() {
  const results = await db
    .select({
      id: simchas.id,
      familyName: simchas.familyName,
      announcement: simchas.announcement,
      typeName: simchaTypes.name,
    })
    .from(simchas)
    .leftJoin(simchaTypes, eq(simchas.typeId, simchaTypes.id))
    .where(and(
      eq(simchas.isActive, true),
      eq(simchas.approvalStatus, "approved")
    ))
    .orderBy(desc(simchas.createdAt))
    .limit(3);

  return results;
}

// Fetch real shiva notifications from database
async function getShivaNotices() {
  const today = new Date().toISOString().split("T")[0];
  const results = await db
    .select({
      id: shivaNotifications.id,
      niftarName: shivaNotifications.niftarName,
      mournerNames: shivaNotifications.mournerNames,
      shivaAddress: shivaNotifications.shivaAddress,
      shivaEnd: shivaNotifications.shivaEnd,
    })
    .from(shivaNotifications)
    .where(and(
      eq(shivaNotifications.approvalStatus, "approved"),
      gte(shivaNotifications.shivaEnd, today)
    ))
    .orderBy(shivaNotifications.shivaEnd)
    .limit(2);

  return results;
}

// Fetch real tehillim list from database
async function getTehillimNames() {
  const results = await db
    .select({
      id: tehillimList.id,
      hebrewName: tehillimList.hebrewName,
      englishName: tehillimList.englishName,
      motherHebrewName: tehillimList.motherHebrewName,
      reason: tehillimList.reason,
    })
    .from(tehillimList)
    .where(and(
      eq(tehillimList.isActive, true),
      eq(tehillimList.approvalStatus, "approved")
    ))
    .orderBy(desc(tehillimList.createdAt))
    .limit(4);

  return results;
}

export async function CommunityCornerTabs() {
  const [askTheRabbiQuestions, recentSimchas, shivaNotices, tehillimNames] = await Promise.all([
    getRecentQuestions(),
    getRecentSimchas(),
    getShivaNotices(),
    getTehillimNames(),
  ]);

  return (
    <section>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Community Corner</h2>
      <Card className="border-0 shadow-md">
        <Tabs defaultValue="ask-rabbi" className="w-full">
          <CardHeader className="pb-0">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="ask-rabbi" className="text-xs sm:text-sm">
                <MessageSquare className="h-4 w-4 mr-1 hidden sm:block" />
                Ask Rabbi
              </TabsTrigger>
              <TabsTrigger value="simchas" className="text-xs sm:text-sm">
                <Heart className="h-4 w-4 mr-1 hidden sm:block" />
                Simchas
              </TabsTrigger>
              <TabsTrigger value="shiva" className="text-xs sm:text-sm">
                <Users className="h-4 w-4 mr-1 hidden sm:block" />
                Shiva
              </TabsTrigger>
              <TabsTrigger value="tehillim" className="text-xs sm:text-sm">
                <BookOpen className="h-4 w-4 mr-1 hidden sm:block" />
                Tehillim
              </TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent className="pt-6">
            {/* Ask The Rabbi Tab */}
            <TabsContent value="ask-rabbi" className="mt-0">
              {askTheRabbiQuestions.length > 0 ? (
                <div className="space-y-3">
                  {askTheRabbiQuestions.map((q) => (
                    <Link
                      key={q.id}
                      href={`/ask-the-rabbi/${q.id}`}
                      className="block p-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{q.title}</p>
                          <p className="text-sm text-gray-500">Question #{q.questionNumber}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-800 ml-2 flex-shrink-0">
                          #{q.questionNumber}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <p>No questions available.</p>
                </div>
              )}
              <div className="mt-4 pt-4 border-t">
                <Button asChild variant="ghost" className="w-full">
                  <Link href="/ask-the-rabbi">
                    View All Questions <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </TabsContent>

            {/* Simchas Tab */}
            <TabsContent value="simchas" className="mt-0">
              {recentSimchas.length > 0 ? (
                <div className="space-y-3">
                  {recentSimchas.map((s) => (
                    <div key={s.id} className="p-3 rounded-lg bg-pink-50">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{s.familyName} Family</p>
                          <p className="text-sm text-gray-600">{s.announcement}</p>
                        </div>
                        {s.typeName && (
                          <Badge className="bg-pink-100 text-pink-800 hover:bg-pink-100">
                            {s.typeName}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <p>No recent simchas to display.</p>
                </div>
              )}
              <div className="mt-4 pt-4 border-t flex gap-2">
                <Button asChild variant="outline" className="flex-1">
                  <Link href="/simchas/new">Share a Simcha</Link>
                </Button>
                <Button asChild variant="ghost" className="flex-1">
                  <Link href="/simchas">
                    View All <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </TabsContent>

            {/* Shiva Tab */}
            <TabsContent value="shiva" className="mt-0">
              {shivaNotices.length > 0 ? (
                <div className="space-y-3">
                  {shivaNotices.map((s) => {
                    const mourners = Array.isArray(s.mournerNames) ? (s.mournerNames as string[]).join(", ") : "";
                    const endDate = s.shivaEnd ? new Date(s.shivaEnd).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
                    return (
                      <div key={s.id} className="p-3 rounded-lg bg-gray-50">
                        <p className="font-medium text-gray-900">{s.niftarName}</p>
                        {mourners && <p className="text-sm text-gray-600">{mourners}</p>}
                        <p className="text-sm text-gray-500 mt-1">
                          {s.shivaAddress}{endDate && ` • Until ${endDate}`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <p>No current shiva notices.</p>
                </div>
              )}
              <div className="mt-4 pt-4 border-t">
                <Button asChild variant="ghost" className="w-full">
                  <Link href="/shiva">
                    View All Notices <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </TabsContent>

            {/* Tehillim Tab */}
            <TabsContent value="tehillim" className="mt-0">
              {tehillimNames.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {tehillimNames.map((t) => (
                    <div key={t.id} className="p-3 rounded-lg bg-blue-50">
                      {t.hebrewName ? (
                        <p className="font-medium text-gray-900 text-sm" dir="rtl">
                          {t.hebrewName}
                          {t.motherHebrewName && <span className="text-gray-600"> בן/בת {t.motherHebrewName}</span>}
                        </p>
                      ) : (
                        <p className="font-medium text-gray-900 text-sm">
                          {t.englishName}
                          {t.motherHebrewName && <span className="text-gray-600"> ben/bat {t.motherHebrewName}</span>}
                        </p>
                      )}
                      {t.reason && <p className="text-xs text-gray-500">{t.reason}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <p>No names on the tehillim list.</p>
                </div>
              )}
              <div className="mt-4 pt-4 border-t flex gap-2">
                <Button asChild variant="outline" className="flex-1">
                  <Link href="/community/tehillim/add">Add Name</Link>
                </Button>
                <Button asChild variant="ghost" className="flex-1">
                  <Link href="/community/tehillim">
                    View All <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </section>
  );
}
