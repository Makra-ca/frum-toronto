"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  categoryId: z.string().optional(),
  description: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  isKosher: z.boolean(),
  kosherCertification: z.string().optional(),
  isFeatured: z.boolean(),
  // Hours
  sundayOpen: z.string().optional(),
  sundayClose: z.string().optional(),
  mondayOpen: z.string().optional(),
  mondayClose: z.string().optional(),
  tuesdayOpen: z.string().optional(),
  tuesdayClose: z.string().optional(),
  wednesdayOpen: z.string().optional(),
  wednesdayClose: z.string().optional(),
  thursdayOpen: z.string().optional(),
  thursdayClose: z.string().optional(),
  fridayOpen: z.string().optional(),
  fridayClose: z.string().optional(),
  saturdayOpen: z.string().optional(),
  saturdayClose: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Category {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  children?: Category[];
}

interface BusinessHours {
  sunday?: { open: string; close: string } | null;
  monday?: { open: string; close: string } | null;
  tuesday?: { open: string; close: string } | null;
  wednesday?: { open: string; close: string } | null;
  thursday?: { open: string; close: string } | null;
  friday?: { open: string; close: string } | null;
  saturday?: { open: string; close: string } | null;
}

interface BusinessFormProps {
  initialData?: {
    id?: number;
    name: string;
    categoryId: number | null;
    description: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    address: string | null;
    city: string | null;
    postalCode: string | null;
    isKosher: boolean | null;
    kosherCertification: string | null;
    isFeatured: boolean | null;
    hours: BusinessHours | null;
  };
  onSubmit: (data: {
    name: string;
    categoryId: number | null;
    description: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    address: string | null;
    city: string;
    postalCode: string | null;
    isKosher: boolean;
    kosherCertification: string | null;
    isFeatured: boolean;
    hours: BusinessHours | null;
  }) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const DAYS = [
  { key: "sunday", label: "Sunday" },
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
] as const;

export function BusinessForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: BusinessFormProps) {
  const [categories, setCategories] = useState<Category[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || "",
      categoryId: initialData?.categoryId?.toString() || "",
      description: initialData?.description || "",
      phone: initialData?.phone || "",
      email: initialData?.email || "",
      website: initialData?.website || "",
      address: initialData?.address || "",
      city: initialData?.city || "Toronto",
      postalCode: initialData?.postalCode || "",
      isKosher: initialData?.isKosher ?? false,
      kosherCertification: initialData?.kosherCertification || "",
      isFeatured: initialData?.isFeatured ?? false,
      // Hours
      sundayOpen: initialData?.hours?.sunday?.open || "",
      sundayClose: initialData?.hours?.sunday?.close || "",
      mondayOpen: initialData?.hours?.monday?.open || "",
      mondayClose: initialData?.hours?.monday?.close || "",
      tuesdayOpen: initialData?.hours?.tuesday?.open || "",
      tuesdayClose: initialData?.hours?.tuesday?.close || "",
      wednesdayOpen: initialData?.hours?.wednesday?.open || "",
      wednesdayClose: initialData?.hours?.wednesday?.close || "",
      thursdayOpen: initialData?.hours?.thursday?.open || "",
      thursdayClose: initialData?.hours?.thursday?.close || "",
      fridayOpen: initialData?.hours?.friday?.open || "",
      fridayClose: initialData?.hours?.friday?.close || "",
      saturdayOpen: initialData?.hours?.saturday?.open || "",
      saturdayClose: initialData?.hours?.saturday?.close || "",
    },
  });

  const isKosher = watch("isKosher");
  const selectedCategoryId = watch("categoryId");

  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch("/api/admin/business-categories");
        if (response.ok) {
          const data = await response.json();
          setCategories(data);
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    }
    fetchCategories();
  }, []);

  async function handleFormSubmit(data: FormData) {
    // Build hours object
    const hours: BusinessHours = {};

    for (const day of DAYS) {
      const openKey = `${day.key}Open` as keyof FormData;
      const closeKey = `${day.key}Close` as keyof FormData;
      const openValue = data[openKey] as string;
      const closeValue = data[closeKey] as string;

      if (openValue && closeValue) {
        hours[day.key] = { open: openValue, close: closeValue };
      }
    }

    await onSubmit({
      name: data.name,
      categoryId: data.categoryId ? parseInt(data.categoryId) : null,
      description: data.description || null,
      phone: data.phone || null,
      email: data.email || null,
      website: data.website || null,
      address: data.address || null,
      city: data.city || "Toronto",
      postalCode: data.postalCode || null,
      isKosher: data.isKosher,
      kosherCertification: data.isKosher ? (data.kosherCertification || null) : null,
      isFeatured: data.isFeatured,
      hours: Object.keys(hours).length > 0 ? hours : null,
    });
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Business Name *</Label>
          <Input
            id="name"
            {...register("name")}
            placeholder="Enter business name"
          />
          {errors.name && (
            <p className="text-sm text-red-500">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="categoryId">Category</Label>
          <Select
            value={selectedCategoryId || "none"}
            onValueChange={(value) =>
              setValue("categoryId", value === "none" ? "" : value)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No category</SelectItem>
              {categories.map((parent) => (
                <SelectGroup key={parent.id}>
                  <SelectLabel className="font-semibold">{parent.name}</SelectLabel>
                  {parent.children && parent.children.length > 0 ? (
                    parent.children.map((child) => (
                      <SelectItem key={child.id} value={child.id.toString()}>
                        {child.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value={parent.id.toString()}>
                      {parent.name}
                    </SelectItem>
                  )}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            {...register("description")}
            placeholder="Describe the business"
            rows={3}
          />
        </div>
      </div>

      {/* Contact Info */}
      <div className="border-t pt-4">
        <h4 className="font-medium mb-3">Contact Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              {...register("phone")}
              placeholder="(416) 555-0000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...register("email")}
              placeholder="contact@business.com"
            />
          </div>
        </div>
        <div className="space-y-2 mt-4">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            {...register("website")}
            placeholder="https://www.example.com"
          />
        </div>
      </div>

      {/* Location */}
      <div className="border-t pt-4">
        <h4 className="font-medium mb-3">Location</h4>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              {...register("address")}
              placeholder="123 Main Street"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" {...register("city")} placeholder="Toronto" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">Postal Code</Label>
              <Input
                id="postalCode"
                {...register("postalCode")}
                placeholder="M5V 1A1"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Kosher */}
      <div className="border-t pt-4">
        <h4 className="font-medium mb-3">Kosher Status</h4>
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="isKosher"
              checked={isKosher}
              onCheckedChange={(checked) => setValue("isKosher", checked)}
            />
            <Label htmlFor="isKosher">Kosher Certified</Label>
          </div>
          {isKosher && (
            <div className="space-y-2">
              <Label htmlFor="kosherCertification">Certification</Label>
              <Input
                id="kosherCertification"
                {...register("kosherCertification")}
                placeholder="e.g., COR, OU, OK"
              />
            </div>
          )}
        </div>
      </div>

      {/* Featured */}
      <div className="border-t pt-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="isFeatured"
            checked={watch("isFeatured")}
            onCheckedChange={(checked) => setValue("isFeatured", checked)}
          />
          <Label htmlFor="isFeatured">Featured Business</Label>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Featured businesses appear at the top of listings
        </p>
      </div>

      {/* Hours */}
      <Accordion type="single" collapsible className="border-t pt-4">
        <AccordionItem value="hours" className="border-none">
          <AccordionTrigger className="font-medium py-2">
            Business Hours (optional)
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pt-2">
              {DAYS.map((day) => (
                <div key={day.key} className="grid grid-cols-5 gap-2 items-center">
                  <Label className="col-span-1">{day.label}</Label>
                  <Input
                    type="time"
                    {...register(`${day.key}Open` as keyof FormData)}
                    className="col-span-2"
                    placeholder="Open"
                  />
                  <Input
                    type="time"
                    {...register(`${day.key}Close` as keyof FormData)}
                    className="col-span-2"
                    placeholder="Close"
                  />
                </div>
              ))}
              <p className="text-sm text-gray-500 mt-2">
                Leave both times empty for days the business is closed
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading
            ? "Saving..."
            : initialData?.id
            ? "Update Business"
            : "Create Business"}
        </Button>
      </div>
    </form>
  );
}
