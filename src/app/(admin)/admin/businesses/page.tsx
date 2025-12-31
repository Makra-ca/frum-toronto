import { Metadata } from "next";
import { db } from "@/lib/db";
import { businesses, users, businessCategories } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { BusinessApprovalList } from "@/components/admin/BusinessApprovalList";

export const metadata: Metadata = {
  title: "Business Approvals",
};

export default async function AdminBusinessesPage() {
  const pendingBusinesses = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      description: businesses.description,
      email: businesses.email,
      phone: businesses.phone,
      address: businesses.address,
      approvalStatus: businesses.approvalStatus,
      createdAt: businesses.createdAt,
      categoryName: businessCategories.name,
      ownerEmail: users.email,
      ownerName: users.firstName,
    })
    .from(businesses)
    .leftJoin(businessCategories, eq(businesses.categoryId, businessCategories.id))
    .leftJoin(users, eq(businesses.userId, users.id))
    .where(eq(businesses.approvalStatus, "pending"))
    .orderBy(desc(businesses.createdAt));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Business Approvals</h1>
          <p className="text-gray-600 mt-1">
            Review and approve business listings
          </p>
        </div>
        <div className="text-sm text-gray-500">
          {pendingBusinesses.length} pending
        </div>
      </div>

      {pendingBusinesses.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">No pending business approvals</p>
        </div>
      ) : (
        <BusinessApprovalList businesses={pendingBusinesses} />
      )}
    </div>
  );
}
