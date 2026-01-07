import { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to your FrumToronto account",
};

export default async function LoginPage() {
  // Redirect logged-in users to dashboard
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

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
