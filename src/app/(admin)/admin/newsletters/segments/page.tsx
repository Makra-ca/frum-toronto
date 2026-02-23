"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Pencil, Users } from "lucide-react";
import { toast } from "sonner";
import type { NewsletterSegment } from "@/types/newsletter";
import Link from "next/link";

interface SegmentWithCount extends NewsletterSegment {
  subscriberCount: number;
}

interface FilterCriteria {
  newsletter?: boolean;
  kosherAlerts?: boolean;
  eruvStatus?: boolean;
  simchas?: boolean;
  shiva?: boolean;
}

const SUBSCRIPTION_OPTIONS = [
  { key: "newsletter", label: "Newsletter" },
  { key: "kosherAlerts", label: "Kosher Alerts" },
  { key: "eruvStatus", label: "Eruv Status" },
  { key: "simchas", label: "Simchas" },
  { key: "shiva", label: "Shiva Notices" },
] as const;

export default function SegmentsPage() {
  const [segments, setSegments] = useState<SegmentWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingSegment, setEditingSegment] = useState<SegmentWithCount | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isDefault: false,
    filterCriteria: {} as FilterCriteria,
  });

  useEffect(() => {
    fetchSegments();
  }, []);

  const fetchSegments = async () => {
    try {
      const res = await fetch("/api/admin/newsletter-segments");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setSegments(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load segments");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      isDefault: false,
      filterCriteria: {},
    });
  };

  const handleEdit = (segment: SegmentWithCount) => {
    setEditingSegment(segment);
    setFormData({
      name: segment.name,
      description: segment.description || "",
      isDefault: segment.isDefault,
      filterCriteria: (segment.filterCriteria as FilterCriteria) || {},
    });
  };

  const handleFilterChange = (key: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      filterCriteria: {
        ...prev.filterCriteria,
        [key]: checked ? true : undefined,
      },
    }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    // Clean up filter criteria - remove undefined values
    const cleanedCriteria: FilterCriteria = {};
    for (const [key, value] of Object.entries(formData.filterCriteria)) {
      if (value === true) {
        cleanedCriteria[key as keyof FilterCriteria] = true;
      }
    }

    setIsSaving(true);
    try {
      const url = editingSegment
        ? `/api/admin/newsletter-segments/${editingSegment.id}`
        : "/api/admin/newsletter-segments";

      const res = await fetch(url, {
        method: editingSegment ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          filterCriteria: cleanedCriteria,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      toast.success(editingSegment ? "Segment updated" : "Segment created");
      setShowAddDialog(false);
      setEditingSegment(null);
      resetForm();
      fetchSegments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save segment");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const res = await fetch(`/api/admin/newsletter-segments/${deleteId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }

      toast.success("Segment deleted");
      setSegments((prev) => prev.filter((s) => s.id !== deleteId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete segment");
    } finally {
      setDeleteId(null);
    }
  };

  const getActiveFilters = (criteria: FilterCriteria | null) => {
    if (!criteria) return [];
    return SUBSCRIPTION_OPTIONS.filter(
      (opt) => criteria[opt.key as keyof FilterCriteria] === true
    ).map((opt) => opt.label);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/newsletters">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Segments</h1>
            <p className="text-gray-600">
              Create segments to target specific subscriber groups
            </p>
          </div>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Segment
        </Button>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          Segments let you send newsletters to specific groups of subscribers based on their
          subscription preferences. For example, create a segment for subscribers who opted
          into &quot;Kosher Alerts&quot; to send targeted kosher-related content.
        </p>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">Loading...</p>
        </div>
      ) : segments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No segments created yet</p>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Segment
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Filters</TableHead>
                <TableHead>Subscribers</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {segments.map((segment) => (
                <TableRow key={segment.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {segment.name}
                      {segment.isDefault && (
                        <Badge variant="secondary" className="text-xs">
                          Default
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-500">
                    {segment.description || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {getActiveFilters(segment.filterCriteria as FilterCriteria).length > 0 ? (
                        getActiveFilters(segment.filterCriteria as FilterCriteria).map((filter) => (
                          <Badge key={filter} variant="outline" className="text-xs">
                            {filter}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-gray-400 text-sm">All subscribers</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-blue-100 text-blue-800">
                      {segment.subscriberCount} subscribers
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(segment)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(segment.id)}
                        className="text-red-600 hover:text-red-700"
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

      {/* Add/Edit Dialog */}
      <Dialog
        open={showAddDialog || !!editingSegment}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false);
            setEditingSegment(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSegment ? "Edit Segment" : "Create Segment"}
            </DialogTitle>
            <DialogDescription>
              Define a segment to target specific subscribers based on their preferences.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Kosher Alert Subscribers"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description for this segment..."
                rows={2}
              />
            </div>

            <div className="space-y-3 pt-4 border-t">
              <Label className="text-sm font-medium text-gray-700">
                Filter by Subscription Type
              </Label>
              <p className="text-xs text-gray-500">
                Only include subscribers who have opted into these preferences.
                Leave all unchecked to include all active subscribers.
              </p>
              <div className="space-y-3 pt-2">
                {SUBSCRIPTION_OPTIONS.map(({ key, label }) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={key}
                      checked={formData.filterCriteria[key as keyof FilterCriteria] === true}
                      onCheckedChange={(checked) =>
                        handleFilterChange(key, checked as boolean)
                      }
                    />
                    <Label htmlFor={key} className="font-normal cursor-pointer">
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-4 border-t">
              <Checkbox
                id="isDefault"
                checked={formData.isDefault}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isDefault: checked as boolean })
                }
              />
              <Label htmlFor="isDefault" className="font-normal cursor-pointer">
                Set as default segment for new newsletters
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddDialog(false);
                setEditingSegment(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Segment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this segment? This action cannot be undone.
              Existing newsletters using this segment will not be affected.
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
