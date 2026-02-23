import { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { MessageSquare, Tag, Calendar, Bell } from "lucide-react";

export const metadata: Metadata = {
  title: "Register",
  description: "Create a FrumToronto account",
};

const memberBenefits = [
  { icon: MessageSquare, text: "Submit questions to Ask the Rabbi" },
  { icon: Tag, text: "Post and manage classifieds" },
  { icon: Calendar, text: "Submit community events" },
  { icon: Bell, text: "Personalized notifications" },
];

export default function RegisterPage() {
  return (
    <AuthCard
      title="Create an Account"
      description="Join the FrumToronto community"
    >
      {/* Benefits */}
      <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-100">
        <p className="text-sm font-medium text-purple-900 mb-3">Member Benefits:</p>
        <ul className="space-y-2">
          {memberBenefits.map((benefit, index) => (
            <li key={index} className="flex items-center gap-2 text-sm text-purple-700">
              <benefit.icon className="h-4 w-4 flex-shrink-0" />
              <span>{benefit.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <RegisterForm />
    </AuthCard>
  );
}
