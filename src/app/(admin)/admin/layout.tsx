import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { AdminLayoutClient } from "@/components/admin/AdminLayoutClient";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Toaster } from "@/components/ui/sonner";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  console.log("[AUTH DEBUG] admin layout - session:", JSON.stringify(session));
  console.log("[AUTH DEBUG] admin layout - session.user.role:", session?.user?.role);

  if (!session) {
    console.log("[AUTH DEBUG] admin layout - no session, redirecting to login");
    redirect("/login?callbackUrl=/admin");
  }

  if (session.user.role !== "admin") {
    console.log("[AUTH DEBUG] admin layout - user role is not admin:", session.user.role);
    redirect("/");
  }

  return (
    <AdminLayoutClient>
      <AdminHeader user={session.user} />
      <main className="flex-1 p-4 md:p-6 overflow-x-hidden">{children}</main>
      <Toaster />
    </AdminLayoutClient>
  );
}
