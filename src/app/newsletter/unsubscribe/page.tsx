"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error" | "invalid">("loading");
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    const unsubscribe = async () => {
      try {
        // First get subscriber info
        const infoRes = await fetch(`/api/newsletter/unsubscribe?token=${token}`);
        if (!infoRes.ok) {
          setStatus("invalid");
          return;
        }
        const info = await infoRes.json();
        setEmail(info.email);

        // Then unsubscribe
        const res = await fetch("/api/newsletter/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        if (res.ok) {
          setStatus("success");
        } else {
          setStatus("error");
        }
      } catch (error) {
        console.error(error);
        setStatus("error");
      }
    };

    unsubscribe();
  }, [token]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Processing your request...</p>
        </div>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md mx-auto text-center p-8 bg-white rounded-lg shadow-lg">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-gray-600 mb-6">
            This unsubscribe link is invalid or has expired.
          </p>
          <Button asChild>
            <Link href="/">Return to FrumToronto</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md mx-auto text-center p-8 bg-white rounded-lg shadow-lg">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Something Went Wrong</h1>
          <p className="text-gray-600 mb-6">
            We couldn&apos;t process your unsubscribe request. Please try again later.
          </p>
          <Button asChild>
            <Link href="/">Return to FrumToronto</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md mx-auto text-center p-8 bg-white rounded-lg shadow-lg">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Unsubscribed Successfully</h1>
        <p className="text-gray-600 mb-2">
          {email && (
            <>
              <strong>{email}</strong> has been removed from our mailing list.
            </>
          )}
        </p>
        <p className="text-gray-500 text-sm mb-6">
          You will no longer receive newsletters from FrumToronto. If this was a mistake, you can
          re-subscribe at any time.
        </p>
        <div className="flex flex-col gap-3">
          <Button asChild>
            <Link href="/">Return to FrumToronto</Link>
          </Button>
          {token && (
            <Button variant="outline" asChild>
              <Link href={`/newsletter/preferences?token=${token}`}>Manage Preferences Instead</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        </div>
      }
    >
      <UnsubscribeContent />
    </Suspense>
  );
}
