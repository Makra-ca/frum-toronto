"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
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
import { DaveningForm } from "@/components/admin/DaveningForm";
import { DaveningTable } from "@/components/admin/DaveningTable";
import { Plus, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface DaveningSchedule {
  id: number;
  shulId: number | null;
  tefilahType: string | null;
  dayOfWeek: number | null;
  time: string;
  notes: string | null;
  isWinter: boolean | null;
  isSummer: boolean | null;
  isShabbos: boolean | null;
}

interface Shul {
  id: number;
  businessName: string | null;
  rabbi: string | null;
  daveningSchedules: DaveningSchedule[];
}

export default function DaveningPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const shulId = parseInt(id);

  const [shul, setShul] = useState<Shul | null>(null);
  const [schedules, setSchedules] = useState<DaveningSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<DaveningSchedule | null>(
    null
  );
  const [deletingSchedule, setDeletingSchedule] =
    useState<DaveningSchedule | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function fetchData() {
    try {
      const response = await fetch(`/api/admin/shuls/${shulId}`);
      if (response.ok) {
        const data = await response.json();
        setShul(data);
        setSchedules(data.daveningSchedules || []);
      } else {
        toast.error("Failed to fetch shul data");
      }
    } catch (error) {
      console.error("Error fetching shul:", error);
      toast.error("Failed to fetch shul data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [shulId]);

  async function handleSubmit(data: {
    tefilahType: string;
    dayOfWeek: number | null;
    time: string;
    notes: string | null;
    isWinter: boolean;
    isSummer: boolean;
    isShabbos: boolean;
  }) {
    setIsSubmitting(true);
    try {
      const url = editingSchedule
        ? `/api/admin/shuls/${shulId}/davening/${editingSchedule.id}`
        : `/api/admin/shuls/${shulId}/davening`;
      const method = editingSchedule ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save schedule");
      }

      toast.success(
        editingSchedule
          ? "Schedule updated successfully"
          : "Schedule added successfully"
      );

      setIsDialogOpen(false);
      setEditingSchedule(null);
      fetchData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save schedule"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deletingSchedule) return;

    try {
      const response = await fetch(
        `/api/admin/shuls/${shulId}/davening/${deletingSchedule.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Failed to delete schedule");
      }

      toast.success("Schedule deleted successfully");

      setIsDeleteDialogOpen(false);
      setDeletingSchedule(null);
      fetchData();
    } catch (error) {
      toast.error("Failed to delete schedule");
    }
  }

  function handleEdit(schedule: DaveningSchedule) {
    setEditingSchedule(schedule);
    setIsDialogOpen(true);
  }

  function handleDeleteClick(schedule: DaveningSchedule) {
    setDeletingSchedule(schedule);
    setIsDeleteDialogOpen(true);
  }

  function handleDialogClose() {
    setIsDialogOpen(false);
    setEditingSchedule(null);
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

  if (!shul) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-500">Shul not found</p>
          <Link href="/admin/shuls">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Shuls
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/shuls">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Davening Schedule</h1>
          <p className="text-gray-500">
            {shul.businessName}
            {shul.rabbi && ` • Rabbi ${shul.rabbi}`}
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Schedule
        </Button>
      </div>

      <DaveningTable
        schedules={schedules}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
      />

      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingSchedule ? "Edit Schedule" : "Add New Schedule"}
            </DialogTitle>
          </DialogHeader>
          <DaveningForm
            initialData={editingSchedule || undefined}
            onSubmit={handleSubmit}
            onCancel={handleDialogClose}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schedule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this davening schedule? This action
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
