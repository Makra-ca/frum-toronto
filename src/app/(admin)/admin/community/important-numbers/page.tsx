"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Pencil,
  Trash2,
  Phone,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface ImportantNumber {
  id: number;
  name: string;
  phone: string;
  category: string | null;
  description: string | null;
  isEmergency: boolean | null;
  displayOrder: number | null;
}

const defaultForm = {
  name: "",
  phone: "",
  category: "",
  description: "",
  isEmergency: false,
  displayOrder: 0,
};

export default function ImportantNumbersPage() {
  const [numbers, setNumbers] = useState<ImportantNumber[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNumber, setEditingNumber] = useState<ImportantNumber | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [isSaving, setIsSaving] = useState(false);

  // Delete state
  const [deleteNumber, setDeleteNumber] = useState<ImportantNumber | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchNumbers();
  }, []);

  const fetchNumbers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/important-numbers");
      const data = await res.json();
      if (res.ok) {
        setNumbers(data.numbers || []);
      } else {
        toast.error("Failed to load important numbers");
      }
    } catch (error) {
      console.error("Error fetching important numbers:", error);
      toast.error("Failed to load important numbers");
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingNumber(null);
    setForm(defaultForm);
    setIsDialogOpen(true);
  };

  const openEditDialog = (entry: ImportantNumber) => {
    setEditingNumber(entry);
    setForm({
      name: entry.name || "",
      phone: entry.phone || "",
      category: entry.category || "",
      description: entry.description || "",
      isEmergency: entry.isEmergency || false,
      displayOrder: entry.displayOrder ?? 0,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!form.phone.trim()) {
      toast.error("Phone is required");
      return;
    }

    setIsSaving(true);
    try {
      const url = editingNumber
        ? `/api/admin/important-numbers/${editingNumber.id}`
        : "/api/admin/important-numbers";

      const res = await fetch(url, {
        method: editingNumber ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          category: form.category || null,
          description: form.description || null,
          isEmergency: form.isEmergency,
          displayOrder: form.displayOrder,
        }),
      });

      if (res.ok) {
        toast.success(editingNumber ? "Number updated" : "Number created");
        setIsDialogOpen(false);
        fetchNumbers();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save");
      }
    } catch (error) {
      toast.error("Failed to save important number");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteNumber) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/important-numbers/${deleteNumber.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Number deleted");
        setDeleteNumber(null);
        fetchNumbers();
      } else {
        toast.error("Failed to delete");
      }
    } catch (error) {
      toast.error("Failed to delete important number");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Number
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : numbers.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center">
          <Phone className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No important numbers yet</p>
          <Button onClick={openCreateDialog} variant="outline" className="mt-4">
            <Plus className="h-4 w-4 mr-2" />
            Add First Number
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Emergency</TableHead>
                <TableHead className="text-center">Order</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {numbers.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">
                    <div>
                      {entry.name}
                      {entry.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{entry.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{entry.phone}</TableCell>
                  <TableCell>
                    {entry.category ? (
                      <Badge variant="secondary">{entry.category}</Badge>
                    ) : (
                      <span className="text-gray-400 text-sm">--</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {entry.isEmergency && (
                      <Badge className="bg-red-100 text-red-800 gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Emergency
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{entry.displayOrder ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(entry)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteNumber(entry)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingNumber ? "Edit Number" : "Add Number"}
            </DialogTitle>
            <DialogDescription>
              {editingNumber
                ? "Update the details for this important number"
                : "Add a new important number to the community directory"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Hatzoloh Toronto"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="e.g. (416) 907-8000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Emergency, Medical, Community"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description (optional)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayOrder">Display Order</Label>
              <Input
                id="displayOrder"
                type="number"
                value={form.displayOrder}
                onChange={(e) =>
                  setForm({ ...form, displayOrder: parseInt(e.target.value) || 0 })
                }
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="isEmergency"
                checked={form.isEmergency}
                onCheckedChange={(checked) =>
                  setForm({ ...form, isEmergency: checked === true })
                }
              />
              <Label htmlFor="isEmergency" className="cursor-pointer">
                Emergency number
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingNumber ? "Save Changes" : "Add Number"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteNumber} onOpenChange={() => setDeleteNumber(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Number?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove &quot;{deleteNumber?.name}&quot; from the important
              numbers list. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
