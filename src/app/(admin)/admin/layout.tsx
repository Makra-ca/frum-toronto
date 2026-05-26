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

  if (!session) {
    redirect("/login?callbackUrl=/admin");
  }

  if (session.user.role !== "admin") {
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
