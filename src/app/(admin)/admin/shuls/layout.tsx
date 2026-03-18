"use client";

import { usePathname } from "next/navigation";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Building, ClipboardList, UserCog } from "lucide-react";

const shulTabs = [
  { href: "/admin/shuls", label: "All Shuls", icon: Building, exact: true },
  { href: "/admin/shuls/requests", label: "Requests", icon: ClipboardList },
  { href: "/admin/shuls/managers", label: "Managers", icon: UserCog },
];

export default function ShulsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDetailPage = /^\/admin\/shuls\/\d+/.test(pathname);

  return (
    <div className="space-y-6">
      {!isDetailPage && (
        <>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Shuls</h1>
            <p className="text-gray-600 mt-1">Manage synagogues, registration requests, and manager assignments</p>
          </div>
          <AdminTabs tabs={shulTabs} />
        </>
      )}
      {children}
    </div>
  );
}
