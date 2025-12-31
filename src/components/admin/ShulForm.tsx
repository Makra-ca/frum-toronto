"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { shulSchema, ShulFormData, DENOMINATIONS, NUSACH_OPTIONS } from "@/lib/validations/content";
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

interface Business {
  id: number;
  name: string;
  address: string | null;
}

interface ShulFormProps {
  initialData?: {
    id?: number;
    businessId: number;
    rabbi: string | null;
    denomination: string | null;
    nusach: string | null;
    hasMinyan: boolean | null;
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
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ShulFormData>({
    resolver: zodResolver(shulSchema),
    defaultValues: {
      businessId: initialData?.businessId || 0,
      rabbi: initialData?.rabbi || "",
      denomination: initialData?.denomination || "",
      nusach: initialData?.nusach || "",
      hasMinyan: initialData?.hasMinyan ?? true,
    },
  });

  const hasMinyan = watch("hasMinyan");
  const selectedBusinessId = watch("businessId");

  useEffect(() => {
    async function fetchBusinesses() {
      try {
        const response = await fetch("/api/directory/search?limit=500");
        const data = await response.json();
        setBusinesses(data.businesses || []);
      } catch (error) {
        console.error("Error fetching businesses:", error);
      } finally {
        setLoadingBusinesses(false);
      }
    }
    fetchBusinesses();
  }, []);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="businessId">Business *</Label>
        <Select
          value={selectedBusinessId?.toString() || ""}
          onValueChange={(value) => setValue("businessId", parseInt(value))}
          disabled={loadingBusinesses || !!initialData?.id}
        >
          <SelectTrigger>
            <SelectValue placeholder={loadingBusinesses ? "Loading..." : "Select a business"} />
          </SelectTrigger>
          <SelectContent>
            {businesses.map((business) => (
              <SelectItem key={business.id} value={business.id.toString()}>
                {business.name} {business.address && `- ${business.address}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.businessId && (
          <p className="text-sm text-red-500">{errors.businessId.message}</p>
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
