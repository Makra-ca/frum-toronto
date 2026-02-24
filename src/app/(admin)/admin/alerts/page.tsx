"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  Plus,
  Bell,
  Send,
  Pin,
  AlertTriangle,
  AlertCircle,
  Info,
} from "lucide-react";
import { toast } from "sonner";

interface Alert {
  id: number;
  userId: number | null;
  alertType: string;
  title: string;
  content: string;
  urgency: string | null;
  isPinned: boolean | null;
  expiresAt: string | null;
  isActive: boolean | null;
  createdAt: string;
  createdByEmail: string | null;
  createdByName: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

const URGENCY_OPTIONS = [
  { value: "normal", label: "Normal", color: "bg-blue-100 text-blue-800" },
  { value: "high", label: "High", color: "bg-yellow-100 text-yellow-800" },
  { value: "urgent", label: "Urgent", color: "bg-red-100 text-red-800" },
];

const ALERT_TYPES = [
  { value: "general", label: "General" },
  { value: "bulletin", label: "Bulletin" },
  { value: "announcement", label: "Announcement" },
  { value: "warning", label: "Warning" },
];

export default function AlertsManagementPage() {
  const [entries, setEntries] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    totalCount: 0,
    totalPages: 0,
  });

  // Filters
  const [search, setSearch] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("all");

  // Create/Edit dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null);
  const [form, setForm] = useState({
    alertType: "general",
    title: "",
    content: "",
    urgency: "normal",
    isPinned: false,
    expiresAt: "",
    isActive: true,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Delete dialog
  const [deleteAlert, setDeleteAlert] = useState<Alert | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchAlerts();
  }, [pagination.page, urgencyFilter]);

  const fetchAlerts = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        urgency: urgencyFilter,
        search: search,
      });

      const res = await fetch(`/api/admin/alerts?${params}`);
      const data = await res.json();

      if (res.ok) {
        setEntries(data.alerts || []);
        setPagination((prev) => ({
          ...prev,
          totalCount: data.pagination?.totalCount || 0,
          totalPages: data.pagination?.totalPages || 0,
        }));
      }
    } catch (error) {
      console.error("Error fetching alerts:", error);
      toast.error("Failed to load alerts");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchAlerts();
  };

  const openCreateDialog = () => {
    setEditingAlert(null);
    setForm({
      alertType: "general",
      title: "",
      content: "",
      urgency: "normal",
      isPinned: false,
      expiresAt: "",
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (alert: Alert) => {
    setEditingAlert(alert);
    setForm({
      alertType: alert.alertType || "general",
      title: alert.title || "",
      content: alert.content || "",
      urgency: alert.urgency || "normal",
      isPinned: alert.isPinned || false,
      expiresAt: alert.expiresAt ? alert.expiresAt.split("T")[0] : "",
      isActive: alert.isActive ?? true,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async (sendNotification: boolean) => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!form.content.trim()) {
      toast.error("Content is required");
      return;
    }

    setIsSaving(true);
    try {
      const url = editingAlert
        ? `/api/admin/alerts/${editingAlert.id}`
        : "/api/admin/alerts";

      const res = await fetch(url, {
        method: editingAlert ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          expiresAt: form.expiresAt || null,
          sendNotification: !editingAlert && sendNotification,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        if (sendNotification && !editingAlert && data.notificationsSent) {
          toast.success(`Alert created and sent to ${data.notificationsSent} subscribers`);
        } else {
          toast.success(editingAlert ? "Alert updated" : "Alert created");
        }
        setIsDialogOpen(false);
        fetchAlerts();
      } else {
        toast.error(data.error || "Failed to save alert");
      }
    } catch (error) {
      toast.error("Failed to save alert");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteAlert) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/alerts/${deleteAlert.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Alert deleted");
        setDeleteAlert(null);
        fetchAlerts();
      } else {
        toast.error("Failed to delete");
      }
    } catch (error) {
      toast.error("Failed to delete alert");
    } finally {
      setIsDeleting(false);
    }
  };

  const getUrgencyBadge = (urgency: string | null) => {
    const opt = URGENCY_OPTIONS.find((o) => o.value === urgency) || URGENCY_OPTIONS[0];
    return <Badge className={opt.color}>{opt.label}</Badge>;
  };

  const getUrgencyIcon = (urgency: string | null) => {
    switch (urgency) {
      case "urgent":
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case "high":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Community Alerts</h1>
          <p className="text-gray-600 text-sm">Manage community announcements and alerts</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          New Alert
        </Button>
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
                  placeholder="Search by title or content..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="w-[150px]">
              <Label htmlFor="urgency">Urgency</Label>
              <Select
                value={urgencyFilter}
                onValueChange={(v) => {
                  setUrgencyFilter(v);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {URGENCY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>

            <Button variant="outline" onClick={fetchAlerts}>
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
            <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No alerts found</p>
            <Button onClick={openCreateDialog} variant="outline" className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Create First Alert
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="text-sm text-gray-500 mb-2">
            Showing {entries.length} of {pagination.totalCount} alerts
          </div>

          <div className="space-y-3">
            {entries.map((alert) => (
              <Card key={alert.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-3">
                      {getUrgencyIcon(alert.urgency)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {getUrgencyBadge(alert.urgency)}
                          {alert.isPinned && (
                            <Badge variant="secondary" className="gap-1">
                              <Pin className="h-3 w-3" />
                              Pinned
                            </Badge>
                          )}
                          {!alert.isActive && (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                          <span className="text-xs text-gray-400">#{alert.id}</span>
                        </div>

                        <h3 className="font-semibold text-lg">{alert.title}</h3>
                        <p className="text-gray-600 text-sm mt-1 line-clamp-2">{alert.content}</p>

                        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-500">
                          <span>Type: {alert.alertType}</span>
                          {alert.expiresAt && (
                            <span>Expires: {new Date(alert.expiresAt).toLocaleDateString()}</span>
                          )}
                          <span>Created: {new Date(alert.createdAt).toLocaleDateString()}</span>
                          {alert.createdByName && (
                            <span>By: {alert.createdByName}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(alert)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteAlert(alert)}
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

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAlert ? "Edit Alert" : "Create Alert"}</DialogTitle>
            <DialogDescription>
              {editingAlert
                ? "Update the details for this alert"
                : "Create a new community alert"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="alertType">Alert Type</Label>
                <Select
                  value={form.alertType}
                  onValueChange={(v) => setForm({ ...form, alertType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALERT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="urgency">Urgency</Label>
                <Select
                  value={form.urgency}
                  onValueChange={(v) => setForm({ ...form, urgency: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {URGENCY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Enter alert title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content *</Label>
              <Textarea
                id="content"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Enter alert content"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiresAt">Expires At (optional)</Label>
              <Input
                id="expiresAt"
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="isPinned"
                  checked={form.isPinned}
                  onCheckedChange={(v) => setForm({ ...form, isPinned: v })}
                />
                <Label htmlFor="isPinned">Pin to top</Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="isActive"
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleSave(false)}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Save
            </Button>
            {!editingAlert && (
              <Button onClick={() => handleSave(true)} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Save & Notify
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteAlert} onOpenChange={() => setDeleteAlert(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Alert?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the alert &quot;{deleteAlert?.title}&quot;. This action
              cannot be undone.
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
