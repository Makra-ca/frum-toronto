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
import { ShulForm } from "@/components/admin/ShulForm";
import { ShulTable, type Shul } from "@/components/admin/ShulTable";
import { ShulFormData } from "@/lib/validations/content";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export default function AdminShulsPage() {
  const [shuls, setShuls] = useState<Shul[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingShul, setEditingShul] = useState<Shul | null>(null);
  const [deletingShul, setDeletingShul] = useState<Shul | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function fetchShuls() {
    try {
      const response = await fetch("/api/admin/shuls");
      if (response.ok) {
        const data = await response.json();
        setShuls(data);
      }
    } catch (error) {
      console.error("Error fetching shuls:", error);
      toast.error("Failed to fetch shuls");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchShuls();
  }, []);

  async function handleSubmit(data: ShulFormData) {
    setIsSubmitting(true);
    try {
      const url = editingShul
        ? `/api/admin/shuls/${editingShul.id}`
        : "/api/admin/shuls";
      const method = editingShul ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save shul");
      }

      toast.success(
        editingShul ? "Shul updated successfully" : "Shul created successfully"
      );

      setIsDialogOpen(false);
      setEditingShul(null);
      fetchShuls();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save shul"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deletingShul) return;

    try {
      const response = await fetch(`/api/admin/shuls/${deletingShul.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete shul");
      }

      toast.success("Shul deleted successfully");

      setIsDeleteDialogOpen(false);
      setDeletingShul(null);
      fetchShuls();
    } catch (error) {
      toast.error("Failed to delete shul");
    }
  }

  function handleEdit(shul: Shul) {
    setEditingShul(shul);
    setIsDialogOpen(true);
  }

  function handleDeleteClick(shul: Shul) {
    setDeletingShul(shul);
    setIsDeleteDialogOpen(true);
  }

  function handleDialogClose() {
    setIsDialogOpen(false);
    setEditingShul(null);
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
          <h1 className="text-2xl font-bold">Shuls</h1>
          <p className="text-gray-500">Manage synagogues and their davening schedules</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Shul
        </Button>
      </div>

      <ShulTable
        shuls={shuls}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
      />

      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingShul ? "Edit Shul" : "Add New Shul"}
            </DialogTitle>
          </DialogHeader>
          <ShulForm
            initialData={
              editingShul
                ? {
                    id: editingShul.id,
                    name: editingShul.name,
                    slug: editingShul.slug,
                    description: editingShul.description,
                    address: editingShul.address,
                    city: editingShul.city,
                    postalCode: editingShul.postalCode,
                    phone: editingShul.phone,
                    email: editingShul.email,
                    website: editingShul.website,
                    rabbi: editingShul.rabbi,
                    denomination: editingShul.denomination,
                    nusach: editingShul.nusach,
                    hasMinyan: editingShul.hasMinyan,
                  }
                : undefined
            }
            onSubmit={handleSubmit}
            onCancel={handleDialogClose}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shul</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingShul?.name}&quot;?
              This will also delete all associated davening schedules. This action
              cannot be undone.
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
