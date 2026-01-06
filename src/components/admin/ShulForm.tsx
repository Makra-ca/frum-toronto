"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { shulSchema, ShulFormData, DENOMINATIONS, NUSACH_OPTIONS } from "@/lib/validations/content";
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

interface ShulFormProps {
  initialData?: {
    id?: number;
    name: string;
    slug?: string;
    description?: string | null;
    address?: string | null;
    city?: string | null;
    postalCode?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    rabbi?: string | null;
    denomination?: string | null;
    nusach?: string | null;
    hasMinyan?: boolean | null;
  };
  onSubmit: (data: ShulFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ShulForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: ShulFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ShulFormData>({
    resolver: zodResolver(shulSchema),
    defaultValues: {
      name: initialData?.name || "",
      slug: initialData?.slug || "",
      description: initialData?.description || "",
      address: initialData?.address || "",
      city: initialData?.city || "Toronto",
      postalCode: initialData?.postalCode || "",
      phone: initialData?.phone || "",
      email: initialData?.email || "",
      website: initialData?.website || "",
      rabbi: initialData?.rabbi || "",
      denomination: initialData?.denomination || "",
      nusach: initialData?.nusach || "",
      hasMinyan: initialData?.hasMinyan ?? true,
    },
  });

  const hasMinyan = watch("hasMinyan");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Basic Information</h3>

        <div className="space-y-2">
          <Label htmlFor="name">Shul Name *</Label>
          <Input
            id="name"
            {...register("name")}
            placeholder="e.g., Shaarei Shomayim"
          />
          {errors.name && (
            <p className="text-sm text-red-500">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            {...register("description")}
            placeholder="Brief description of the shul..."
            rows={3}
          />
          {errors.description && (
            <p className="text-sm text-red-500">{errors.description.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="rabbi">Rabbi</Label>
          <Input
            id="rabbi"
            {...register("rabbi")}
            placeholder="Rabbi name"
          />
          {errors.rabbi && (
            <p className="text-sm text-red-500">{errors.rabbi.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="denomination">Denomination</Label>
            <Select
              value={watch("denomination") || ""}
              onValueChange={(value) => setValue("denomination", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select denomination" />
              </SelectTrigger>
              <SelectContent>
                {DENOMINATIONS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nusach">Nusach</Label>
            <Select
              value={watch("nusach") || ""}
              onValueChange={(value) => setValue("nusach", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select nusach" />
              </SelectTrigger>
              <SelectContent>
                {NUSACH_OPTIONS.map((n) => (
                  <SelectItem key={n.value} value={n.value}>
                    {n.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="hasMinyan"
            checked={hasMinyan}
            onCheckedChange={(checked) => setValue("hasMinyan", checked)}
          />
          <Label htmlFor="hasMinyan">Has regular minyan</Label>
        </div>
      </div>

      {/* Location */}
      <div className="space-y-4 pt-4 border-t">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Location</h3>

        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            {...register("address")}
            placeholder="Street address"
          />
          {errors.address && (
            <p className="text-sm text-red-500">{errors.address.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              {...register("city")}
              placeholder="Toronto"
            />
            {errors.city && (
              <p className="text-sm text-red-500">{errors.city.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="postalCode">Postal Code</Label>
            <Input
              id="postalCode"
              {...register("postalCode")}
              placeholder="M5V 1A1"
            />
            {errors.postalCode && (
              <p className="text-sm text-red-500">{errors.postalCode.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="space-y-4 pt-4 border-t">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Contact Information</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              {...register("phone")}
              placeholder="(416) 555-0123"
            />
            {errors.phone && (
              <p className="text-sm text-red-500">{errors.phone.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...register("email")}
              placeholder="info@shul.com"
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            {...register("website")}
            placeholder="https://www.shul.com"
          />
          {errors.website && (
            <p className="text-sm text-red-500">{errors.website.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : initialData?.id ? "Update Shul" : "Create Shul"}
        </Button>
      </div>
    </form>
  );
}
