import { Metadata } from "next";
import { db } from "@/lib/db";
import { simchas, classifieds, tehillimList, simchaTypes, classifiedCategories } from "@/lib/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { PENDING_STATUSES } from "@/lib/submissions/statuses";
import { ApprovalsClient } from "./approvals-client";

export const metadata: Metadata = {
  title: "Content Approvals",
};

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const [pendingSimchas, pendingClassifieds, pendingTehillim] = await Promise.all([
    db
      .select({
        id: simchas.id,
        familyName: simchas.familyName,
        announcement: simchas.announcement,
        approvalStatus: simchas.approvalStatus,
        createdAt: simchas.createdAt,
        typeName: simchaTypes.name,
      })
      .from(simchas)
      .leftJoin(simchaTypes, eq(simchas.typeId, simchaTypes.id))
      .where(inArray(simchas.approvalStatus, PENDING_STATUSES))
      .orderBy(desc(simchas.createdAt)),

    db
      .select({
        id: classifieds.id,
        title: classifieds.title,
        description: classifieds.description,
        price: classifieds.price,
        approvalStatus: classifieds.approvalStatus,
        createdAt: classifieds.createdAt,
        categoryName: classifiedCategories.name,
      })
      .from(classifieds)
      .leftJoin(classifiedCategories, eq(classifieds.categoryId, classifiedCategories.id))
      .where(inArray(classifieds.approvalStatus, PENDING_STATUSES))
      .orderBy(desc(classifieds.createdAt)),

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
      })
      .from(tehillimList)
      .where(inArray(tehillimList.approvalStatus, PENDING_STATUSES))
      .orderBy(desc(tehillimList.createdAt)),
  ]);

  const counts = {
    simchas: pendingSimchas.length,
    classifieds: pendingClassifieds.length,
    tehillim: pendingTehillim.length,
    total: pendingSimchas.length + pendingClassifieds.length + pendingTehillim.length,
  };

  return (
    <ApprovalsClient
      simchas={pendingSimchas}
      classifieds={pendingClassifieds}
      tehillim={pendingTehillim}
      counts={counts}
    />
  );
}
