import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Welcome back, {session.user.name || session.user.email}!
          </p>
        </div>

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
