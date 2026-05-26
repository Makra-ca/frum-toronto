"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  newsletter: "the Weekly Newsletter",
  kosherAlerts: "Kosher Alerts",
  simchas: "Simcha announcements",
  shiva: "Shiva notices",
  tehillim: "Tehillim requests",
  communityEvents: "Event announcements",
  communityAlerts: "Community alerts",
  eruvStatus: "Eruv status updates",
  askTheRabbiAnswered: "Ask the Rabbi answer notifications",
  atrCommentReplies: "Ask the Rabbi comment reply notifications",
  blogCommentNotifications: "Blog comment notifications",
  businessDeals: "Business deals & specials",
};

function UnsubscribedContent() {
  const searchParams = useSearchParams();
  const type = searchParams.get("type") || "";
  const token = searchParams.get("token") || "";

  const typeLabel = TYPE_LABELS[type] || "these notifications";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md mx-auto text-center p-8 bg-white rounded-lg shadow-lg">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-3">You&apos;ve been unsubscribed</h1>
        <p className="text-gray-600 mb-6">
          You will no longer receive emails about{" "}
          <strong>{typeLabel}</strong>.
        </p>
        <div className="flex flex-col gap-3">
          <Button asChild>
            <Link
              href={token ? `/newsletter/preferences?token=${token}` : "/newsletter/preferences"}
            >
              Manage all email preferences
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Return to FrumToronto</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function UnsubscribedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        </div>
      }
    >
      <UnsubscribedContent />
    </Suspense>
  );
}
