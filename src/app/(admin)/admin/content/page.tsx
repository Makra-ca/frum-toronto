import { Metadata } from "next";
import { db } from "@/lib/db";
import { simchas, classifieds, tehillimList, simchaTypes, classifiedCategories } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { ContentApprovalTabs } from "@/components/admin/ContentApprovalTabs";

export const metadata: Metadata = {
  title: "Content Approvals",
};

export default async function AdminContentPage() {
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
      .where(eq(simchas.approvalStatus, "pending"))
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
      .where(eq(classifieds.approvalStatus, "pending"))
      .orderBy(desc(classifieds.createdAt)),

    db
      .select({
        id: tehillimList.id,
        hebrewName: tehillimList.hebrewName,
        englishName: tehillimList.englishName,
        motherHebrewName: tehillimList.motherHebrewName,
        reason: tehillimList.reason,
        approvalStatus: tehillimList.approvalStatus,
        createdAt: tehillimList.createdAt,
      })
      .from(tehillimList)
      .where(eq(tehillimList.approvalStatus, "pending"))
      .orderBy(desc(tehillimList.createdAt)),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Content Approvals</h1>
        <p className="text-gray-600 mt-1">
          Review and approve community content submissions
        </p>
      </div>

      <ContentApprovalTabs
        simchas={pendingSimchas}
        classifieds={pendingClassifieds}
        tehillim={pendingTehillim}
      />
    </div>
  );
}
