"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { registerSchema, RegisterInput } from "@/lib/validations/auth";
import { AlertCircle, CheckCircle, Loader2, Bell, Eye, EyeOff } from "lucide-react";

const notificationGroups = [
  {
    label: "Community Updates",
    options: [
      { id: "communityEvents", label: "Event announcements", description: "Upcoming events and gatherings" },
      { id: "kosherAlerts", label: "Kosher alerts", description: "Product recalls and certification updates" },
      { id: "simchas", label: "Simchas (births, engagements, weddings)", description: "" },
      { id: "shiva", label: "Shiva notices", description: "" },
      { id: "tehillim", label: "Tehillim requests", description: "" },
      { id: "communityAlerts", label: "Community alerts", description: "Important announcements and urgent notices" },
    ],
  },
  {
    label: "Torah Content",
    options: [
      { id: "newsletter", label: "Weekly newsletter", description: "Community updates and announcements" },
      { id: "askTheRabbiAnswered", label: "Ask the Rabbi — when my question is answered", description: "" },
      { id: "atrCommentReplies", label: "Ask the Rabbi — comment replies", description: "" },
    ],
  },
  {
    label: "Blog & Business",
    options: [
      { id: "blogCommentNotifications", label: "Blog post comments (on my posts)", description: "" },
      { id: "businessDeals", label: "Business deals & specials", description: "" },
    ],
  },
] as const;

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      notifications: {
        newsletter: true,
        simchas: true,
        shiva: true,
        kosherAlerts: true,
        tehillim: true,
        communityEvents: true,
        communityAlerts: true,
        eruvStatus: false,
        askTheRabbiAnswered: true,
        atrCommentReplies: true,
        blogCommentNotifications: true,
        businessDeals: false,
      },
    },
  });

  const notifications = watch("notifications");

  const onSubmit = async (data: RegisterInput) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Registration failed");
        setIsLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("An error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle className="h-6 w-6 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold">Check your email</h3>
        <p className="text-gray-600">
          We&apos;ve sent a verification link to your email address. Please click the
          link to verify your account.
        </p>
        <Link href="/login">
          <Button variant="outline" className="mt-4">
            Go to Login
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <GoogleSignInButton />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-muted-foreground">
            Or register with email
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <Alert variant="destructive" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input
              id="firstName"
              placeholder="John"
              autoComplete="given-name"
              {...register("firstName")}
            />
            {errors.firstName && (
              <p className="text-sm text-red-500">{errors.firstName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input
              id="lastName"
              placeholder="Doe"
              autoComplete="family-name"
              {...register("lastName")}
            />
            {errors.lastName && (
              <p className="text-sm text-red-500">{errors.lastName.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-sm text-red-500">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              className="pr-10"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-sm text-red-500">{errors.password.message}</p>
          )}
          <p className="text-xs text-gray-500">
            Must be 8+ characters with uppercase, lowercase, and number
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              className="pr-10"
              {...register("confirmPassword")}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              tabIndex={-1}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
          )}
        </div>

        {/* Notification Preferences */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-blue-600" />
            <Label className="text-sm font-medium">Email Notifications</Label>
          </div>
          <p className="text-xs text-gray-500 -mt-1">
            Choose what you&apos;d like to hear about
          </p>
          <div className="space-y-3">
            {notificationGroups.map((group) => (
              <div key={group.label}>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  {group.label}
                </p>
                <div className="grid grid-cols-1 gap-2 p-3 bg-gray-50 rounded-lg border">
                  {group.options.map((option) => (
                    <div key={option.id} className="flex items-start gap-3">
                      <Checkbox
                        id={`notifications.${option.id}`}
                        checked={(notifications as Record<string, boolean>)?.[option.id] ?? false}
                        onCheckedChange={(checked) =>
                          setValue(
                            `notifications.${option.id}` as `notifications.${keyof RegisterInput["notifications"]}`,
                            checked === true
                          )
                        }
                        className="mt-0.5"
                      />
                      <label htmlFor={`notifications.${option.id}`} className="flex-1 cursor-pointer">
                        <span className="text-sm">{option.label}</span>
                        {option.description && (
                          <span className="block text-xs text-gray-500">{option.description}</span>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create Account"
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-gray-600">
        Already have an account?{" "}
        <Link href="/login" className="text-blue-600 hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}
