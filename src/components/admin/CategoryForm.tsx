"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { categorySchema, type CategoryFormData } from "@/lib/validations/content";
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
import { ImageDropzone } from "@/components/ui/image-dropzone";

interface Category {
  id: number;
  name: string;
  parentId: number | null;
  children?: Category[];
}

interface CategoryFormProps {
  initialData?: {
    id?: number;
    name: string;
    description: string | null;
    icon: string | null;
    imageUrl: string | null;
    parentId: number | null;
    displayOrder: number | null;
    isActive: boolean | null;
  };
  categories: Category[]; // For parent dropdown
  onSubmit: (data: CategoryFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function CategoryForm({
  initialData,
  categories,
  onSubmit,
  onCancel,
  isLoading = false,
}: CategoryFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      icon: initialData?.icon || "",
      imageUrl: initialData?.imageUrl || "",
      parentId: initialData?.parentId || null,
      displayOrder: initialData?.displayOrder ?? 0,
      isActive: initialData?.isActive ?? true,
    },
  });

  const selectedParentId = watch("parentId");
  const isActive = watch("isActive");
  const imageUrl = watch("imageUrl");

  // Flatten categories for dropdown, excluding self and descendants
  function getAvailableParents(): { id: number; name: string; depth: number }[] {
    const result: { id: number; name: string; depth: number }[] = [];

    function collectDescendants(catId: number): number[] {
      const descendants: number[] = [catId];
      const findChildren = (parentId: number) => {
        categories.forEach((cat) => {
          if (cat.parentId === parentId) {
            descendants.push(cat.id);
            findChildren(cat.id);
          }
          cat.children?.forEach((child) => {
            if (child.parentId === parentId) {
              descendants.push(child.id);
            }
          });
        });
      };
      findChildren(catId);
      return descendants;
    }

    const excludeIds = initialData?.id ? collectDescendants(initialData.id) : [];

    function addCategory(cat: Category, depth: number) {
      if (!excludeIds.includes(cat.id)) {
        result.push({ id: cat.id, name: cat.name, depth });
      }
      if (cat.children) {
        cat.children.forEach((child) => {
          if (!excludeIds.includes(child.id)) {
            result.push({ id: child.id, name: child.name, depth: depth + 1 });
          }
        });
      }
    }

    categories.forEach((cat) => addCategory(cat, 0));
    return result;
  }

  const availableParents = getAvailableParents();

  async function handleFormSubmit(data: CategoryFormData) {
    await onSubmit(data);
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Category Name *</Label>
        <Input
          id="name"
          {...register("name")}
          placeholder="Enter category name"
        />
        {errors.name && (
          <p className="text-sm text-red-500">{errors.name.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...register("description")}
          placeholder="Brief description of this category"
          rows={2}
        />
        {errors.description && (
          <p className="text-sm text-red-500">{errors.description.message}</p>
        )}
      </div>

      {/* Category Image */}
      <div className="space-y-2">
        <Label>Category Image</Label>
        <p className="text-sm text-gray-500 mb-2">
          This image appears as the hero banner in the directory. Recommended: 600x300px.
        </p>
        <ImageDropzone
          value={imageUrl || null}
          onChange={(url) => setValue("imageUrl", url || "")}
          folder="categories"
          aspectRatio="banner"
          disabled={isLoading}
        />
        {errors.imageUrl && (
          <p className="text-sm text-red-500">{errors.imageUrl.message}</p>
        )}
      </div>

      {/* Parent Category */}
      <div className="space-y-2">
        <Label htmlFor="parentId">Parent Category</Label>
        <Select
          value={selectedParentId?.toString() || "none"}
          onValueChange={(value) =>
            setValue("parentId", value === "none" ? null : parseInt(value))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select parent (or leave empty for top-level)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None (Top-level category)</SelectItem>
            {availableParents.map((cat) => (
              <SelectItem key={cat.id} value={cat.id.toString()}>
                {cat.depth > 0 ? "└ " : ""}{cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-gray-500">
          Leave empty to make this a top-level category
        </p>
      </div>

      {/* Display Order */}
      <div className="space-y-2">
        <Label htmlFor="displayOrder">Display Order</Label>
        <Input
          id="displayOrder"
          type="number"
          {...register("displayOrder", { valueAsNumber: true })}
          placeholder="0"
          className="max-w-[200px]"
        />
        <p className="text-sm text-gray-500">Lower numbers appear first</p>
      </div>

      {/* Active Status */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <Label htmlFor="isActive" className="font-medium">
            Active
          </Label>
          <p className="text-sm text-gray-500">
            Inactive categories are hidden from dropdowns and public view
          </p>
        </div>
        <Switch
          id="isActive"
          checked={isActive}
          onCheckedChange={(checked) => setValue("isActive", checked)}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading
            ? "Saving..."
            : initialData?.id
            ? "Update Category"
            : "Create Category"}
        </Button>
      </div>
    </form>
  );
}
