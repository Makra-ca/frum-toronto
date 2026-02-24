"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, AlertTriangle } from "lucide-react";
import Link from "next/link";

const ALERT_TYPES = [
  { value: "recall", label: "Product Recall" },
  { value: "status_change", label: "Kosher Status Change" },
  { value: "warning", label: "Warning" },
  { value: "update", label: "Update/Information" },
];

const CERTIFYING_AGENCIES = [
  { value: "COR", label: "COR (Kashruth Council of Canada)" },
  { value: "OU", label: "OU (Orthodox Union)" },
  { value: "OK", label: "OK Kosher" },
  { value: "Star-K", label: "Star-K" },
  { value: "Kof-K", label: "Kof-K" },
  { value: "cRc", label: "cRc (Chicago Rabbinical Council)" },
  { value: "MK", label: "MK (Montreal Kosher)" },
  { value: "other", label: "Other" },
];

export function KosherAlertSubmitModal() {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    productName: "",
    brand: "",
    alertType: "",
    description: "",
    certifyingAgency: "",
    customAgency: "",
    effectiveDate: "",
  });

  const resetForm = () => {
    setForm({
      productName: "",
      brand: "",
      alertType: "",
      description: "",
      certifyingAgency: "",
      customAgency: "",
      effectiveDate: "",
    });
  };

  const handleSubmit = async () => {
    if (!form.productName.trim()) {
      toast.error("Product name is required");
      return;
    }
    if (!form.description.trim() || form.description.length < 10) {
      toast.error("Please provide a detailed description (at least 10 characters)");
      return;
    }

    setIsSubmitting(true);
    try {
      const certifyingAgency = form.certifyingAgency === "other"
        ? form.customAgency
        : form.certifyingAgency;

      const res = await fetch("/api/community/kosher-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: form.productName,
          brand: form.brand || null,
          alertType: form.alertType || null,
          description: form.description,
          certifyingAgency: certifyingAgency || null,
          effectiveDate: form.effectiveDate || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || "Submission received!");
        setIsOpen(false);
        resetForm();
      } else {
        toast.error(data.error || "Failed to submit");
      }
    } catch (error) {
      toast.error("Failed to submit kosher alert");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (status === "loading") {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Report Kosher Alert
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        {!session ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Sign In Required
              </DialogTitle>
              <DialogDescription>
                Please sign in to submit a kosher alert to the community.
              </DialogDescription>
            </DialogHeader>
            <div className="py-6 text-center">
              <p className="text-gray-600 mb-4">
                Create an account or sign in to help keep our community informed about
                kosher product updates.
              </p>
              <div className="flex gap-3 justify-center">
                <Button asChild variant="outline">
                  <Link href="/register">Create Account</Link>
                </Button>
                <Button asChild>
                  <Link href="/login">Sign In</Link>
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Report Kosher Alert
              </DialogTitle>
              <DialogDescription>
                Help the community by reporting a kosher product issue. Your submission
                will be reviewed before publishing.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="productName">Product Name *</Label>
                <Input
                  id="productName"
                  value={form.productName}
                  onChange={(e) => setForm({ ...form, productName: e.target.value })}
                  placeholder="e.g., ABC Brand Chocolate Chips"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="brand">Brand</Label>
                  <Input
                    id="brand"
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    placeholder="e.g., ABC Foods"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="alertType">Alert Type</Label>
                  <Select
                    value={form.alertType}
                    onValueChange={(v) => setForm({ ...form, alertType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ALERT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="certifyingAgency">Certifying Agency</Label>
                <Select
                  value={form.certifyingAgency}
                  onValueChange={(v) => setForm({ ...form, certifyingAgency: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select agency" />
                  </SelectTrigger>
                  <SelectContent>
                    {CERTIFYING_AGENCIES.map((agency) => (
                      <SelectItem key={agency.value} value={agency.value}>
                        {agency.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.certifyingAgency === "other" && (
                  <Input
                    value={form.customAgency}
                    onChange={(e) => setForm({ ...form, customAgency: e.target.value })}
                    placeholder="Enter agency name"
                    className="mt-2"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Please describe the kosher concern or alert in detail..."
                  rows={4}
                />
                <p className="text-xs text-gray-500">
                  Include details like lot numbers, UPC codes, or specific concerns
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="effectiveDate">Effective Date (if known)</Label>
                <Input
                  id="effectiveDate"
                  type="date"
                  value={form.effectiveDate}
                  onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Alert"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
