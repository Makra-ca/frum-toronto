import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { businesses, subscriptionPlans, businessSubscriptions } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { Building2, ArrowUpRight, Sparkles } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const userId = parseInt(session.user.id);

  // Get user's businesses with their subscription plans
  const userBusinesses = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      planName: subscriptionPlans.name,
      planSlug: subscriptionPlans.slug,
      subscriptionStatus: businessSubscriptions.status,
    })
    .from(businesses)
    .leftJoin(subscriptionPlans, eq(businesses.subscriptionPlanId, subscriptionPlans.id))
    .leftJoin(businessSubscriptions, eq(businesses.id, businessSubscriptions.businessId))
    .where(eq(businesses.userId, userId));

  // Check if any business is on free plan
  const hasFreePlanBusiness = userBusinesses.some(
    (b) => !b.planSlug || b.planSlug === "free"
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Welcome back, {session.user.name || session.user.email}!
          </p>
        </div>

        {/* Business Upgrade Prompt */}
        {hasFreePlanBusiness && (
          <div className="mb-6 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="bg-white/20 rounded-lg p-3">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    Upgrade Your Business Listing
                  </h3>
                  <p className="text-blue-100 mt-1">
                    Get more visibility with premium features like featured placement,
                    full contact details, business hours, and more.
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard/business/new"
                className="flex items-center gap-2 bg-white text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-50 transition-colors whitespace-nowrap"
              >
                View Plans
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Business Summary */}
        {userBusinesses.length > 0 && (
          <div className="mb-6 bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                My Businesses
              </h2>
              <Link
                href="/dashboard/business"
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                View All →
              </Link>
            </div>
            <div className="space-y-3">
              {userBusinesses.slice(0, 3).map((business) => (
                <div
                  key={business.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <span className="font-medium text-gray-900">{business.name}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        business.planSlug === "premium"
                          ? "bg-blue-100 text-blue-700"
                          : business.planSlug === "standard"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {business.planName || "Free"}
                    </span>
                    {(!business.planSlug || business.planSlug === "free") && (
                      <Link
                        href="/dashboard/business/new"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Upgrade
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Your Profile
            </h2>
            <div className="space-y-2 text-sm text-gray-600">
              <p>
                <span className="font-medium">Email:</span> {session.user.email}
              </p>
              <p>
                <span className="font-medium">Role:</span>{" "}
                <span className="capitalize">{session.user.role}</span>
              </p>
              {session.user.isTrusted && (
                <p className="text-green-600 font-medium">✓ Trusted User</p>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Quick Actions
            </h2>
            <div className="space-y-3">
              <Link
                href="/dashboard/settings"
                className="block text-blue-600 hover:text-blue-800"
              >
                → Notification Settings
              </Link>
              <Link
                href="/directory"
                className="block text-blue-600 hover:text-blue-800"
              >
                → Browse Business Directory
              </Link>
              <Link
                href="/classifieds"
                className="block text-blue-600 hover:text-blue-800"
              >
                → View Classifieds
              </Link>
              <Link
                href="/dashboard/tehillim"
                className="block text-blue-600 hover:text-blue-800"
              >
                → My Tehillim Submissions
              </Link>
              {(session.user.role === "business" ||
                session.user.role === "admin") && (
                <Link
                  href="/dashboard/business"
                  className="block text-blue-600 hover:text-blue-800"
                >
                  → Manage My Business
                </Link>
              )}
              {(session.user.role === "shul" ||
                session.user.role === "admin") && (
                <Link
                  href="/dashboard/shuls"
                  className="block text-blue-600 hover:text-blue-800"
                >
                  → Manage My Shuls
                </Link>
              )}
              {session.user.role === "admin" && (
                <Link
                  href="/admin"
                  className="block text-blue-600 hover:text-blue-800"
                >
                  → Admin Panel
                </Link>
              )}
            </div>
          </div>

          {/* Account Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Account Status
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    session.user.email ? "bg-green-500" : "bg-yellow-500"
                  }`}
                />
                <span className="text-gray-600">Email Verified</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-gray-600">Account Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
