"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { EVENT_TYPES } from "@/lib/validations/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Upload, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { OrganizationAutocomplete } from "@/components/events/OrganizationAutocomplete";
import {
  CopyFromPreviousEvent,
  type EventPrefillData,
} from "@/components/events/CopyFromPreviousEvent";
import {
  EventConflictModal,
  type ConflictingEvent,
} from "@/components/events/EventConflictModal";

const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  location: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  startTime: z.string().optional(),
  endDate: z.string().optional(),
  endTime: z.string().optional(),
  isAllDay: z.boolean(),
  eventType: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  cost: z.string().optional(),
  organization: z.string().max(200).optional(),
  websiteUrl: z.string().optional(),
  flyerUrl: z.string().optional(),
  imageUrl: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export function PublicEventForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingFlyer, setIsUploadingFlyer] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictingEvent[]>([]);
  const [pendingPayload, setPendingPayload] = useState<object | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const flyerInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      location: "",
      startDate: "",
      startTime: "",
      endDate: "",
      endTime: "",
      isAllDay: false,
      eventType: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      cost: "",
      organization: "",
      websiteUrl: "",
      flyerUrl: "",
      imageUrl: "",
    },
  });

  const isAllDay = watch("isAllDay");
  const eventType = watch("eventType");
  const organization = watch("organization");
  const flyerUrl = watch("flyerUrl");
  const imageUrl = watch("imageUrl");

  function handleCopyFromPrevious(data: EventPrefillData) {
    if (data.description !== null)
      setValue("description", data.description || "");
    if (data.location !== null) setValue("location", data.location || "");
    if (data.contactName !== null)
      setValue("contactName", data.contactName || "");
    if (data.contactEmail !== null)
      setValue("contactEmail", data.contactEmail || "");
    if (data.contactPhone !== null)
      setValue("contactPhone", data.contactPhone || "");
    if (data.organization !== null)
      setValue("organization", data.organization || "");
    if (data.eventType !== null) setValue("eventType", data.eventType || "");
    toast.success("Fields filled from previous event");
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      toast.error("Please upload a JPG, PNG, WebP, or GIF image");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Image must be less than 4MB");
      return;
    }

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "events");

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      setValue("imageUrl", data.url);
      toast.success("Cover image uploaded");
    } catch {
      toast.error("Failed to upload image");
    } finally {
      setIsUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  async function handleFlyerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    if (!allowed.includes(file.type)) {
      toast.error("Please upload a PDF, JPG, or PNG file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Flyer must be less than 10MB");
      return;
    }

    setIsUploadingFlyer(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "event-flyers");

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      setValue("flyerUrl", data.url);
      toast.success("Flyer uploaded");
    } catch {
      toast.error("Failed to upload flyer");
    } finally {
      setIsUploadingFlyer(false);
      if (flyerInputRef.current) flyerInputRef.current.value = "";
    }
  }

  function buildPayload(data: FormData, forceSchedule: boolean): object {
    const [startYear, startMonth, startDay] = data.startDate
      .split("-")
      .map(Number);

    let startDateTime: string;
    if (!data.isAllDay && data.startTime) {
      const [h, m] = data.startTime.split(":").map(Number);
      startDateTime = new Date(
        startYear,
        startMonth - 1,
        startDay,
        h,
        m
      ).toISOString();
    } else {
      startDateTime = new Date(
        startYear,
        startMonth - 1,
        startDay,
        12,
        0,
        0
      ).toISOString();
    }

    let endDateTime: string | null = null;
    if (data.endDate) {
      const [ey, em, ed] = data.endDate.split("-").map(Number);
      if (!data.isAllDay && data.endTime) {
        const [h, m] = data.endTime.split(":").map(Number);
        endDateTime = new Date(ey, em - 1, ed, h, m).toISOString();
      } else {
        endDateTime = new Date(ey, em - 1, ed, 23, 59, 59).toISOString();
      }
    }

    return {
      title: data.title,
      description: data.description || null,
      location: data.location || null,
      startTime: startDateTime,
      endTime: endDateTime,
      isAllDay: data.isAllDay,
      eventType: data.eventType || "community",
      contactName: data.contactName || null,
      contactEmail: data.contactEmail || null,
      contactPhone: data.contactPhone || null,
      cost: data.cost || null,
      imageUrl: data.imageUrl || null,
      flyerUrl: data.flyerUrl || null,
      websiteUrl: data.websiteUrl || null,
      organization: data.organization || null,
      forceSchedule,
    };
  }

  async function submitPayload(payload: object) {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/community/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseData = await res.json();

      if (!res.ok) {
        throw new Error(responseData.error || "Failed to submit event");
      }

      // Check if server returned conflicts (not an error, but needs modal)
      if (responseData.conflicts && responseData.conflicts.length > 0) {
        setConflicts(responseData.conflicts);
        setPendingPayload(payload);
        return;
      }

      toast.success(responseData.message || "Event submitted successfully");
      router.push("/community/calendar");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit event"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleFormSubmit(data: FormData) {
    const payload = buildPayload(data, false);
    await submitPayload(payload);
  }

  async function handleConflictProceed() {
    if (!pendingPayload) return;
    setConflicts([]);
    const forcePayload = { ...(pendingPayload as Record<string, unknown>), forceSchedule: true };
    setPendingPayload(null);
    await submitPayload(forcePayload);
  }

  function handleConflictCancel() {
    setConflicts([]);
    setPendingPayload(null);
  }

  return (
    <>
      {conflicts.length > 0 && (
        <EventConflictModal
          conflicts={conflicts}
          onCancel={handleConflictCancel}
          onProceed={handleConflictProceed}
        />
      )}

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        <CopyFromPreviousEvent onCopy={handleCopyFromPrevious} />

        <div className="space-y-2">
          <Label htmlFor="title">Event Title *</Label>
          <Input id="title" {...register("title")} placeholder="e.g., Annual Gala Dinner" />
          {errors.title && (
            <p className="text-sm text-red-500">{errors.title.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            {...register("description")}
            placeholder="Tell the community about your event..."
            rows={4}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="eventType">Event Type</Label>
            <Select
              value={eventType || ""}
              onValueChange={(value) => setValue("eventType", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Organization</Label>
            <OrganizationAutocomplete
              value={organization || ""}
              onChange={(val) => setValue("organization", val)}
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="isAllDay"
            checked={isAllDay}
            onCheckedChange={(checked) => setValue("isAllDay", checked)}
          />
          <Label htmlFor="isAllDay">All Day Event</Label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date *</Label>
            <Input id="startDate" type="date" {...register("startDate")} />
            {errors.startDate && (
              <p className="text-sm text-red-500">{errors.startDate.message}</p>
            )}
          </div>
          {!isAllDay && (
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input id="startTime" type="time" {...register("startTime")} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <Input id="endDate" type="date" {...register("endDate")} />
          </div>
          {!isAllDay && (
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input id="endTime" type="time" {...register("endTime")} />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            {...register("location")}
            placeholder="e.g., Beth David Synagogue, 1234 Bathurst St"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cost">Cost</Label>
          <Input
            id="cost"
            {...register("cost")}
            placeholder="e.g., Free, $25 per person"
          />
        </div>

        {/* Cover Image Upload */}
        <div className="space-y-2">
          <Label>Cover Image (optional)</Label>
          <div className="flex items-center gap-3">
            <Input
              {...register("imageUrl")}
              placeholder="https://..."
              className="flex-1"
            />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleImageUpload}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploadingImage}
              onClick={() => imageInputRef.current?.click()}
              className="flex-shrink-0"
            >
              {isUploadingImage ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              <span className="ml-1">
                {isUploadingImage ? "Uploading..." : "Upload"}
              </span>
            </Button>
          </div>
          {imageUrl && (
            <div className="flex items-center gap-2 mt-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Cover preview"
                className="h-16 w-24 object-cover rounded border"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setValue("imageUrl", "")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Flyer Upload */}
        <div className="space-y-2">
          <Label>Flyer (PDF or image, optional)</Label>
          <div className="flex items-center gap-3">
            <Input
              {...register("flyerUrl")}
              placeholder="https://..."
              className="flex-1"
            />
            <input
              ref={flyerInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={handleFlyerUpload}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploadingFlyer}
              onClick={() => flyerInputRef.current?.click()}
              className="flex-shrink-0"
            >
              {isUploadingFlyer ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              <span className="ml-1">
                {isUploadingFlyer ? "Uploading..." : "Upload flyer"}
              </span>
            </Button>
          </div>
          {flyerUrl && (
            <div className="flex items-center gap-2 mt-1">
              <a
                href={flyerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                View flyer
              </a>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setValue("flyerUrl", "")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Website URL */}
        <div className="space-y-2">
          <Label htmlFor="websiteUrl">Website URL (optional)</Label>
          <Input
            id="websiteUrl"
            {...register("websiteUrl")}
            placeholder="https://..."
            type="url"
          />
        </div>

        <div className="border-t pt-4">
          <h4 className="font-medium mb-3">Contact Information</h4>
          <p className="text-sm text-gray-500 mb-4">
            This information will be displayed publicly so attendees can reach you.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactName">Name</Label>
              <Input
                id="contactName"
                {...register("contactName")}
                placeholder="Contact person"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Email</Label>
              <Input
                id="contactEmail"
                type="email"
                {...register("contactEmail")}
                placeholder="contact@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Phone</Label>
              <Input
                id="contactPhone"
                {...register("contactPhone")}
                placeholder="(416) 555-0100"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/community/calendar")}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || isUploadingImage || isUploadingFlyer}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Submitting...
              </>
            ) : (
              "Submit Event"
            )}
          </Button>
        </div>
      </form>
    </>
  );
}
