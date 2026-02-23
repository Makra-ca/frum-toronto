"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Search,
  Loader2,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  MapPin,
  Calendar,
  Phone,
  Clock,
  X,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

interface ShivaEntry {
  id: number;
  niftarName: string;
  niftarNameHebrew: string | null;
  mournerNames: string[] | null;
  shivaAddress: string | null;
  shivaStart: string;
  shivaEnd: string;
  shivaHours: string | null;
  mealInfo: string | null;
  donationInfo: string | null;
  contactPhone: string | null;
  approvalStatus: string;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

interface MournerEntry {
  id: string;
  name: string;
}

export default function ShivaManagementPage() {
  const [entries, setEntries] = useState<ShivaEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    totalCount: 0,
    totalPages: 0,
  });

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Edit dialog
  const [editEntry, setEditEntry] = useState<ShivaEntry | null>(null);
  const [editForm, setEditForm] = useState({
    niftarName: "",
    niftarNameHebrew: "",
    mourners: [] as MournerEntry[],
    shivaAddress: "",
    shivaStart: "",
    shivaEnd: "",
    shivaHours: "",
    mealInfo: "",
    donationInfo: "",
    contactPhone: "",
    approvalStatus: "pending" as "pending" | "approved" | "rejected",
  });
  const [isSaving, setIsSaving] = useState(false);

  // Delete dialog
  const [deleteEntry, setDeleteEntry] = useState<ShivaEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchEntries();
  }, [pagination.page, statusFilter]);

  const fetchEntries = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        status: statusFilter,
        search: search,
      });

      const res = await fetch(`/api/admin/shiva?${params}`);
      const data = await res.json();

      if (res.ok) {
        setEntries(data.entries || []);
        setPagination((prev) => ({
          ...prev,
          totalCount: data.pagination?.totalCount || 0,
          totalPages: data.pagination?.totalPages || 0,
        }));
      }
    } catch (error) {
      console.error("Error fetching shiva notices:", error);
      toast.error("Failed to load entries");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchEntries();
  };

  const openEditDialog = (entry: ShivaEntry) => {
    setEditEntry(entry);
    const mournersList = Array.isArray(entry.mournerNames)
      ? entry.mournerNames.map((name) => ({ id: crypto.randomUUID(), name }))
      : [{ id: crypto.randomUUID(), name: "" }];

    setEditForm({
      niftarName: entry.niftarName || "",
      niftarNameHebrew: entry.niftarNameHebrew || "",
      mourners: mournersList.length > 0 ? mournersList : [{ id: crypto.randomUUID(), name: "" }],
      shivaAddress: entry.shivaAddress || "",
      shivaStart: entry.shivaStart || "",
      shivaEnd: entry.shivaEnd || "",
      shivaHours: entry.shivaHours || "",
      mealInfo: entry.mealInfo || "",
      donationInfo: entry.donationInfo || "",
      contactPhone: entry.contactPhone || "",
      approvalStatus: (entry.approvalStatus as "pending" | "approved" | "rejected") || "pending",
    });
  };

  const addMourner = () => {
    setEditForm({
      ...editForm,
      mourners: [...editForm.mourners, { id: crypto.randomUUID(), name: "" }],
    });
  };

  const removeMourner = (id: string) => {
    if (editForm.mourners.length > 1) {
      setEditForm({
        ...editForm,
        mourners: editForm.mourners.filter((m) => m.id !== id),
      });
    }
  };

  const updateMourner = (id: string, name: string) => {
    setEditForm({
      ...editForm,
      mourners: editForm.mourners.map((m) => (m.id === id ? { ...m, name } : m)),
    });
  };

  const handleSave = async () => {
    if (!editEntry) return;

    if (!editForm.niftarName.trim()) {
      toast.error("Niftar name is required");
      return;
    }

    setIsSaving(true);
    try {
      const mournerNames = editForm.mourners
        .map((m) => m.name.trim())
        .filter((n) => n);

      const res = await fetch(`/api/admin/shiva/${editEntry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niftarName: editForm.niftarName,
          niftarNameHebrew: editForm.niftarNameHebrew || null,
          mournerNames,
          shivaAddress: editForm.shivaAddress || null,
          shivaStart: editForm.shivaStart,
          shivaEnd: editForm.shivaEnd,
          shivaHours: editForm.shivaHours || null,
          mealInfo: editForm.mealInfo || null,
          donationInfo: editForm.donationInfo || null,
          contactPhone: editForm.contactPhone || null,
          approvalStatus: editForm.approvalStatus,
        }),
      });

      if (res.ok) {
        toast.success("Entry updated");
        setEditEntry(null);
        fetchEntries();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update");
      }
    } catch (error) {
      toast.error("Failed to update entry");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteEntry) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/shiva/${deleteEntry.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Entry deleted");
        setDeleteEntry(null);
        fetchEntries();
      } else {
        toast.error("Failed to delete");
      }
    } catch (error) {
      toast.error("Failed to delete entry");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleQuickApprove = async (entry: ShivaEntry) => {
    try {
      const res = await fetch(`/api/admin/shiva/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalStatus: "approved" }),
      });

      if (res.ok) {
        toast.success("Entry approved");
        fetchEntries();
      } else {
        toast.error("Failed to approve");
      }
    } catch (error) {
      toast.error("Failed to approve entry");
    }
  };

  const getStatusBadge = (entry: ShivaEntry) => {
    const today = new Date().toISOString().split("T")[0];
    const isExpired = entry.shivaEnd < today;

    if (isExpired) {
      return <Badge variant="secondary">Ended</Badge>;
    }

    switch (entry.approvalStatus) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{entry.approvalStatus}</Badge>;
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shiva Notices</h1>
          <p className="text-gray-600 text-sm">Manage shiva notice submissions</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Search by name or address..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="w-[150px]">
              <Label htmlFor="status">Status</Label>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPagination(p => ({ ...p, page: 1 })); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>

            <Button variant="outline" onClick={fetchEntries}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">No shiva notices found</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="text-sm text-gray-500 mb-2">
            Showing {entries.length} of {pagination.totalCount} entries
          </div>

          <div className="space-y-3">
            {entries.map((entry) => {
              const mourners = Array.isArray(entry.mournerNames)
                ? entry.mournerNames.filter((n) => n)
                : [];

              return (
                <Card key={entry.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusBadge(entry)}
                          <span className="text-xs text-gray-400">#{entry.id}</span>
                        </div>

                        <div className="space-y-1">
                          <p className="font-medium text-lg">{entry.niftarName}</p>
                          {entry.niftarNameHebrew && (
                            <p className="text-gray-600" dir="rtl">{entry.niftarNameHebrew}</p>
                          )}
                          {mourners.length > 0 && (
                            <p className="text-sm text-gray-500">
                              Mourners: {mourners.join(", ")}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(entry.shivaStart)} - {formatDate(entry.shivaEnd)}
                          </span>
                          {entry.shivaAddress && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {entry.shivaAddress}
                            </span>
                          )}
                          {entry.shivaHours && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {entry.shivaHours}
                            </span>
                          )}
                          {entry.contactPhone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-4 w-4" />
                              {entry.contactPhone}
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-gray-400 mt-2">
                          Created: {new Date(entry.createdAt).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {entry.approvalStatus === "pending" && (
                          <Button
                            size="sm"
                            onClick={() => handleQuickApprove(entry)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Approve
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(entry)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteEntry(entry)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-600">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page >= pagination.totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editEntry} onOpenChange={() => setEditEntry(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Shiva Notice</DialogTitle>
            <DialogDescription>Update the details for this shiva notice</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="niftarName">Name of Niftar *</Label>
              <Input
                id="niftarName"
                value={editForm.niftarName}
                onChange={(e) => setEditForm({ ...editForm, niftarName: e.target.value })}
                placeholder="Enter name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="niftarNameHebrew">Hebrew Name</Label>
              <Input
                id="niftarNameHebrew"
                value={editForm.niftarNameHebrew}
                onChange={(e) => setEditForm({ ...editForm, niftarNameHebrew: e.target.value })}
                dir="rtl"
                placeholder="שם בעברית"
              />
            </div>

            <div className="space-y-2">
              <Label>Mourners</Label>
              <div className="space-y-2">
                {editForm.mourners.map((mourner, index) => (
                  <div key={mourner.id} className="flex gap-2">
                    <Input
                      value={mourner.name}
                      onChange={(e) => updateMourner(mourner.id, e.target.value)}
                      placeholder={`Mourner ${index + 1}`}
                    />
                    {editForm.mourners.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMourner(mourner.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMourner}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Mourner
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="shivaAddress">Shiva Address</Label>
              <Input
                id="shivaAddress"
                value={editForm.shivaAddress}
                onChange={(e) => setEditForm({ ...editForm, shivaAddress: e.target.value })}
                placeholder="Enter address"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shivaStart">Start Date</Label>
                <Input
                  id="shivaStart"
                  type="date"
                  value={editForm.shivaStart}
                  onChange={(e) => setEditForm({ ...editForm, shivaStart: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shivaEnd">End Date</Label>
                <Input
                  id="shivaEnd"
                  type="date"
                  value={editForm.shivaEnd}
                  onChange={(e) => setEditForm({ ...editForm, shivaEnd: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="shivaHours">Visiting Hours</Label>
              <Input
                id="shivaHours"
                value={editForm.shivaHours}
                onChange={(e) => setEditForm({ ...editForm, shivaHours: e.target.value })}
                placeholder="e.g., 10am-12pm, 3pm-9pm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input
                id="contactPhone"
                value={editForm.contactPhone}
                onChange={(e) => setEditForm({ ...editForm, contactPhone: e.target.value })}
                placeholder="(416) 555-0000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mealInfo">Meal Information</Label>
              <Textarea
                id="mealInfo"
                value={editForm.mealInfo}
                onChange={(e) => setEditForm({ ...editForm, mealInfo: e.target.value })}
                placeholder="Information about meals"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="donationInfo">Donation Information</Label>
              <Textarea
                id="donationInfo"
                value={editForm.donationInfo}
                onChange={(e) => setEditForm({ ...editForm, donationInfo: e.target.value })}
                placeholder="Charity or memorial fund"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="approvalStatus">Status</Label>
              <Select
                value={editForm.approvalStatus}
                onValueChange={(v: "pending" | "approved" | "rejected") =>
                  setEditForm({ ...editForm, approvalStatus: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEntry(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteEntry} onOpenChange={() => setDeleteEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shiva Notice?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the shiva notice for "{deleteEntry?.niftarName}". This action cannot be undone.
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
