"use client";

import { useState, useEffect, useRef } from "react";
import { uploadFile } from "@/lib/upload-client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { usePathname } from "next/navigation";

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
  shulId: z.string().optional(),
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

interface Shul {
  id: number;
  name: string;
}

export interface EventFormSubmitData {
  title: string;
  description: string | null;
  location: string | null;
  startTime: string;
  endTime: string | null;
  isAllDay: boolean;
  eventType: string | null;
  shulId: number | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  cost: string | null;
  imageUrl: string | null;
  flyerUrl: string | null;
  websiteUrl: string | null;
  organization: string | null;
  forceSchedule?: boolean;
}

interface EventFormProps {
  initialData?: {
    id?: number;
    title: string;
    description: string | null;
    location: string | null;
    startTime: Date | string;
    endTime: Date | string | null;
    isAllDay: boolean | null;
    eventType: string | null;
    shulId: number | null;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    cost: string | null;
    imageUrl: string | null;
    flyerUrl?: string | null;
    websiteUrl?: string | null;
    organization?: string | null;
  };
  onSubmit: (data: EventFormSubmitData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  /** When true, skip conflict detection (e.g. editing from a non-admin context). */
  skipConflictCheck?: boolean;
}

function formatDateForInput(date: Date | string | null): string {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString().split("T")[0];
}

function formatTimeForInput(date: Date | string | null): string {
  if (!date) return "";
  const d = new Date(date);
  return d.toTimeString().slice(0, 5);
}

export function EventForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  skipConflictCheck = false,
}: EventFormProps) {
  const pathname = usePathname();
  const isAdminContext = pathname?.startsWith("/admin") ?? false;
  const isCreateMode = !initialData?.id;

  const [shuls, setShuls] = useState<Shul[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingFlyer, setIsUploadingFlyer] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictingEvent[]>([]);
  const [pendingSubmitData, setPendingSubmitData] =
    useState<EventFormSubmitData | null>(null);

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
      title: initialData?.title || "",
      description: initialData?.description || "",
      location: initialData?.location || "",
      startDate: formatDateForInput(initialData?.startTime || null),
      startTime: formatTimeForInput(initialData?.startTime || null),
      endDate: formatDateForInput(initialData?.endTime || null),
      endTime: formatTimeForInput(initialData?.endTime || null),
      isAllDay: initialData?.isAllDay ?? false,
      eventType: initialData?.eventType || "",
      shulId: initialData?.shulId?.toString() || "",
      contactName: initialData?.contactName || "",
      contactEmail: initialData?.contactEmail || "",
      contactPhone: initialData?.contactPhone || "",
      cost: initialData?.cost || "",
      organization: initialData?.organization || "",
      websiteUrl: initialData?.websiteUrl || "",
      flyerUrl: initialData?.flyerUrl || "",
      imageUrl: initialData?.imageUrl || "",
    },
  });

  const isAllDay = watch("isAllDay");
  const eventType = watch("eventType");
  const selectedShulId = watch("shulId");
  const organization = watch("organization");
  const flyerUrl = watch("flyerUrl");
  const imageUrl = watch("imageUrl");

  useEffect(() => {
    async function fetchShuls() {
      try {
        const response = await fetch("/api/admin/shuls");
        if (response.ok) {
          const data = await response.json();
          setShuls(data);
        }
      } catch (error) {
        console.error("Error fetching shuls:", error);
      }
    }
    fetchShuls();
  }, []);

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
      const data = await uploadFile(file, "events");
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
      const data = await uploadFile(file, "event-flyers");
      setValue("flyerUrl", data.url);
      toast.success("Flyer uploaded");
    } catch {
      toast.error("Failed to upload flyer");
    } finally {
      setIsUploadingFlyer(false);
      if (flyerInputRef.current) flyerInputRef.current.value = "";
    }
  }

  function buildSubmitData(
    data: FormData,
    forceSchedule = false
  ): EventFormSubmitData {
    const [startYear, startMonth, startDay] = data.startDate
      .split("-")
      .map(Number);

    let startDateTime: string;
    if (!data.isAllDay && data.startTime) {
      const [startHour, startMinute] = data.startTime.split(":").map(Number);
      const startDate = new Date(
        startYear,
        startMonth - 1,
        startDay,
        startHour,
        startMinute
      );
      startDateTime = startDate.toISOString();
    } else {
      const startDate = new Date(startYear, startMonth - 1, startDay, 12, 0, 0);
      startDateTime = startDate.toISOString();
    }

    let endDateTime: string | null = null;
    if (data.endDate) {
      const [endYear, endMonth, endDay] = data.endDate.split("-").map(Number);
      if (!data.isAllDay && data.endTime) {
        const [endHour, endMinute] = data.endTime.split(":").map(Number);
        const endDate = new Date(
          endYear,
          endMonth - 1,
          endDay,
          endHour,
          endMinute
        );
        endDateTime = endDate.toISOString();
      } else {
        const endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59);
        endDateTime = endDate.toISOString();
      }
    }

    return {
      title: data.title,
      description: data.description || null,
      location: data.location || null,
      startTime: startDateTime,
      endTime: endDateTime,
      isAllDay: data.isAllDay,
      eventType: data.eventType || null,
      shulId: data.shulId ? parseInt(data.shulId) : null,
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

  async function checkConflicts(startDate: string): Promise<ConflictingEvent[]> {
    // Extract YYYY-MM-DD from ISO string
    const datePart = startDate.split("T")[0];
    try {
      const res = await fetch(
        `/api/events/conflicts?date=${datePart}`
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.conflicts || [];
    } catch {
      return [];
    }
  }

  async function handleFormSubmit(data: FormData) {
    const submitData = buildSubmitData(data, false);

    // Conflict detection — admin context only, create mode only
    if (isAdminContext && isCreateMode && !skipConflictCheck) {
      const found = await checkConflicts(submitData.startTime);
      if (found.length > 0) {
        setConflicts(found);
        setPendingSubmitData(submitData);
        return; // wait for modal response
      }
    }

    await onSubmit(submitData);
  }

  async function handleConflictProceed() {
    if (!pendingSubmitData) return;
    setConflicts([]);
    const forceData = { ...pendingSubmitData, forceSchedule: true };
    setPendingSubmitData(null);
    await onSubmit(forceData);
  }

  function handleConflictCancel() {
    setConflicts([]);
    setPendingSubmitData(null);
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
        {/* Auto-fill from previous event — create mode only */}
        {isCreateMode && (
          <CopyFromPreviousEvent onCopy={handleCopyFromPrevious} />
        )}

        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input id="title" {...register("title")} placeholder="Event title" />
          {errors.title && (
            <p className="text-sm text-red-500">{errors.title.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            {...register("description")}
            placeholder="Event description"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
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
            <Label htmlFor="shulId">Shul (optional)</Label>
            <Select
              value={selectedShulId || "none"}
              onValueChange={(value) =>
                setValue("shulId", value === "none" ? "" : value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select shul" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {shuls.map((shul) => (
                  <SelectItem key={shul.id} value={shul.id.toString()}>
                    {shul.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Organization */}
        <div className="space-y-2">
          <Label htmlFor="organization">Organization</Label>
          <OrganizationAutocomplete
            value={organization || ""}
            onChange={(val) => setValue("organization", val)}
            placeholder="e.g., Beth David Synagogue"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="isAllDay"
            checked={isAllDay}
            onCheckedChange={(checked) => setValue("isAllDay", checked)}
          />
          <Label htmlFor="isAllDay">All Day Event</Label>
        </div>

        <div className="grid grid-cols-2 gap-4">
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

        <div className="grid grid-cols-2 gap-4">
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
            placeholder="Event location"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cost">Cost</Label>
          <Input
            id="cost"
            {...register("cost")}
            placeholder="e.g., Free, $25"
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
          <Label>Flyer URL (optional)</Label>
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
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactName">Name</Label>
              <Input id="contactName" {...register("contactName")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Email</Label>
              <Input
                id="contactEmail"
                type="email"
                {...register("contactEmail")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Phone</Label>
              <Input id="contactPhone" {...register("contactPhone")} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading || isUploadingImage || isUploadingFlyer}>
            {isLoading
              ? "Saving..."
              : initialData?.id
              ? "Update Event"
              : "Create Event"}
          </Button>
        </div>
      </form>
    </>
  );
}
