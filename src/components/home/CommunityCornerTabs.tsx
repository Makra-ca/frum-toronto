import { db } from "@/lib/db";
import {
  askTheRabbi,
  simchas,
  simchaTypes,
  shivaNotifications,
  tehillimList,
  alerts,
  kosherAlerts,
} from "@/lib/db/schema";
import { desc, eq, gte, and, or, isNull } from "drizzle-orm";
import { CommunityCornerClient } from "@/components/home/CommunityCornerClient";
import type { UnifiedItem } from "@/components/home/CommunityCornerClient";

async function getRecentQuestions() {
  return db
    .select({
      id: askTheRabbi.id,
      questionNumber: askTheRabbi.questionNumber,
      title: askTheRabbi.title,
      question: askTheRabbi.question,
      publishedAt: askTheRabbi.publishedAt,
    })
    .from(askTheRabbi)
    .where(eq(askTheRabbi.isPublished, true))
    .orderBy(desc(askTheRabbi.questionNumber))
    .limit(10);
}

async function getRecentSimchas() {
  return db
    .select({
      id: simchas.id,
      familyName: simchas.familyName,
      announcement: simchas.announcement,
      eventDate: simchas.eventDate,
      typeName: simchaTypes.name,
      createdAt: simchas.createdAt,
    })
    .from(simchas)
    .leftJoin(simchaTypes, eq(simchas.typeId, simchaTypes.id))
    .where(
      and(eq(simchas.isActive, true), eq(simchas.approvalStatus, "approved"))
    )
    .orderBy(desc(simchas.createdAt))
    .limit(10);
}

async function getKosherAlerts() {
  return db
    .select({
      id: kosherAlerts.id,
      productName: kosherAlerts.productName,
      brand: kosherAlerts.brand,
      alertType: kosherAlerts.alertType,
      certifyingAgency: kosherAlerts.certifyingAgency,
      description: kosherAlerts.description,
      createdAt: kosherAlerts.createdAt,
    })
    .from(kosherAlerts)
    .where(
      and(
        eq(kosherAlerts.isActive, true),
        eq(kosherAlerts.approvalStatus, "approved")
      )
    )
    .orderBy(desc(kosherAlerts.createdAt))
    .limit(10);
}

async function getBulletinAlerts() {
  const now = new Date();
  return db
    .select({
      id: alerts.id,
      title: alerts.title,
      content: alerts.content,
      alertType: alerts.alertType,
      urgency: alerts.urgency,
      createdAt: alerts.createdAt,
    })
    .from(alerts)
    .where(
      and(
        eq(alerts.isActive, true),
        eq(alerts.approvalStatus, "approved"),
        or(isNull(alerts.expiresAt), gte(alerts.expiresAt, now))
      )
    )
    .orderBy(desc(alerts.isPinned), desc(alerts.createdAt))
    .limit(10);
}

async function getShivaNotices() {
  const today = new Date().toISOString().split("T")[0];
  return db
    .select({
      id: shivaNotifications.id,
      niftarName: shivaNotifications.niftarName,
      mournerNames: shivaNotifications.mournerNames,
      shivaAddress: shivaNotifications.shivaAddress,
      shivaEnd: shivaNotifications.shivaEnd,
      createdAt: shivaNotifications.createdAt,
    })
    .from(shivaNotifications)
    .where(
      and(
        eq(shivaNotifications.approvalStatus, "approved"),
        gte(shivaNotifications.shivaEnd, today)
      )
    )
    .orderBy(shivaNotifications.shivaEnd)
    .limit(10);
}

async function getTehillimNames() {
  return db
    .select({
      id: tehillimList.id,
      hebrewName: tehillimList.hebrewName,
      englishName: tehillimList.englishName,
      motherHebrewName: tehillimList.motherHebrewName,
      reason: tehillimList.reason,
      createdAt: tehillimList.createdAt,
    })
    .from(tehillimList)
    .where(
      and(
        eq(tehillimList.isActive, true),
        eq(tehillimList.approvalStatus, "approved")
      )
    )
    .orderBy(desc(tehillimList.createdAt))
    .limit(10);
}

function toIso(d: Date | null | undefined): string {
  return d ? d.toISOString() : new Date(0).toISOString();
}

export async function CommunityCornerTabs() {
  const [
    askTheRabbiItems,
    simchasItems,
    kosherAlertItems,
    bulletinAlertItems,
    shivaItems,
    tehillimItems,
  ] = await Promise.all([
    getRecentQuestions(),
    getRecentSimchas(),
    getKosherAlerts(),
    getBulletinAlerts(),
    getShivaNotices(),
    getTehillimNames(),
  ]);

  // Merge all items into one unified list with tab type and sortDate
  const unified: UnifiedItem[] = [
    ...askTheRabbiItems.map((q) => ({
      tab: "ask-rabbi" as const,
      sortDate: toIso(q.publishedAt),
      data: {
        id: q.id,
        questionNumber: q.questionNumber,
        title: q.title,
        question: q.question,
      },
    })),
    ...simchasItems.map((s) => ({
      tab: "simchas" as const,
      sortDate: toIso(s.createdAt),
      data: {
        id: s.id,
        familyName: s.familyName,
        announcement: s.announcement,
        eventDate: s.eventDate ? String(s.eventDate) : null,
        typeName: s.typeName,
      },
    })),
    ...kosherAlertItems.map((k) => ({
      tab: "kosher-alerts" as const,
      sortDate: toIso(k.createdAt),
      data: {
        id: k.id,
        productName: k.productName,
        brand: k.brand,
        alertType: k.alertType,
        certifyingAgency: k.certifyingAgency,
        description: k.description,
      },
    })),
    ...bulletinAlertItems.map((a) => ({
      tab: "bulletin" as const,
      sortDate: toIso(a.createdAt),
      data: {
        id: a.id,
        title: a.title,
        content: a.content,
        alertType: a.alertType,
        urgency: a.urgency ?? "normal",
        createdAt: toIso(a.createdAt),
      },
    })),
    ...shivaItems.map((s) => ({
      tab: "shiva" as const,
      sortDate: toIso(s.createdAt),
      data: {
        id: s.id,
        niftarName: s.niftarName,
        mournerNames: Array.isArray(s.mournerNames)
          ? (s.mournerNames as string[])
          : null,
        shivaAddress: s.shivaAddress,
        shivaEnd: s.shivaEnd ? String(s.shivaEnd) : null,
      },
    })),
    ...tehillimItems.map((t) => ({
      tab: "tehillim" as const,
      sortDate: toIso(t.createdAt),
      data: {
        id: t.id,
        hebrewName: t.hebrewName,
        englishName: t.englishName,
        motherHebrewName: t.motherHebrewName,
        reason: t.reason,
      },
    })),
  ];

  // Sort by most recent first
  unified.sort(
    (a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime()
  );

  return (
    <section>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Community Corner
      </h2>
      <CommunityCornerClient items={unified} />
    </section>
  );
}
