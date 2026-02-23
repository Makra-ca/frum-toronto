"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2, X, CheckCircle } from "lucide-react";

interface MournerEntry {
  id: string;
  name: string;
}

export function ShivaSubmitModal() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [niftarName, setNiftarName] = useState("");
  const [niftarNameHebrew, setNiftarNameHebrew] = useState("");
  const [mourners, setMourners] = useState<MournerEntry[]>([
    { id: crypto.randomUUID(), name: "" },
  ]);
  const [shivaAddress, setShivaAddress] = useState("");
  const [shivaStart, setShivaStart] = useState("");
  const [shivaEnd, setShivaEnd] = useState("");
  const [shivaHours, setShivaHours] = useState("");
  const [mealInfo, setMealInfo] = useState("");
  const [donationInfo, setDonationInfo] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const resetForm = () => {
    setNiftarName("");
    setNiftarNameHebrew("");
    setMourners([{ id: crypto.randomUUID(), name: "" }]);
    setShivaAddress("");
    setShivaStart("");
    setShivaEnd("");
    setShivaHours("");
    setMealInfo("");
    setDonationInfo("");
    setContactPhone("");
    setError(null);
    setSuccess(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    setOpen(newOpen);
  };

  const addMourner = () => {
    setMourners([...mourners, { id: crypto.randomUUID(), name: "" }]);
  };

  const removeMourner = (id: string) => {
    if (mourners.length > 1) {
      setMourners(mourners.filter((m) => m.id !== id));
    }
  };

  const updateMourner = (id: string, name: string) => {
    setMourners(
      mourners.map((m) => (m.id === id ? { ...m, name } : m))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!niftarName.trim()) {
      setError("Name of the niftar is required");
      return;
    }

    if (!shivaStart || !shivaEnd) {
      setError("Shiva start and end dates are required");
      return;
    }

    setLoading(true);

    try {
      const mournerNames = mourners
        .map((m) => m.name.trim())
        .filter((name) => name !== "");

      const response = await fetch("/api/community/shiva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niftarName: niftarName.trim(),
          niftarNameHebrew: niftarNameHebrew.trim() || null,
          mournerNames,
          shivaAddress: shivaAddress.trim() || null,
          shivaStart,
          shivaEnd,
          shivaHours: shivaHours.trim() || null,
          mealInfo: mealInfo.trim() || null,
          donationInfo: donationInfo.trim() || null,
          contactPhone: contactPhone.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to submit shiva notice");
        return;
      }

      setSuccess(true);
      // Refresh the page data after a short delay
      setTimeout(() => {
        router.refresh();
      }, 2000);
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // If not logged in, show login prompt
  if (status === "loading") {
    return (
      <Button disabled>
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading...
      </Button>
    );
  }

  if (!session) {
    return (
      <Button onClick={() => router.push("/login?callbackUrl=/shiva")}>
        <Plus className="h-4 w-4 mr-2" />
        Report Shiva Notice
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Report Shiva Notice
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report Shiva Notice</DialogTitle>
          <DialogDescription>
            Submit a shiva notice for the community. All fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Shiva Notice Submitted
            </h3>
            <p className="text-gray-600 mb-4">
              Your submission has been received and will be reviewed shortly.
            </p>
            <Button onClick={() => handleOpenChange(false)}>Close</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Niftar Name */}
            <div className="space-y-2">
              <Label htmlFor="niftarName">Name of Niftar *</Label>
              <Input
                id="niftarName"
                value={niftarName}
                onChange={(e) => setNiftarName(e.target.value)}
                placeholder="Enter the name of the deceased"
                required
              />
            </div>

            {/* Hebrew Name */}
            <div className="space-y-2">
              <Label htmlFor="niftarNameHebrew">Hebrew Name (optional)</Label>
              <Input
                id="niftarNameHebrew"
                value={niftarNameHebrew}
                onChange={(e) => setNiftarNameHebrew(e.target.value)}
                placeholder="שם בעברית"
                dir="rtl"
              />
            </div>

            {/* Mourners */}
            <div className="space-y-2">
              <Label>Mourners</Label>
              <div className="space-y-2">
                {mourners.map((mourner, index) => (
                  <div key={mourner.id} className="flex gap-2">
                    <Input
                      value={mourner.name}
                      onChange={(e) => updateMourner(mourner.id, e.target.value)}
                      placeholder={`Mourner ${index + 1}`}
                    />
                    {mourners.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMourner(mourner.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMourner}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Mourner
              </Button>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="shivaAddress">Shiva Address</Label>
              <Input
                id="shivaAddress"
                value={shivaAddress}
                onChange={(e) => setShivaAddress(e.target.value)}
                placeholder="Enter the shiva location"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shivaStart">Start Date *</Label>
                <Input
                  id="shivaStart"
                  type="date"
                  value={shivaStart}
                  onChange={(e) => setShivaStart(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shivaEnd">End Date *</Label>
                <Input
                  id="shivaEnd"
                  type="date"
                  value={shivaEnd}
                  onChange={(e) => setShivaEnd(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Hours */}
            <div className="space-y-2">
              <Label htmlFor="shivaHours">Visiting Hours</Label>
              <Input
                id="shivaHours"
                value={shivaHours}
                onChange={(e) => setShivaHours(e.target.value)}
                placeholder="e.g., 10am-12pm, 3pm-9pm"
              />
            </div>

            {/* Contact Phone */}
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input
                id="contactPhone"
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="(416) 555-0000"
              />
            </div>

            {/* Meal Info */}
            <div className="space-y-2">
              <Label htmlFor="mealInfo">Meal Information</Label>
              <Textarea
                id="mealInfo"
                value={mealInfo}
                onChange={(e) => setMealInfo(e.target.value)}
                placeholder="Information about meals, meal trains, etc."
                rows={2}
              />
            </div>

            {/* Donation Info */}
            <div className="space-y-2">
              <Label htmlFor="donationInfo">Donation Information</Label>
              <Textarea
                id="donationInfo"
                value={donationInfo}
                onChange={(e) => setDonationInfo(e.target.value)}
                placeholder="Charity or memorial fund information"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Submit
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
