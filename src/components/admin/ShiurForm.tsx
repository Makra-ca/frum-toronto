"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DAYS_OF_WEEK,
  TEACHER_TITLES,
  SHIUR_CATEGORIES,
  SHIUR_CLASS_TYPES,
  SHIUR_LEVELS,
  SHIUR_GENDERS,
  LOCATION_AREAS,
  ORGANIZATIONS,
} from "@/lib/validations/content";

interface ScheduleEntry {
  start: string;
  end: string;
  notes: string;
}

interface ShiurFormData {
  teacherTitle: string;
  teacherFirstName: string;
  teacherLastName: string;
  title: string;
  description: string;
  shulId: string;
  locationName: string;
  locationAddress: string;
  locationPostalCode: string;
  locationArea: string;
  schedule: Record<string, ScheduleEntry>;
  startDate: string;
  endDate: string;
  category: string;
  classType: string;
  level: string;
  gender: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  website: string;
  cost: string;
  projectOf: string;
  submitterEmail: string;
  isOnHold: boolean;
}

interface Shul {
  id: number;
  name: string;
}

interface ShiurFormProps {
  initialData?: Partial<ShiurFormData> & { id?: number };
  onSubmit: (data: ShiurFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const defaultSchedule: Record<string, ScheduleEntry> = {
  "0": { start: "", end: "", notes: "" },
  "1": { start: "", end: "", notes: "" },
  "2": { start: "", end: "", notes: "" },
  "3": { start: "", end: "", notes: "" },
  "4": { start: "", end: "", notes: "" },
  "5": { start: "", end: "", notes: "" },
  "6": { start: "", end: "", notes: "" },
};

export function ShiurForm({ initialData, onSubmit, onCancel, isLoading }: ShiurFormProps) {
  const [shuls, setShuls] = useState<Shul[]>([]);
  const [showCustomLocation, setShowCustomLocation] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ShiurFormData>({
    defaultValues: {
      teacherTitle: initialData?.teacherTitle || "",
      teacherFirstName: initialData?.teacherFirstName || "",
      teacherLastName: initialData?.teacherLastName || "",
      title: initialData?.title || "",
      description: initialData?.description || "",
      shulId: initialData?.shulId?.toString() || "",
      locationName: initialData?.locationName || "",
      locationAddress: initialData?.locationAddress || "",
      locationPostalCode: initialData?.locationPostalCode || "",
      locationArea: initialData?.locationArea || "",
      schedule: initialData?.schedule || defaultSchedule,
      startDate: initialData?.startDate || "",
      endDate: initialData?.endDate || "",
      category: initialData?.category || "",
      classType: initialData?.classType || "",
      level: initialData?.level || "",
      gender: initialData?.gender || "",
      contactName: initialData?.contactName || "",
      contactPhone: initialData?.contactPhone || "",
      contactEmail: initialData?.contactEmail || "",
      website: initialData?.website || "",
      cost: initialData?.cost || "",
      projectOf: initialData?.projectOf || "",
      submitterEmail: initialData?.submitterEmail || "",
      isOnHold: initialData?.isOnHold || false,
    },
  });

  const selectedShulId = watch("shulId");
  const selectedCategory = watch("category");
  const selectedClassType = watch("classType");
  const selectedLevel = watch("level");
  const selectedGender = watch("gender");
  const selectedTeacherTitle = watch("teacherTitle");
  const selectedLocationArea = watch("locationArea");
  const selectedProjectOf = watch("projectOf");
  const schedule = watch("schedule");
  const isOnHold = watch("isOnHold");

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

  useEffect(() => {
    if (selectedShulId === "other") {
      setShowCustomLocation(true);
    } else if (selectedShulId) {
      setShowCustomLocation(false);
    }
  }, [selectedShulId]);

  function updateSchedule(day: string, field: keyof ScheduleEntry, value: string) {
    const currentSchedule = schedule || defaultSchedule;
    setValue("schedule", {
      ...currentSchedule,
      [day]: {
        ...currentSchedule[day],
        [field]: value,
      },
    });
  }

  function handleFormSubmit(data: ShiurFormData) {
    const transformed = {
      ...data,
      shulId: data.shulId && data.shulId !== "other" && data.shulId !== "none"
        ? parseInt(data.shulId) as unknown as string
        : null as unknown as string,
    };
    onSubmit(transformed);
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* DETAILS SECTION */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              {...register("title", { required: "Title is required" })}
              placeholder="Shiur title"
            />
            {errors.title && (
              <p className="text-sm text-red-500">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Given By</Label>
            <div className="grid grid-cols-3 gap-4">
              <Select
                value={selectedTeacherTitle || "none"}
                onValueChange={(value) => setValue("teacherTitle", value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Title" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select One</SelectItem>
                  {TEACHER_TITLES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                {...register("teacherFirstName")}
                placeholder="First Name"
              />
              <Input
                {...register("teacherLastName")}
                placeholder="Last Name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Details</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Additional information about the shiur"
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* SCHEDULE SECTION */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {DAYS_OF_WEEK.map((day) => {
              const dayKey = day.value.toString();
              const hasTime = schedule?.[dayKey]?.start;
              return (
                <div
                  key={day.value}
                  className={`rounded-lg border p-4 transition-colors ${
                    hasTime ? "border-blue-200 bg-blue-50/30" : "border-gray-100 bg-white"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <span className="font-semibold text-gray-900 w-28 flex-shrink-0">{day.label}</span>
                    <div className="flex items-center gap-2 flex-1">
                      <div className="flex-1">
                        <Label className="text-xs text-gray-500 mb-1 block">Start</Label>
                        <Input
                          type="time"
                          value={schedule?.[dayKey]?.start || ""}
                          onChange={(e) => updateSchedule(dayKey, "start", e.target.value)}
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs text-gray-500 mb-1 block">End</Label>
                        <Input
                          type="time"
                          value={schedule?.[dayKey]?.end || ""}
                          onChange={(e) => updateSchedule(dayKey, "end", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  {/* Notes below */}
                  <div className="mt-2 sm:ml-28 sm:pl-3">
                    <Textarea
                      placeholder="Notes (optional)"
                      rows={2}
                      className="resize-y min-h-[60px]"
                      value={schedule?.[dayKey]?.notes || ""}
                      onChange={(e) => updateSchedule(dayKey, "notes", e.target.value)}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500 mb-3">Optional — only set if this shiur runs for a specific season or term</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  {...register("startDate")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  {...register("endDate")}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LOCATION SECTION */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Location</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="shulId">Location</Label>
            <Select
              value={selectedShulId || "none"}
              onValueChange={(value) => setValue("shulId", value === "none" ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select One</SelectItem>
                <SelectItem value="other">Other</SelectItem>
                {shuls.map((shul) => (
                  <SelectItem key={shul.id} value={shul.id.toString()}>
                    {shul.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showCustomLocation && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div className="space-y-2">
                <Label htmlFor="locationName">Name</Label>
                <Input
                  id="locationName"
                  {...register("locationName")}
                  placeholder="Location name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="locationAddress">Address</Label>
                <Input
                  id="locationAddress"
                  {...register("locationAddress")}
                  placeholder="Street address"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="locationPostalCode">Postal Code</Label>
                  <Input
                    id="locationPostalCode"
                    {...register("locationPostalCode")}
                    placeholder="M5V 1A1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="locationArea">Area</Label>
                  <Select
                    value={selectedLocationArea || "none"}
                    onValueChange={(value) => setValue("locationArea", value === "none" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select area" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select One</SelectItem>
                      {LOCATION_AREAS.map((area) => (
                        <SelectItem key={area.value} value={area.value}>
                          {area.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CONTACT INFO SECTION */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contact Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactName">Contact</Label>
              <Input
                id="contactName"
                {...register("contactName")}
                placeholder="Contact person name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Phone No</Label>
              <Input
                id="contactPhone"
                {...register("contactPhone")}
                placeholder="416-555-0123"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Email</Label>
              <Input
                id="contactEmail"
                type="email"
                {...register("contactEmail")}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                {...register("website")}
                placeholder="https://example.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GENERAL INFORMATION SECTION */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">General Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={selectedCategory || "none"}
                onValueChange={(value) => setValue("category", value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select One</SelectItem>
                  {SHIUR_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="classType">Class Type</Label>
              <Select
                value={selectedClassType || "none"}
                onValueChange={(value) => setValue("classType", value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select One</SelectItem>
                  {SHIUR_CLASS_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="level">Level</Label>
              <Select
                value={selectedLevel || "none"}
                onValueChange={(value) => setValue("level", value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select One</SelectItem>
                  {SHIUR_LEVELS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">M/F</Label>
              <Select
                value={selectedGender || "none"}
                onValueChange={(value) => setValue("gender", value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select One</SelectItem>
                  {SHIUR_GENDERS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cost">Cost</Label>
              <Input
                id="cost"
                {...register("cost")}
                placeholder="Free, $10, etc."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectOf">Project of</Label>
              <Select
                value={selectedProjectOf || "none"}
                onValueChange={(value) => setValue("projectOf", value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select One</SelectItem>
                  {ORGANIZATIONS.map((org) => (
                    <SelectItem key={org.value} value={org.value}>
                      {org.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* OTHER FIELDS SECTION */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Other</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="submitterEmail">Email Address</Label>
            <Input
              id="submitterEmail"
              type="email"
              {...register("submitterEmail")}
              placeholder="Your email address"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isOnHold"
              checked={isOnHold}
              onCheckedChange={(checked) => setValue("isOnHold", checked as boolean)}
            />
            <Label htmlFor="isOnHold" className="font-normal">
              On Hold
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* FORM ACTIONS */}
      <div className="flex justify-end gap-4 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : initialData?.id ? "Save Changes" : "Add Shiur"}
        </Button>
      </div>
    </form>
  );
}
