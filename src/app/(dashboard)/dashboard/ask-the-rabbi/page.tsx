"use client";

import { useState, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  MessageSquare,
  ArrowLeft,
  Lock,
} from "lucide-react";
import { AtrManageTabs } from "@/components/ask-the-rabbi/manage/AtrManageTabs";

// Every screen this page renders lives in components/ask-the-rabbi/manage/, so
// the admin panel can render the same ones. This file is the non-admin shell:
// the person holding canManageAskTheRabbi is a `member` and cannot reach
// /admin. See docs/superpowers/specs/2026-08-03-ask-the-rabbi-management-*.

export default function AskTheRabbiDashboardPage() {
  const { status } = useSession();
  const [canManage, setCanManage] = useState<boolean | null>(null);

  // Check permission via a lightweight API call
  useEffect(() => {
    if (status !== "authenticated") return;

    fetch("/api/admin/ask-the-rabbi?page=1&limit=1")
      .then((res) => {
        setCanManage(res.ok);
      })
      .catch(() => setCanManage(false));
  }, [status]);

  if (status === "loading" || canManage === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-sm w-full mx-4">
          <CardContent className="py-12 text-center">
            <Lock className="h-10 w-10 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-600 mb-4">You must be logged in.</p>
            <Link href="/login">
              <Button>Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto py-12 px-4">
          <div className="mb-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Dashboard
            </Link>
          </div>
          <Card>
            <CardContent className="py-16 text-center">
              <Lock className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Access Restricted
              </h2>
              <p className="text-gray-500 max-w-sm mx-auto">
                You don&apos;t have access to this section. Contact an admin to
                request the Ask the Rabbi management permission.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto py-12 px-4">
        {/* Back link */}
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-purple-600" />
              <div>
                <CardTitle>Ask the Rabbi — Management</CardTitle>
                <CardDescription className="mt-0.5">
                  Manage published Q&amp;As and moderate community comments
                </CardDescription>
              </div>
            </div>

            {/* Tab nav */}
            <div className="mt-4">
              <Suspense fallback={null}>
                {/* defaultTab="questions" is deliberate: this page has always
                    landed on the library, and the submissions table has zero
                    rows — defaulting the one non-admin manager to a permanently
                    empty inbox would be a downgrade. An explicit ?tab= wins. */}
                <AtrManageTabs defaultTab="questions" />
              </Suspense>
            </div>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
