import { Suspense } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AtrManageTabs } from "@/components/ask-the-rabbi/manage/AtrManageTabs";

export const dynamic = "force-dynamic";

/**
 * Admin shell for Ask the Rabbi.
 *
 * The screens live in components/ask-the-rabbi/manage/ and are rendered
 * identically by /dashboard/ask-the-rabbi — the one person holding
 * canManageAskTheRabbi is a `member` and cannot reach /admin at all.
 *
 * A server component under a "use client" layout is fine: children arrive as an
 * already-rendered slot. AtrManageTabs uses useSearchParams, hence Suspense.
 * The <h1> comes from (admin)/admin/programs/layout.tsx.
 */
export default function AdminAskTheRabbiPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-gray-500">
          Review submitted questions, manage the published library, and moderate comments
        </span>

        {/*
          Deliberately here and not inside AtrManageTabs: that component is
          also rendered at /dashboard/ask-the-rabbi for the manager who is a
          plain member, and the settings page and its API are admin-only. A
          shared link would be a dead end for them.
        */}
        <Link href="/admin/programs/comment-settings">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-1.5" />
            Comment Settings
          </Button>
        </Link>
      </div>

      <Suspense fallback={null}>
        <AtrManageTabs />
      </Suspense>
    </div>
  );
}
