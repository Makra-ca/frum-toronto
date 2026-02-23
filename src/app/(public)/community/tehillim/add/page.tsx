"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { AlertCircle, CheckCircle, Loader2, Clock } from "lucide-react";

const QUICK_DURATIONS = [
  { label: "1 Week", days: 7 },
  { label: "1.5 Weeks", days: 11 },
  { label: "2 Weeks", days: 14 },
  { label: "3 Weeks", days: 21 },
  { label: "1 Month", days: 30 },
];

export default function AddTehillimPage() {
  const { data: session, status } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(14); // Default 2 weeks

  const [formData, setFormData] = useState({
    hebrewName: "",
    englishName: "",
    motherHebrewName: "",
    reason: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!formData.hebrewName.trim() && !formData.englishName.trim()) {
      setError("Either Hebrew name or English name is required");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/community/tehillim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, durationDays: duration }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to submit name");
        setIsLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("An error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="container max-w-lg mx-auto py-12 px-4">
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container max-w-lg mx-auto py-12 px-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto" />
              <h2 className="text-xl font-semibold">Login Required</h2>
              <p className="text-gray-600">
                You must be logged in to add a name to the Tehillim list.
              </p>
              <Link href="/login">
                <Button>Sign In</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="container max-w-lg mx-auto py-12 px-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold">Name Submitted</h3>
              <p className="text-gray-600">
                Thank you for your submission. The name will appear on the Tehillim list
                after it has been reviewed by an administrator.
              </p>
              <div className="flex gap-3 justify-center pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSuccess(false);
                    setFormData({
                      hebrewName: "",
                      englishName: "",
                      motherHebrewName: "",
                      reason: "",
                    });
                  }}
                >
                  Add Another Name
                </Button>
                <Link href="/community/tehillim">
                  <Button>View Tehillim List</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-lg mx-auto py-12 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Add Name to Tehillim List</CardTitle>
          <CardDescription>
            Submit a name for the community to include in their Tehillim prayers.
            Names are reviewed before being added to the public list.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </Alert>
            )}

            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
              Please provide at least a Hebrew name or English name.
            </p>

            <div className="space-y-2">
              <Label htmlFor="hebrewName">Hebrew Name</Label>
              <Input
                id="hebrewName"
                placeholder="e.g., יעקב בן שרה"
                value={formData.hebrewName}
                onChange={(e) =>
                  setFormData({ ...formData, hebrewName: e.target.value })
                }
                dir="rtl"
              />
              <p className="text-xs text-gray-500">
                Full Hebrew name including mother&apos;s name (e.g., Ploni ben/bat Plonis)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="englishName">English Name</Label>
              <Input
                id="englishName"
                placeholder="e.g., Jacob son of Sarah"
                value={formData.englishName}
                onChange={(e) =>
                  setFormData({ ...formData, englishName: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="motherHebrewName">Mother&apos;s Hebrew Name (Optional)</Label>
              <Input
                id="motherHebrewName"
                placeholder="e.g., שרה"
                value={formData.motherHebrewName}
                onChange={(e) =>
                  setFormData({ ...formData, motherHebrewName: e.target.value })
                }
                dir="rtl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason / Notes (Optional)</Label>
              <Input
                id="reason"
                placeholder="e.g., Refuah Shleima, Surgery"
                value={formData.reason}
                onChange={(e) =>
                  setFormData({ ...formData, reason: e.target.value })
                }
              />
              <p className="text-xs text-gray-500">
                Brief note about the reason for the prayer request
              </p>
            </div>

            {/* Duration Selection */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <Label>How long should this name stay on the list?</Label>
              </div>

              {/* Quick Duration Buttons */}
              <div className="flex flex-wrap gap-2">
                {QUICK_DURATIONS.map((d) => (
                  <Button
                    key={d.days}
                    type="button"
                    variant={duration === d.days ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDuration(d.days)}
                    className="text-xs"
                  >
                    {d.label}
                  </Button>
                ))}
              </div>

              {/* Slider for custom duration */}
              <div className="space-y-2">
                <Slider
                  value={[duration]}
                  onValueChange={(value) => setDuration(value[0])}
                  min={1}
                  max={30}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>1 day</span>
                  <span className="font-medium text-gray-700">
                    {duration} {duration === 1 ? "day" : "days"}
                  </span>
                  <span>30 days</span>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                After this period, the name will be automatically removed. You can manage your submissions in your dashboard.
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Name"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
