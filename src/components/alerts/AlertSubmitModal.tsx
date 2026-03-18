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
import { Loader2, Plus, Bell } from "lucide-react";
import Link from "next/link";

const ALERT_TYPES = [
  { value: "general", label: "General" },
  { value: "bulletin", label: "Bulletin" },
  { value: "announcement", label: "Announcement" },
  { value: "warning", label: "Warning" },
];

const URGENCY_LEVELS = [
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export function AlertSubmitModal() {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    alertType: "",
    urgency: "normal",
    content: "",
  });

  const resetForm = () => {
    setForm({
      title: "",
      alertType: "",
      urgency: "normal",
      content: "",
    });
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!form.alertType) {
      toast.error("Please select an alert type");
      return;
    }
    if (!form.content.trim() || form.content.length < 10) {
      toast.error("Please provide details (at least 10 characters)");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/community/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          content: form.content,
          alertType: form.alertType,
          urgency: form.urgency,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || "Alert submitted!");
        setIsOpen(false);
        resetForm();
      } else {
        toast.error(data.error || "Failed to submit");
      }
    } catch {
      toast.error("Failed to submit alert");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === "loading") {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Submit Alert
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        {!session ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-blue-500" />
                Sign In Required
              </DialogTitle>
              <DialogDescription>
                Please sign in to submit an alert to the community.
              </DialogDescription>
            </DialogHeader>
            <div className="py-6 text-center">
              <p className="text-gray-600 mb-4">
                Create an account or sign in to share important updates with
                the Toronto Jewish community.
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
                <Bell className="h-5 w-5 text-blue-500" />
                Submit Alert
              </DialogTitle>
              <DialogDescription>
                Share an important update with the community. Your submission
                will be reviewed before publishing.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) =>
                    setForm({ ...form, title: e.target.value })
                  }
                  placeholder="e.g., Road closure on Bathurst St"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="alertType">Alert Type *</Label>
                  <Select
                    value={form.alertType}
                    onValueChange={(v) =>
                      setForm({ ...form, alertType: v })
                    }
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

                <div className="space-y-2">
                  <Label htmlFor="urgency">Urgency</Label>
                  <Select
                    value={form.urgency}
                    onValueChange={(v) =>
                      setForm({ ...form, urgency: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {URGENCY_LEVELS.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Details *</Label>
                <Textarea
                  id="content"
                  value={form.content}
                  onChange={(e) =>
                    setForm({ ...form, content: e.target.value })
                  }
                  placeholder="Provide details about this alert..."
                  rows={4}
                />
                <p className="text-xs text-gray-500">
                  Include relevant details, dates, and any actions the community should take
                </p>
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
