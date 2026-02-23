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
import { AlertCircle, CheckCircle, Loader2, Bell } from "lucide-react";

const notificationOptions = [
  { id: "newsletter", label: "Weekly Newsletter", description: "Community updates and announcements" },
  { id: "simchas", label: "Simchas", description: "Mazel tov announcements" },
  { id: "shiva", label: "Shiva Notices", description: "Community bereavement notifications" },
  { id: "kosherAlerts", label: "Kosher Alerts", description: "Product recalls and certification updates" },
  { id: "tehillim", label: "Tehillim Updates", description: "Prayer list updates" },
  { id: "communityEvents", label: "Community Events", description: "Upcoming events and gatherings" },
  { id: "eruvStatus", label: "Eruv Status", description: "Weekly eruv status updates" },
] as const;

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
        simchas: false,
        shiva: false,
        kosherAlerts: false,
        tehillim: false,
        communityEvents: false,
        eruvStatus: false,
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
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-sm text-red-500">{errors.password.message}</p>
          )}
          <p className="text-xs text-gray-500">
            Must be 8+ characters with uppercase, lowercase, and number
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...register("confirmPassword")}
          />
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
            Choose which notifications you&apos;d like to receive
          </p>
          <div className="grid grid-cols-1 gap-2 p-3 bg-gray-50 rounded-lg border">
            {notificationOptions.map((option) => (
              <div key={option.id} className="flex items-start gap-3">
                <Checkbox
                  id={option.id}
                  checked={notifications?.[option.id] ?? false}
                  onCheckedChange={(checked) =>
                    setValue(`notifications.${option.id}`, checked === true)
                  }
                  className="mt-0.5"
                />
                <label htmlFor={option.id} className="flex-1 cursor-pointer">
                  <span className="text-sm font-medium">{option.label}</span>
                  <span className="block text-xs text-gray-500">{option.description}</span>
                </label>
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
