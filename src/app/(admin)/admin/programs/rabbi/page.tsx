"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { SubmissionsInbox } from "@/components/ask-the-rabbi/manage/SubmissionsInbox";

// A shell. The screen itself lives in components/ask-the-rabbi/manage/ so the
// dashboard can render the same one — the person who holds
// canManageAskTheRabbi is a `member` and cannot reach /admin at all.
//
// The <h1> comes from (admin)/admin/programs/layout.tsx; nothing here or in
// SubmissionsInbox adds one.
export default function AdminAskTheRabbiPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">Manage question submissions</span>
        <Link href="/admin/programs/rabbi/comments">
          <Button variant="outline" size="sm" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Moderation Comments
          </Button>
        </Link>
      </div>

      <SubmissionsInbox />
    </div>
  );
}
