import { Suspense } from "react";
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
      <span className="text-sm text-gray-500">
        Review submitted questions, manage the published library, and moderate comments
      </span>

      <Suspense fallback={null}>
        <AtrManageTabs />
      </Suspense>
    </div>
  );
}
