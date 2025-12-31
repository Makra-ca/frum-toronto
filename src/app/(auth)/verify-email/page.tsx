import { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { VerifyEmailContent } from "@/components/auth/VerifyEmailContent";

export const metadata: Metadata = {
  title: "Verify Email",
  description: "Verify your FrumToronto email address",
};

export default function VerifyEmailPage() {
  return (
    <AuthCard title="Email Verification">
      <Suspense fallback={<div>Loading...</div>}>
        <VerifyEmailContent />
      </Suspense>
    </AuthCard>
  );
}
