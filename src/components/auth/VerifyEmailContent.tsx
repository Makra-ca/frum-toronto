"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";

export function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token provided.");
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const result = await response.json();

        if (!response.ok) {
          setStatus("error");
          setMessage(result.error || "Verification failed.");
          return;
        }

        setStatus("success");
        setMessage(result.message);
      } catch {
        setStatus("error");
        setMessage("An error occurred during verification.");
      }
    };

    verifyEmail();
  }, [token]);

  if (status === "loading") {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
          <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
        </div>
        <h3 className="text-lg font-semibold">Verifying your email...</h3>
        <p className="text-gray-600">Please wait while we verify your email address.</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
          <AlertCircle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-semibold">Verification Failed</h3>
        <p className="text-gray-600">{message}</p>
        <div className="flex flex-col gap-2 mt-4">
          <Link href="/register">
            <Button variant="outline" className="w-full">
              Register Again
            </Button>
          </Link>
          <Link href="/login">
            <Button className="w-full">Go to Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center space-y-4">
      <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
        <CheckCircle className="h-6 w-6 text-green-600" />
      </div>
      <h3 className="text-lg font-semibold">Email Verified!</h3>
      <p className="text-gray-600">{message}</p>
      <Link href="/login">
        <Button className="mt-4">Sign In</Button>
      </Link>
    </div>
  );
}
