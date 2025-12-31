"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShiurForm } from "@/components/admin/ShiurForm";
import { ShiurTable } from "@/components/admin/ShiurTable";
import { SHIUR_CATEGORIES, SHIUR_LEVELS, SHIUR_GENDERS } from "@/lib/validations/content";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { Shiur } from "@/types/content";

export default function AdminShiurimPage() {
  const [shiurim, setShiurim] = useState<Shiur[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingShiur, setEditingShiur] = useState<Shiur | null>(null);
  const [deletingShiur, setDeletingShiur] = useState<Shiur | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [genderFilter, setGenderFilter] = useState<string>("");

  async function fetchShiurim() {
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.append("category", categoryFilter);
      if (levelFilter) params.append("level", levelFilter);
      if (genderFilter) params.append("gender", genderFilter);

      const response = await fetch(`/api/admin/shiurim?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setShiurim(data);
      }
    } catch (error) {
      console.error("Error fetching shiurim:", error);
      toast.error("Failed to fetch shiurim");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchShiurim();
  }, [categoryFilter, levelFilter, genderFilter]);

  async function handleSubmit(data: Record<string, unknown>) {
    setIsSubmitting(true);
    try {
      const url = editingShiur
        ? `/api/admin/shiurim/${editingShiur.id}`
        : "/api/admin/shiurim";
      const method = editingShiur ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save shiur");
      }

      toast.success(
        editingShiur ? "Shiur updated successfully" : "Shiur created successfully"
      );

      setIsDialogOpen(false);
      setEditingShiur(null);
      fetchShiurim();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save shiur"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deletingShiur) return;

    try {
      const response = await fetch(`/api/admin/shiurim/${deletingShiur.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete shiur");
      }

      toast.success("Shiur deleted successfully");

      setIsDeleteDialogOpen(false);
      setDeletingShiur(null);
      fetchShiurim();
    } catch {
      toast.error("Failed to delete shiur");
    }
  }

  function handleEdit(shiur: Shiur) {
    setEditingShiur(shiur);
    setIsDialogOpen(true);
  }

  function handleDeleteClick(shiur: Shiur) {
    setDeletingShiur(shiur);
    setIsDeleteDialogOpen(true);
  }

  function handleDialogClose() {
    setIsDialogOpen(false);
    setEditingShiur(null);
  }

  // Convert Shiur to form data format
  function getFormData(shiur: Shiur | null) {
    if (!shiur) return undefined;
    return {
      id: shiur.id,
      teacherTitle: shiur.teacherTitle || "",
      teacherFirstName: shiur.teacherFirstName || "",
      teacherLastName: shiur.teacherLastName || "",
      title: shiur.title,
      description: shiur.description || "",
      shulId: shiur.shulId?.toString() || "",
      locationName: shiur.locationName || "",
      locationAddress: shiur.locationAddress || "",
      locationPostalCode: shiur.locationPostalCode || "",
      locationArea: shiur.locationArea || "",
      schedule: shiur.schedule || undefined,
      startDate: shiur.startDate || "",
      endDate: shiur.endDate || "",
      category: shiur.category || "",
      classType: shiur.classType || "",
      level: shiur.level || "",
      gender: shiur.gender || "",
      contactName: shiur.contactName || "",
      contactPhone: shiur.contactPhone || "",
      contactEmail: shiur.contactEmail || "",
      website: shiur.website || "",
      cost: shiur.cost || "",
      projectOf: shiur.projectOf || "",
      submitterEmail: shiur.submitterEmail || "",
      isOnHold: shiur.isOnHold || false,
    };
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Shiurim</h1>
          <p className="text-gray-500">Manage Torah classes and learning sessions</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Shiur
        </Button>
      </div>

      <div className="flex gap-4 flex-wrap">
        <Select value={categoryFilter || "all"} onValueChange={(v) => setCategoryFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {SHIUR_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={levelFilter || "all"} onValueChange={(v) => setLevelFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            {SHIUR_LEVELS.map((l) => (
              <SelectItem key={l.value} value={l.value}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={genderFilter || "all"} onValueChange={(v) => setGenderFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everyone</SelectItem>
            {SHIUR_GENDERS.map((g) => (
              <SelectItem key={g.value} value={g.value}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ShiurTable
        shiurim={shiurim}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
      />

      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingShiur ? "Edit Shiur" : "Add New Shiur"}
            </DialogTitle>
          </DialogHeader>
          <ShiurForm
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            initialData={getFormData(editingShiur) as any}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onSubmit={handleSubmit as any}
            onCancel={handleDialogClose}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shiur</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingShiur?.title}&quot;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
