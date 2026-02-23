"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Clock,
  Infinity,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface TehillimEntry {
  id: number;
  hebrewName: string | null;
  englishName: string | null;
  motherHebrewName: string | null;
  reason: string | null;
  approvalStatus: string;
  expiresAt: string | null;
  isPermanent: boolean | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export default function TehillimManagementPage() {
  const [entries, setEntries] = useState<TehillimEntry[]>([]);
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
  const [editEntry, setEditEntry] = useState<TehillimEntry | null>(null);
  const [editForm, setEditForm] = useState({
    hebrewName: "",
    englishName: "",
    motherHebrewName: "",
    reason: "",
    expiresAt: "",
    isPermanent: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Delete dialog
  const [deleteEntry, setDeleteEntry] = useState<TehillimEntry | null>(null);
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

      const res = await fetch(`/api/admin/tehillim?${params}`);
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
      console.error("Error fetching tehillim:", error);
      toast.error("Failed to load entries");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchEntries();
  };

  const openEditDialog = (entry: TehillimEntry) => {
    setEditEntry(entry);
    setEditForm({
      hebrewName: entry.hebrewName || "",
      englishName: entry.englishName || "",
      motherHebrewName: entry.motherHebrewName || "",
      reason: entry.reason || "",
      expiresAt: entry.expiresAt || "",
      isPermanent: entry.isPermanent || false,
    });
  };

  const handleSave = async () => {
    if (!editEntry) return;

    if (!editForm.hebrewName.trim() && !editForm.englishName.trim()) {
      toast.error("Either Hebrew or English name is required");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/tehillim/${editEntry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
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
      const res = await fetch(`/api/admin/tehillim/${deleteEntry.id}`, {
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

  const getStatusBadge = (entry: TehillimEntry) => {
    const today = new Date().toISOString().split("T")[0];
    const isExpired = entry.expiresAt && entry.expiresAt <= today && !entry.isPermanent;

    if (isExpired) {
      return <Badge variant="secondary">Expired</Badge>;
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

  return (
    <div className="space-y-6">
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
                  placeholder="Search by name..."
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
            <p className="text-gray-500">No tehillim entries found</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="text-sm text-gray-500 mb-2">
            Showing {entries.length} of {pagination.totalCount} entries
          </div>

          <div className="space-y-3">
            {entries.map((entry) => (
              <Card key={entry.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusBadge(entry)}
                        {entry.isPermanent && (
                          <Badge variant="outline" className="gap-1">
                            <Infinity className="h-3 w-3" />
                            Permanent
                          </Badge>
                        )}
                        <span className="text-xs text-gray-400">#{entry.id}</span>
                      </div>

                      <div className="space-y-1">
                        {entry.hebrewName && (
                          <p className="font-medium text-lg" dir="rtl">{entry.hebrewName}</p>
                        )}
                        {entry.englishName && (
                          <p className="text-gray-700">{entry.englishName}</p>
                        )}
                        {entry.motherHebrewName && (
                          <p className="text-sm text-gray-500">ben/bat {entry.motherHebrewName}</p>
                        )}
                        {entry.reason && (
                          <p className="text-sm text-gray-500">Reason: {entry.reason}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                        <span>Created: {new Date(entry.createdAt).toLocaleDateString()}</span>
                        {entry.expiresAt && !entry.isPermanent && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Expires: {new Date(entry.expiresAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
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
            ))}
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Tehillim Entry</DialogTitle>
            <DialogDescription>Update the details for this entry</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="hebrewName">Hebrew Name</Label>
              <Input
                id="hebrewName"
                value={editForm.hebrewName}
                onChange={(e) => setEditForm({ ...editForm, hebrewName: e.target.value })}
                dir="rtl"
                placeholder="e.g., יעקב בן שרה"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="englishName">English Name</Label>
              <Input
                id="englishName"
                value={editForm.englishName}
                onChange={(e) => setEditForm({ ...editForm, englishName: e.target.value })}
                placeholder="e.g., Jacob son of Sarah"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="motherHebrewName">Mother's Hebrew Name</Label>
              <Input
                id="motherHebrewName"
                value={editForm.motherHebrewName}
                onChange={(e) => setEditForm({ ...editForm, motherHebrewName: e.target.value })}
                dir="rtl"
                placeholder="e.g., שרה"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Input
                id="reason"
                value={editForm.reason}
                onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                placeholder="e.g., Refuah Shleima"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiresAt">Expiration Date</Label>
              <Input
                id="expiresAt"
                type="date"
                value={editForm.expiresAt}
                onChange={(e) => setEditForm({ ...editForm, expiresAt: e.target.value })}
                disabled={editForm.isPermanent}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPermanent"
                checked={editForm.isPermanent}
                onChange={(e) => setEditForm({ ...editForm, isPermanent: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="isPermanent" className="flex items-center gap-1 cursor-pointer">
                <Infinity className="h-4 w-4" />
                Make Permanent (no expiration)
              </Label>
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
            <AlertDialogTitle>Delete Tehillim Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{deleteEntry?.hebrewName || deleteEntry?.englishName}" from the Tehillim list. This action cannot be undone.
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
