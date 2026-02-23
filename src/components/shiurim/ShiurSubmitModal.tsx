"use client";

import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Loader2, CheckCircle, AlertCircle, Mail } from "lucide-react";
import { DAYS_OF_WEEK, SHIUR_CATEGORIES, SHIUR_LEVELS, SHIUR_GENDERS } from "@/lib/validations/content";

interface Shul {
  id: number;
  name: string;
}

interface ScheduleEntry {
  start: string;
  end: string;
  notes: string;
}

const TEACHER_TITLES = [
  { value: "none", label: "No Title" },
  { value: "Rabbi", label: "Rabbi" },
  { value: "Harav", label: "Harav" },
  { value: "Rav", label: "Rav" },
  { value: "Rebbetzin", label: "Rebbetzin" },
  { value: "Dr.", label: "Dr." },
  { value: "Mr.", label: "Mr." },
  { value: "Mrs.", label: "Mrs." },
  { value: "Ms.", label: "Ms." },
];

export function ShiurSubmitModal() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canSubmit, setCanSubmit] = useState<boolean | null>(null);
  const [permissionLoading, setPermissionLoading] = useState(false);

  // Shuls for dropdown
  const [shuls, setShuls] = useState<Shul[]>([]);
  const [existingAreas, setExistingAreas] = useState<string[]>([]);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [teacherTitle, setTeacherTitle] = useState("");
  const [teacherFirstName, setTeacherFirstName] = useState("");
  const [teacherLastName, setTeacherLastName] = useState("");
  const [shulId, setShulId] = useState<string>("");
  const [locationName, setLocationName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [locationArea, setLocationArea] = useState("");
  const [customArea, setCustomArea] = useState("");
  const [selectedDays, setSelectedDays] = useState<Record<number, ScheduleEntry>>({});
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState("");
  const [gender, setGender] = useState("");
  const [cost, setCost] = useState("");
  const [projectOf, setProjectOf] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [website, setWebsite] = useState("");

  // Check permission when dialog opens
  useEffect(() => {
    if (open && session) {
      checkPermission();
      fetchShuls();
      fetchFilterOptions();
    }
  }, [open, session]);

  const checkPermission = async () => {
    setPermissionLoading(true);
    try {
      const response = await fetch("/api/shiurim/can-submit");
      const data = await response.json();
      setCanSubmit(data.canSubmit);
    } catch (err) {
      setCanSubmit(false);
    } finally {
      setPermissionLoading(false);
    }
  };

  const fetchShuls = async () => {
    try {
      const response = await fetch("/api/shuls");
      const data = await response.json();
      if (Array.isArray(data)) {
        setShuls(data.map((s: { id: number; name: string }) => ({ id: s.id, name: s.name })));
      }
    } catch (err) {
      console.error("Failed to fetch shuls:", err);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const response = await fetch("/api/shiurim?filters=true");
      const data = await response.json();
      if (data.areas) {
        setExistingAreas(data.areas);
      }
    } catch (err) {
      console.error("Failed to fetch filter options:", err);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setTeacherTitle("");
    setTeacherFirstName("");
    setTeacherLastName("");
    setShulId("");
    setLocationName("");
    setLocationAddress("");
    setLocationArea("");
    setCustomArea("");
    setSelectedDays({});
    setCategory("");
    setLevel("");
    setGender("");
    setCost("");
    setProjectOf("");
    setContactName("");
    setContactPhone("");
    setContactEmail("");
    setWebsite("");
    setError(null);
    setSuccess(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
      setCanSubmit(null);
    }
    setOpen(newOpen);
  };

  const toggleDay = (dayValue: number) => {
    setSelectedDays((prev) => {
      if (prev[dayValue]) {
        const { [dayValue]: removed, ...rest } = prev;
        return rest;
      } else {
        return {
          ...prev,
          [dayValue]: { start: "", end: "", notes: "" },
        };
      }
    });
  };

  const updateDaySchedule = (
    dayValue: number,
    field: keyof ScheduleEntry,
    value: string
  ) => {
    setSelectedDays((prev) => ({
      ...prev,
      [dayValue]: {
        ...prev[dayValue],
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    if (!teacherLastName.trim()) {
      setError("Teacher's last name is required");
      return;
    }

    const hasDays = Object.keys(selectedDays).length > 0;
    if (hasDays) {
      // Validate that each selected day has a start time
      for (const dayKey of Object.keys(selectedDays)) {
        if (!selectedDays[parseInt(dayKey)].start) {
          setError(`Please enter a start time for ${DAYS_OF_WEEK.find(d => d.value === parseInt(dayKey))?.label}`);
          return;
        }
      }
    }

    setLoading(true);

    try {
      // Build schedule object
      const schedule: Record<string, ScheduleEntry> = {};
      for (const [dayKey, entry] of Object.entries(selectedDays)) {
        if (entry.start) {
          schedule[dayKey] = entry;
        }
      }

      const finalArea = locationArea === "custom" ? customArea : (locationArea === "none" ? null : locationArea);
      const finalTeacherTitle = teacherTitle === "none" ? null : teacherTitle;
      const finalShulId = shulId === "none" || !shulId ? null : shulId;
      const finalCategory = category === "none" ? null : category;
      const finalLevel = level === "none" ? null : level;
      const finalGender = gender === "none" ? null : gender;

      const response = await fetch("/api/shiurim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          teacherTitle: finalTeacherTitle || null,
          teacherFirstName: teacherFirstName.trim() || null,
          teacherLastName: teacherLastName.trim(),
          shulId: finalShulId,
          locationName: locationName.trim() || null,
          locationAddress: locationAddress.trim() || null,
          locationArea: finalArea || null,
          schedule: Object.keys(schedule).length > 0 ? schedule : null,
          category: finalCategory || null,
          level: finalLevel || null,
          gender: finalGender || null,
          cost: cost.trim() || null,
          projectOf: projectOf.trim() || null,
          contactName: contactName.trim() || null,
          contactPhone: contactPhone.trim() || null,
          contactEmail: contactEmail.trim() || null,
          website: website.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to submit shiur");
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.refresh();
      }, 2000);
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (status === "loading") {
    return (
      <Button disabled>
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading...
      </Button>
    );
  }

  // Not logged in - show login prompt
  if (!session) {
    return (
      <Button onClick={() => router.push("/login?callbackUrl=/shiurim")}>
        <Plus className="h-4 w-4 mr-2" />
        Submit Shiur
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Submit Shiur
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit a Shiur</DialogTitle>
          <DialogDescription>
            Add a Torah class to the community directory
          </DialogDescription>
        </DialogHeader>

        {permissionLoading ? (
          <div className="py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
            <p className="text-gray-600 mt-2">Checking permissions...</p>
          </div>
        ) : canSubmit === false ? (
          <div className="py-8 text-center">
            <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Permission Required
            </h3>
            <p className="text-gray-600 mb-4">
              You don&apos;t currently have permission to submit shiurim directly.
            </p>
            <p className="text-gray-600 mb-6">
              Please contact the admin to request posting access.
            </p>
            <a
              href="mailto:info@frumtoronto.com?subject=Request%20Shiurim%20Posting%20Access"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800"
            >
              <Mail className="h-4 w-4" />
              info@frumtoronto.com
            </a>
          </div>
        ) : success ? (
          <div className="py-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Shiur Submitted Successfully
            </h3>
            <p className="text-gray-600 mb-4">
              Your shiur has been added to the directory.
            </p>
            <Button onClick={() => handleOpenChange(false)}>Close</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Shiur Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Shiur Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Weekly Parsha Shiur"
                required
              />
            </div>

            {/* Teacher Info */}
            <div className="space-y-2">
              <Label>Teacher *</Label>
              <div className="grid grid-cols-3 gap-3">
                <Select value={teacherTitle} onValueChange={setTeacherTitle}>
                  <SelectTrigger>
                    <SelectValue placeholder="Title" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEACHER_TITLES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={teacherFirstName}
                  onChange={(e) => setTeacherFirstName(e.target.value)}
                  placeholder="First Name"
                />
                <Input
                  value={teacherLastName}
                  onChange={(e) => setTeacherLastName(e.target.value)}
                  placeholder="Last Name *"
                  required
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What will be covered in this shiur?"
                rows={3}
              />
            </div>

            {/* Location Section */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium text-gray-900">Location</h3>

              <div className="space-y-2">
                <Label>Shul (if applicable)</Label>
                <Select value={shulId} onValueChange={setShulId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a shul..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None - Custom Location</SelectItem>
                    {shuls.map((shul) => (
                      <SelectItem key={shul.id} value={shul.id.toString()}>
                        {shul.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(!shulId || shulId === "none") && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="locationName">Location Name</Label>
                    <Input
                      id="locationName"
                      value={locationName}
                      onChange={(e) => setLocationName(e.target.value)}
                      placeholder="e.g., Community Center, Private Home"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="locationAddress">Address</Label>
                    <Input
                      id="locationAddress"
                      value={locationAddress}
                      onChange={(e) => setLocationAddress(e.target.value)}
                      placeholder="Full address"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>Area</Label>
                <Select value={locationArea} onValueChange={setLocationArea}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select area..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select area...</SelectItem>
                    {existingAreas.map((area) => (
                      <SelectItem key={area} value={area}>
                        {area}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Other (enter below)</SelectItem>
                  </SelectContent>
                </Select>
                {locationArea === "custom" && (
                  <Input
                    value={customArea}
                    onChange={(e) => setCustomArea(e.target.value)}
                    placeholder="Enter area name"
                    className="mt-2"
                  />
                )}
              </div>
            </div>

            {/* Schedule Section */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium text-gray-900">Schedule</h3>
              <p className="text-sm text-gray-500">
                Select the days this shiur takes place and set the time for each day.
              </p>

              <div className="space-y-3">
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day.value} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`day-${day.value}`}
                        checked={!!selectedDays[day.value]}
                        onCheckedChange={() => toggleDay(day.value)}
                      />
                      <Label htmlFor={`day-${day.value}`} className="font-normal cursor-pointer">
                        {day.label}
                      </Label>
                    </div>

                    {selectedDays[day.value] && (
                      <div className="ml-6 grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-gray-500">Start Time *</Label>
                          <Input
                            type="time"
                            value={selectedDays[day.value].start}
                            onChange={(e) => updateDaySchedule(day.value, "start", e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">End Time</Label>
                          <Input
                            type="time"
                            value={selectedDays[day.value].end}
                            onChange={(e) => updateDaySchedule(day.value, "end", e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Classification */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium text-gray-900">Classification</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {SHIUR_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Level</Label>
                  <Select value={level} onValueChange={setLevel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {SHIUR_LEVELS.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Audience</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {SHIUR_GENDERS.map((g) => (
                        <SelectItem key={g.value} value={g.value}>
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Cost & Organization */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost">Cost</Label>
                <Input
                  id="cost"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="e.g., Free, $10/session"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="projectOf">Organization</Label>
                <Input
                  id="projectOf"
                  value={projectOf}
                  onChange={(e) => setProjectOf(e.target.value)}
                  placeholder="Sponsoring organization"
                />
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium text-gray-900">Contact Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactName">Contact Name</Label>
                  <Input
                    id="contactName"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Phone</Label>
                  <Input
                    id="contactPhone"
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="(416) 555-0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="email@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
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
                Submit Shiur
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
