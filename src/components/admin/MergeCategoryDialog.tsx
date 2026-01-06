"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AlertTriangle, GitMerge, Loader2 } from "lucide-react";

interface Category {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  businessCount: number;
  children?: Category[];
}

interface MergeCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceCategory: Category | null;
  allCategories: Category[];
  onMerge: (sourceId: number, targetId: number) => Promise<void>;
  isLoading?: boolean;
}

export function MergeCategoryDialog({
  open,
  onOpenChange,
  sourceCategory,
  allCategories,
  onMerge,
  isLoading = false,
}: MergeCategoryDialogProps) {
  const [targetCategoryId, setTargetCategoryId] = useState<string>("");

  if (!sourceCategory) return null;

  // Flatten all categories for dropdown, excluding the source
  function getAvailableTargets(): { id: number; name: string; depth: number }[] {
    const result: { id: number; name: string; depth: number }[] = [];

    function addCategory(cat: Category, depth: number) {
      if (cat.id !== sourceCategory.id) {
        result.push({ id: cat.id, name: cat.name, depth });
      }
      if (cat.children) {
        cat.children.forEach((child) => {
          if (child.id !== sourceCategory.id) {
            result.push({ id: child.id, name: child.name, depth: depth + 1 });
          }
        });
      }
    }

    allCategories.forEach((cat) => addCategory(cat, 0));
    return result;
  }

  const availableTargets = getAvailableTargets();

  async function handleMerge() {
    if (!targetCategoryId) return;
    await onMerge(sourceCategory.id, parseInt(targetCategoryId));
    setTargetCategoryId("");
  }

  function handleClose() {
    setTargetCategoryId("");
    onOpenChange(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            Merge Category
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                Merge <strong>&quot;{sourceCategory.name}&quot;</strong> into another category.
              </p>

              {sourceCategory.businessCount > 0 && (
                <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <strong>{sourceCategory.businessCount}</strong> business
                    {sourceCategory.businessCount !== 1 ? "es" : ""} will be
                    moved to the target category.
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Select target category</Label>
                <Select
                  value={targetCategoryId}
                  onValueChange={setTargetCategoryId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a category to merge into..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTargets.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.depth > 0 ? "└ " : ""}
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <p className="text-sm text-gray-500">
                After merging, &quot;{sourceCategory.name}&quot; will be archived
                (marked as inactive) and hidden from public view.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleMerge}
            disabled={!targetCategoryId || isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Merging...
              </>
            ) : (
              <>
                <GitMerge className="h-4 w-4 mr-2" />
                Merge Category
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
