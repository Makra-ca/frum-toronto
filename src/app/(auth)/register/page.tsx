import { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = {
  title: "Register",
  description: "Create a FrumToronto account",
};

export default function RegisterPage() {
  return (
    <AuthCard
      title="Create an Account"
      description="Join the FrumToronto community"
    >
      <RegisterForm />
    </AuthCard>
  );
}
