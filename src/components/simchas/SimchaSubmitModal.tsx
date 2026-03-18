"use client";

import { useState, useEffect, useRef } from "react";
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
import { Loader2, Plus, PartyPopper, ImageIcon, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface SimchaType {
  id: number;
  name: string;
  slug: string;
}

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function SimchaSubmitModal() {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [simchaTypes, setSimchaTypes] = useState<SimchaType[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    familyName: "",
    typeId: "",
    announcement: "",
    eventDate: "",
    location: "",
    photoUrl: "",
  });

  useEffect(() => {
    if (isOpen) {
      fetch("/api/simcha-types")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setSimchaTypes(data);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const resetForm = () => {
    setForm({
      familyName: "",
      typeId: "",
      announcement: "",
      eventDate: "",
      location: "",
      photoUrl: "",
    });
  };

  const handlePhotoUpload = async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Only JPEG, PNG, and WebP images are allowed");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Image must be under 4MB");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "simchas");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setForm((prev) => ({ ...prev, photoUrl: data.url }));
        toast.success("Photo uploaded");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to upload photo");
      }
    } catch {
      toast.error("Failed to upload photo");
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = () => {
    setForm((prev) => ({ ...prev, photoUrl: "" }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!form.familyName.trim()) {
      toast.error("Family name is required");
      return;
    }
    if (!form.announcement.trim() || form.announcement.length < 10) {
      toast.error("Please provide an announcement (at least 10 characters)");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/community/simchas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyName: form.familyName,
          announcement: form.announcement,
          typeId: form.typeId || null,
          eventDate: form.eventDate || null,
          location: form.location || null,
          photoUrl: form.photoUrl || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || "Simcha submitted!");
        setIsOpen(false);
        resetForm();
      } else {
        toast.error(data.error || "Failed to submit");
      }
    } catch {
      toast.error("Failed to submit simcha");
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
          Share a Simcha
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        {!session ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PartyPopper className="h-5 w-5 text-purple-500" />
                Sign In Required
              </DialogTitle>
              <DialogDescription>
                Please sign in to share a simcha with the community.
              </DialogDescription>
            </DialogHeader>
            <div className="py-6 text-center">
              <p className="text-gray-600 mb-4">
                Create an account or sign in to share your joyous news with
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
                <PartyPopper className="h-5 w-5 text-purple-500" />
                Share a Simcha
              </DialogTitle>
              <DialogDescription>
                Share your joyous news! Your submission will be reviewed before
                publishing.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="familyName">Family Name *</Label>
                  <Input
                    id="familyName"
                    value={form.familyName}
                    onChange={(e) =>
                      setForm({ ...form, familyName: e.target.value })
                    }
                    placeholder="e.g., Cohen"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="typeId">Type</Label>
                  <Select
                    value={form.typeId}
                    onValueChange={(v) => setForm({ ...form, typeId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {simchaTypes.map((type) => (
                        <SelectItem
                          key={type.id}
                          value={type.id.toString()}
                        >
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="announcement">Announcement *</Label>
                <Textarea
                  id="announcement"
                  value={form.announcement}
                  onChange={(e) =>
                    setForm({ ...form, announcement: e.target.value })
                  }
                  placeholder="Share the details of your simcha..."
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="eventDate">Event Date</Label>
                  <Input
                    id="eventDate"
                    type="date"
                    value={form.eventDate}
                    onChange={(e) =>
                      setForm({ ...form, eventDate: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={form.location}
                    onChange={(e) =>
                      setForm({ ...form, location: e.target.value })
                    }
                    placeholder="e.g., Beth Jacob Shul"
                  />
                </div>
              </div>

              {/* Photo Upload */}
              <div className="space-y-2">
                <Label>Photo</Label>
                {form.photoUrl ? (
                  <div className="relative rounded-lg overflow-hidden border">
                    <div className="relative h-48 bg-gray-100">
                      <Image
                        src={form.photoUrl}
                        alt="Simcha photo preview"
                        fill
                        className="object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-purple-400 hover:bg-purple-50/50 transition-colors">
                    {isUploading ? (
                      <div className="flex items-center gap-2 text-gray-500">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-sm">Uploading...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-gray-500">
                        <ImageIcon className="h-8 w-8" />
                        <span className="text-sm font-medium">
                          Click to upload a photo
                        </span>
                        <span className="text-xs text-gray-400">
                          JPEG, PNG, or WebP (max 4MB)
                        </span>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={isUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePhotoUpload(file);
                      }}
                    />
                  </label>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || isUploading}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Simcha"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
