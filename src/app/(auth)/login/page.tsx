import { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to your FrumToronto account",
};

export default function LoginPage() {
  return (
    <AuthCard
      title="Welcome Back"
      description="Sign in to your FrumToronto account"
    >
      <Suspense fallback={<div>Loading...</div>}>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
