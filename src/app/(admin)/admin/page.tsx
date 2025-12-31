import { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { businesses, users, simchas, tehillimList, events, classifieds } from "@/lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { Building2, Users, FileText, Calendar, ShoppingBag, AlertCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Admin Dashboard",
};

async function getStats() {
  const [
    pendingBusinessesResult,
    pendingSimchasResult,
    pendingClassifiedsResult,
    totalUsersResult,
    recentUsersResult,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(businesses)
      .where(eq(businesses.approvalStatus, "pending")),
    db
      .select({ count: sql<number>`count(*)` })
      .from(simchas)
      .where(eq(simchas.approvalStatus, "pending")),
    db
      .select({ count: sql<number>`count(*)` })
      .from(classifieds)
      .where(eq(classifieds.approvalStatus, "pending")),
    db.select({ count: sql<number>`count(*)` }).from(users),
    db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(5),
  ]);

  return {
    pendingBusinesses: Number(pendingBusinessesResult[0]?.count || 0),
    pendingSimchas: Number(pendingSimchasResult[0]?.count || 0),
    pendingClassifieds: Number(pendingClassifiedsResult[0]?.count || 0),
    totalUsers: Number(totalUsersResult[0]?.count || 0),
    recentUsers: recentUsersResult,
  };
}

export default async function AdminDashboardPage() {
  const stats = await getStats();
  const totalPending = stats.pendingBusinesses + stats.pendingSimchas + stats.pendingClassifieds;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        {totalPending > 0 && (
          <div className="flex items-center gap-2 bg-orange-100 text-orange-800 px-4 py-2 rounded-lg">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">{totalPending} items pending approval</span>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link href="/admin/businesses?status=pending">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Pending Businesses
              </CardTitle>
              <Building2 className="h-5 w-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.pendingBusinesses}</div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting approval</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/content?status=pending">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Pending Content
              </CardTitle>
              <FileText className="h-5 w-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.pendingSimchas}</div>
              <p className="text-xs text-muted-foreground mt-1">Simchas, tehillim, etc.</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/content?type=classifieds&status=pending">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Pending Classifieds
              </CardTitle>
              <ShoppingBag className="h-5 w-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.pendingClassifieds}</div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting review</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/users">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Users
              </CardTitle>
              <Users className="h-5 w-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground mt-1">Registered accounts</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Users */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Registrations</CardTitle>
            <Link href="/admin/users" className="text-sm text-blue-600 hover:underline">
              View all
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {stats.recentUsers.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No users registered yet</p>
          ) : (
            <div className="space-y-4">
              {stats.recentUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded capitalize">
                      {user.role}
                    </span>
                    <span className="text-xs text-gray-500">
                      {user.createdAt
                        ? new Date(user.createdAt).toLocaleDateString()
                        : "N/A"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
