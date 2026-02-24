"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Bell, Save, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface NotificationPreferences {
  newsletter: boolean;
  simchas: boolean;
  shiva: boolean;
  kosherAlerts: boolean;
  tehillim: boolean;
  communityEvents: boolean;
  communityAlerts: boolean;
  eruvStatus: boolean;
}

const notificationOptions = [
  {
    id: "newsletter" as const,
    label: "Weekly Newsletter",
    description: "Community updates and announcements sent weekly"
  },
  {
    id: "simchas" as const,
    label: "Simchas",
    description: "Receive notifications about mazel tov announcements"
  },
  {
    id: "shiva" as const,
    label: "Shiva Notices",
    description: "Community bereavement notifications"
  },
  {
    id: "kosherAlerts" as const,
    label: "Kosher Alerts",
    description: "Product recalls and kosher certification updates"
  },
  {
    id: "tehillim" as const,
    label: "Tehillim Updates",
    description: "Updates about the community tehillim list"
  },
  {
    id: "communityEvents" as const,
    label: "Community Events",
    description: "Notifications about upcoming events and gatherings"
  },
  {
    id: "communityAlerts" as const,
    label: "Community Alerts",
    description: "Important community announcements and urgent notices"
  },
  {
    id: "eruvStatus" as const,
    label: "Eruv Status",
    description: "Weekly eruv status updates before Shabbos"
  },
];

export default function SettingsPage() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    newsletter: true,
    simchas: false,
    shiva: false,
    kosherAlerts: false,
    tehillim: false,
    communityEvents: false,
    communityAlerts: false,
    eruvStatus: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalPreferences, setOriginalPreferences] = useState<NotificationPreferences | null>(null);

  useEffect(() => {
    fetchPreferences();
  }, []);

  useEffect(() => {
    if (originalPreferences) {
      const changed = Object.keys(preferences).some(
        (key) => preferences[key as keyof NotificationPreferences] !== originalPreferences[key as keyof NotificationPreferences]
      );
      setHasChanges(changed);
    }
  }, [preferences, originalPreferences]);

  const fetchPreferences = async () => {
    try {
      const res = await fetch("/api/user/notification-preferences");
      if (res.ok) {
        const data = await res.json();
        setPreferences(data);
        setOriginalPreferences(data);
      }
    } catch (error) {
      console.error("Error fetching preferences:", error);
      toast.error("Failed to load preferences");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/user/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });

      if (res.ok) {
        const updated = await res.json();
        setOriginalPreferences(updated);
        setHasChanges(false);
        toast.success("Notification preferences saved");
      } else {
        toast.error("Failed to save preferences");
      }
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast.error("Failed to save preferences");
    } finally {
      setIsSaving(false);
    }
  };

  const togglePreference = (key: keyof NotificationPreferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const selectAll = () => {
    setPreferences({
      newsletter: true,
      simchas: true,
      shiva: true,
      kosherAlerts: true,
      tehillim: true,
      communityEvents: true,
      communityAlerts: true,
      eruvStatus: true,
    });
  };

  const deselectAll = () => {
    setPreferences({
      newsletter: false,
      simchas: false,
      shiva: false,
      kosherAlerts: false,
      tehillim: false,
      communityEvents: false,
      communityAlerts: false,
      eruvStatus: false,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Bell className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Choose which email notifications you&apos;d like to receive
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Quick actions */}
            <div className="flex gap-2 pb-4 border-b">
              <Button variant="outline" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>
                Deselect All
              </Button>
            </div>

            {/* Notification options */}
            <div className="space-y-4">
              {notificationOptions.map((option) => (
                <div
                  key={option.id}
                  className="flex items-center justify-between py-3 border-b last:border-0"
                >
                  <div className="space-y-0.5">
                    <Label htmlFor={option.id} className="text-base font-medium cursor-pointer">
                      {option.label}
                    </Label>
                    <p className="text-sm text-gray-500">{option.description}</p>
                  </div>
                  <Switch
                    id={option.id}
                    checked={preferences[option.id]}
                    onCheckedChange={() => togglePreference(option.id)}
                  />
                </div>
              ))}
            </div>

            {/* Save button */}
            <div className="pt-4">
              <Button
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
                className="w-full"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Preferences
                  </>
                )}
              </Button>
              {hasChanges && (
                <p className="text-center text-sm text-amber-600 mt-2">
                  You have unsaved changes
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
