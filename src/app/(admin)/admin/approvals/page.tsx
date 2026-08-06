import { Metadata } from "next";
import { db } from "@/lib/db";
import { simchas, classifieds, tehillimList, simchaTypes, classifiedCategories, events } from "@/lib/db/schema";
import { eq, asc, desc, inArray } from "drizzle-orm";
import { PENDING_STATUSES } from "@/lib/submissions/statuses";
import { ApprovalsClient } from "./approvals-client";

export const metadata: Metadata = {
  title: "Content Approvals",
};

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const [pendingSimchas, pendingClassifieds, pendingTehillim, pendingEvents] = await Promise.all([
    db
      .select({
        id: simchas.id,
        familyName: simchas.familyName,
        announcement: simchas.announcement,
        approvalStatus: simchas.approvalStatus,
        createdAt: simchas.createdAt,
        updatedAt: simchas.updatedAt,
        typeName: simchaTypes.name,
      })
      .from(simchas)
      .leftJoin(simchaTypes, eq(simchas.typeId, simchaTypes.id))
      .where(inArray(simchas.approvalStatus, PENDING_STATUSES))
      .orderBy(desc(simchas.updatedAt), desc(simchas.id)),

    db
      .select({
        id: classifieds.id,
        title: classifieds.title,
        description: classifieds.description,
        price: classifieds.price,
        approvalStatus: classifieds.approvalStatus,
        createdAt: classifieds.createdAt,
        updatedAt: classifieds.updatedAt,
        categoryName: classifiedCategories.name,
      })
      .from(classifieds)
      .leftJoin(classifiedCategories, eq(classifieds.categoryId, classifiedCategories.id))
      .where(inArray(classifieds.approvalStatus, PENDING_STATUSES))
      .orderBy(desc(classifieds.updatedAt), desc(classifieds.id)),

    db
      .select({
        id: tehillimList.id,
        hebrewName: tehillimList.hebrewName,
        englishName: tehillimList.englishName,
        motherHebrewName: tehillimList.motherHebrewName,
        reason: tehillimList.reason,
        approvalStatus: tehillimList.approvalStatus,
        expiresAt: tehillimList.expiresAt,
        createdAt: tehillimList.createdAt,
        updatedAt: tehillimList.updatedAt,
      })
      .from(tehillimList)
      .where(inArray(tehillimList.approvalStatus, PENDING_STATUSES))
      .orderBy(desc(tehillimList.updatedAt), desc(tehillimList.id)),

    // Events had no approve control ANYWHERE in the admin panel — not here, not
    // on the events table, not in the edit form. The API routes existed and
    // worked; nothing called them. Ordered by start time ascending, not by
    // submission date: the one about to happen is the urgent one.
    db
      .select({
        id: events.id,
        title: events.title,
        description: events.description,
        location: events.location,
        startTime: events.startTime,
        organization: events.organization,
        approvalStatus: events.approvalStatus,
        createdAt: events.createdAt,
        updatedAt: events.updatedAt,
      })
      .from(events)
      .where(inArray(events.approvalStatus, PENDING_STATUSES))
      .orderBy(asc(events.startTime), asc(events.id)),
  ]);

  const counts = {
    simchas: pendingSimchas.length,
    classifieds: pendingClassifieds.length,
    tehillim: pendingTehillim.length,
    events: pendingEvents.length,
    total:
      pendingSimchas.length +
      pendingClassifieds.length +
      pendingTehillim.length +
      pendingEvents.length,
  };

  return (
    <ApprovalsClient
      simchas={pendingSimchas}
      classifieds={pendingClassifieds}
      tehillim={pendingTehillim}
      events={pendingEvents}
      counts={counts}
    />
  );
}
