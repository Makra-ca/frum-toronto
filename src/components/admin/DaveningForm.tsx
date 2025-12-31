"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DAYS_OF_WEEK, TEFILAH_TYPES } from "@/lib/validations/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const formSchema = z.object({
  tefilahType: z.enum(["shacharis", "mincha", "maariv"]),
  dayOfWeek: z.string().optional(),
  time: z.string().min(1, "Time is required"),
  notes: z.string().optional(),
  isWinter: z.boolean(),
  isSummer: z.boolean(),
  isShabbos: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface DaveningFormProps {
  initialData?: {
    id?: number;
    tefilahType: string | null;
    dayOfWeek: number | null;
    time: string;
    notes: string | null;
    isWinter: boolean | null;
    isSummer: boolean | null;
    isShabbos: boolean | null;
  };
  onSubmit: (data: {
    tefilahType: string;
    dayOfWeek: number | null;
    time: string;
    notes: string | null;
    isWinter: boolean;
    isSummer: boolean;
    isShabbos: boolean;
  }) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function DaveningForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: DaveningFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tefilahType: (initialData?.tefilahType as "shacharis" | "mincha" | "maariv") || "shacharis",
      dayOfWeek: initialData?.dayOfWeek?.toString() || "",
      time: initialData?.time || "",
      notes: initialData?.notes || "",
      isWinter: initialData?.isWinter ?? true,
      isSummer: initialData?.isSummer ?? true,
      isShabbos: initialData?.isShabbos ?? false,
    },
  });

  const isWinter = watch("isWinter");
  const isSummer = watch("isSummer");
  const isShabbos = watch("isShabbos");
  const selectedTefilahType = watch("tefilahType");
  const selectedDayOfWeek = watch("dayOfWeek");

  async function handleFormSubmit(data: FormData) {
    await onSubmit({
      tefilahType: data.tefilahType,
      dayOfWeek: data.dayOfWeek ? parseInt(data.dayOfWeek) : null,
      time: data.time,
      notes: data.notes || null,
      isWinter: data.isWinter,
      isSummer: data.isSummer,
      isShabbos: data.isShabbos,
    });
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="tefilahType">Tefilah Type *</Label>
          <Select
            value={selectedTefilahType}
            onValueChange={(value) =>
              setValue("tefilahType", value as "shacharis" | "mincha" | "maariv")
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select tefilah" />
            </SelectTrigger>
            <SelectContent>
              {TEFILAH_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.tefilahType && (
            <p className="text-sm text-red-500">{errors.tefilahType.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="dayOfWeek">Day of Week</Label>
          <Select
            value={selectedDayOfWeek || "daily"}
            onValueChange={(value) => setValue("dayOfWeek", value === "daily" ? "" : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Daily (all days)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily (all days)</SelectItem>
              {DAYS_OF_WEEK.map((d) => (
                <SelectItem key={d.value} value={d.value.toString()}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="time">Time *</Label>
        <Input id="time" type="time" {...register("time")} />
        {errors.time && (
          <p className="text-sm text-red-500">{errors.time.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Input
          id="notes"
          {...register("notes")}
          placeholder="e.g., 'Followed by breakfast'"
        />
      </div>

      <div className="space-y-4">
        <Label>Active Seasons</Label>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center space-x-2">
            <Switch
              id="isWinter"
              checked={isWinter}
              onCheckedChange={(checked) => setValue("isWinter", checked)}
            />
            <Label htmlFor="isWinter">Winter</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="isSummer"
              checked={isSummer}
              onCheckedChange={(checked) => setValue("isSummer", checked)}
            />
            <Label htmlFor="isSummer">Summer</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="isShabbos"
              checked={isShabbos}
              onCheckedChange={(checked) => setValue("isShabbos", checked)}
            />
            <Label htmlFor="isShabbos">Shabbos Only</Label>
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
            ? "Update Schedule"
            : "Add Schedule"}
        </Button>
      </div>
    </form>
  );
}
