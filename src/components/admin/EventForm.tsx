"use client";

import { useState, useEffect } from "react";
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
});

type FormData = z.infer<typeof formSchema>;

interface Shul {
  id: number;
  name: string;
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
  };
  onSubmit: (data: {
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
  }) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
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
}: EventFormProps) {
  const [shuls, setShuls] = useState<Shul[]>([]);

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
    },
  });

  const isAllDay = watch("isAllDay");
  const eventType = watch("eventType");
  const selectedShulId = watch("shulId");

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

  async function handleFormSubmit(data: FormData) {
    // Create dates in local timezone (EST) - don't use Z suffix which means UTC
    // Parse date parts and create Date object in local time
    const [startYear, startMonth, startDay] = data.startDate.split("-").map(Number);

    let startDateTime: string;
    if (!data.isAllDay && data.startTime) {
      const [startHour, startMinute] = data.startTime.split(":").map(Number);
      const startDate = new Date(startYear, startMonth - 1, startDay, startHour, startMinute);
      startDateTime = startDate.toISOString();
    } else {
      // For all-day events, use noon local time to avoid date shifting
      const startDate = new Date(startYear, startMonth - 1, startDay, 12, 0, 0);
      startDateTime = startDate.toISOString();
    }

    let endDateTime: string | null = null;
    if (data.endDate) {
      const [endYear, endMonth, endDay] = data.endDate.split("-").map(Number);
      if (!data.isAllDay && data.endTime) {
        const [endHour, endMinute] = data.endTime.split(":").map(Number);
        const endDate = new Date(endYear, endMonth - 1, endDay, endHour, endMinute);
        endDateTime = endDate.toISOString();
      } else {
        // For all-day events, use end of day
        const endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59);
        endDateTime = endDate.toISOString();
      }
    }

    await onSubmit({
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
      imageUrl: null,
    });
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
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
            onValueChange={(value) => setValue("shulId", value === "none" ? "" : value)}
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
        <Input id="cost" {...register("cost")} placeholder="e.g., Free, $25" />
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
            <Input id="contactEmail" type="email" {...register("contactEmail")} />
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
        <Button type="submit" disabled={isLoading}>
          {isLoading
            ? "Saving..."
            : initialData?.id
            ? "Update Event"
            : "Create Event"}
        </Button>
      </div>
    </form>
  );
}
