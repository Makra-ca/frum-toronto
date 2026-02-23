import { Metadata } from "next";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { UserTable } from "@/components/admin/UserTable";

export const metadata: Metadata = {
  title: "User Management",
};

export default async function AdminUsersPage() {
  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      isActive: users.isActive,
      isTrusted: users.isTrusted,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
      canAutoApproveShiva: users.canAutoApproveShiva,
      canAutoApproveTehillim: users.canAutoApproveTehillim,
      canAutoApproveBusinesses: users.canAutoApproveBusinesses,
      canAutoApproveAskTheRabbi: users.canAutoApproveAskTheRabbi,
      canAutoApproveKosherAlerts: users.canAutoApproveKosherAlerts,
      canAutoApproveShuls: users.canAutoApproveShuls,
      canAutoApproveSimchas: users.canAutoApproveSimchas,
      canAutoApproveEvents: users.canAutoApproveEvents,
      canAutoApproveClassifieds: users.canAutoApproveClassifieds,
      canAutoApproveShiurim: users.canAutoApproveShiurim,
      canPostSpecials: users.canPostSpecials,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">
            Manage user roles, trust status, and account settings
          </p>
        </div>
        <div className="text-sm text-gray-500">
          {allUsers.length} total users
        </div>
      </div>

      <UserTable users={allUsers} />
    </div>
  );
}
