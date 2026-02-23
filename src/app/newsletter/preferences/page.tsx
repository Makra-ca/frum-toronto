"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

interface Preferences {
  newsletter: boolean;
  kosherAlerts: boolean;
  eruvStatus: boolean;
  simchas: boolean;
  shiva: boolean;
  tehillim: boolean;
  communityEvents: boolean;
}

const SUBSCRIPTION_OPTIONS = [
  {
    key: "newsletter",
    label: "Weekly Newsletter",
    description: "Community news, events, and announcements",
  },
  {
    key: "kosherAlerts",
    label: "Kosher Alerts",
    description: "Important kosher-related notices and updates",
  },
  {
    key: "eruvStatus",
    label: "Eruv Status",
    description: "Weekly eruv status notifications",
  },
  {
    key: "simchas",
    label: "Simchas",
    description: "Community celebrations and mazel tov announcements",
  },
  {
    key: "shiva",
    label: "Shiva Notices",
    description: "Condolence and shiva information",
  },
  {
    key: "tehillim",
    label: "Tehillim Updates",
    description: "Updates about the community tehillim list",
  },
  {
    key: "communityEvents",
    label: "Community Events",
    description: "Notifications about upcoming events and gatherings",
  },
] as const;

function PreferencesContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "loaded" | "invalid" | "unsubscribed">("loading");
  const [email, setEmail] = useState<string>("");
  const [preferences, setPreferences] = useState<Preferences>({
    newsletter: false,
    kosherAlerts: false,
    eruvStatus: false,
    simchas: false,
    shiva: false,
    tehillim: false,
    communityEvents: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    const fetchSubscriber = async () => {
      try {
        const res = await fetch(`/api/newsletter/unsubscribe?token=${token}`);
        if (!res.ok) {
          setStatus("invalid");
          return;
        }

        const data = await res.json();
        setEmail(data.email);

        if (data.unsubscribedAt) {
          setStatus("unsubscribed");
        } else {
          setPreferences({
            newsletter: data.newsletter,
            kosherAlerts: data.kosherAlerts,
            eruvStatus: data.eruvStatus,
            simchas: data.simchas,
            shiva: data.shiva,
            tehillim: data.tehillim || false,
            communityEvents: data.communityEvents || false,
          });
          setStatus("loaded");
        }
      } catch (error) {
        console.error(error);
        setStatus("invalid");
      }
    };

    fetchSubscriber();
  }, [token]);

  const handleSave = async () => {
    if (!token) return;

    setIsSaving(true);
    try {
      const res = await fetch("/api/newsletter/unsubscribe", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, preferences }),
      });

      if (res.ok) {
        setSaved(true);
        toast.success("Preferences saved!");
        setTimeout(() => setSaved(false), 3000);
      } else {
        toast.error("Failed to save preferences");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to save preferences");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResubscribe = async () => {
    if (!token) return;

    setIsSaving(true);
    try {
      const res = await fetch("/api/newsletter/unsubscribe", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          preferences: { newsletter: true, kosherAlerts: false, eruvStatus: false, simchas: false, shiva: false, tehillim: false, communityEvents: false },
        }),
      });

      if (res.ok) {
        setPreferences({
          newsletter: true,
          kosherAlerts: false,
          eruvStatus: false,
          simchas: false,
          shiva: false,
          tehillim: false,
          communityEvents: false,
        });
        setStatus("loaded");
        toast.success("Welcome back! You've been re-subscribed.");
      } else {
        toast.error("Failed to re-subscribe");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to re-subscribe");
    } finally {
      setIsSaving(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading your preferences...</p>
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
            This preferences link is invalid or has expired.
          </p>
          <Button asChild>
            <Link href="/">Return to FrumToronto</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (status === "unsubscribed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md mx-auto text-center p-8 bg-white rounded-lg shadow-lg">
          <Mail className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re Unsubscribed</h1>
          <p className="text-gray-600 mb-2">
            <strong>{email}</strong> is currently unsubscribed from all FrumToronto emails.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            Would you like to re-subscribe and manage your preferences?
          </p>
          <div className="flex flex-col gap-3">
            <Button onClick={handleResubscribe} disabled={isSaving}>
              {isSaving ? "Re-subscribing..." : "Re-subscribe"}
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Return to FrumToronto</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-lg mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-blue-900 px-6 py-8 text-center">
            <h1 className="text-2xl font-bold text-white mb-1">
              Frum<span className="text-blue-300">Toronto</span>
            </h1>
            <p className="text-blue-200 text-sm">Email Preferences</p>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-gray-600 mb-6">
              Managing preferences for <strong>{email}</strong>
            </p>

            <div className="space-y-6">
              {SUBSCRIPTION_OPTIONS.map(({ key, label, description }) => (
                <div key={key} className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <Label htmlFor={key} className="font-medium text-gray-900 cursor-pointer">
                      {label}
                    </Label>
                    <p className="text-sm text-gray-500 mt-0.5">{description}</p>
                  </div>
                  <Switch
                    id={key}
                    checked={preferences[key as keyof Preferences]}
                    onCheckedChange={(checked) =>
                      setPreferences((prev) => ({ ...prev, [key]: checked }))
                    }
                  />
                </div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t flex flex-col sm:flex-row gap-3">
              <Button onClick={handleSave} disabled={isSaving} className="flex-1">
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : saved ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Saved!
                  </>
                ) : (
                  "Save Preferences"
                )}
              </Button>
              <Button variant="outline" asChild className="flex-1">
                <Link href="/">Return to FrumToronto</Link>
              </Button>
            </div>

            <div className="mt-6 pt-4 border-t text-center">
              <Link
                href={`/newsletter/unsubscribe?token=${token}`}
                className="text-sm text-red-600 hover:text-red-700 hover:underline"
              >
                Unsubscribe from all emails
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PreferencesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        </div>
      }
    >
      <PreferencesContent />
    </Suspense>
  );
}
