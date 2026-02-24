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
  Send,
  Check,
  X,
  AlertTriangle,
  ShieldAlert,
  Package,
  Calendar,
  User,
} from "lucide-react";
import { toast } from "sonner";

interface KosherAlert {
  id: number;
  userId: number | null;
  productName: string;
  brand: string | null;
  alertType: string | null;
  description: string;
  certifyingAgency: string | null;
  effectiveDate: string | null;
  issueDate: string | null;
  approvalStatus: string | null;
  isActive: boolean | null;
  createdAt: string;
  submittedByEmail: string | null;
  submittedByName: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

const ALERT_TYPES = [
  { value: "recall", label: "Recall", color: "bg-red-100 text-red-800" },
  { value: "status_change", label: "Status Change", color: "bg-yellow-100 text-yellow-800" },
  { value: "warning", label: "Warning", color: "bg-orange-100 text-orange-800" },
  { value: "update", label: "Update", color: "bg-blue-100 text-blue-800" },
];

const CERTIFYING_AGENCIES = [
  { value: "COR", label: "COR (Kashruth Council of Canada)" },
  { value: "OU", label: "OU (Orthodox Union)" },
  { value: "OK", label: "OK Kosher" },
  { value: "Star-K", label: "Star-K" },
  { value: "Kof-K", label: "Kof-K" },
  { value: "cRc", label: "cRc (Chicago Rabbinical Council)" },
  { value: "MK", label: "MK (Montreal Kosher)" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  { value: "approved", label: "Approved", color: "bg-green-100 text-green-800" },
  { value: "rejected", label: "Rejected", color: "bg-red-100 text-red-800" },
];

export default function KosherAlertsManagementPage() {
  const [entries, setEntries] = useState<KosherAlert[]>([]);
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
  const [alertTypeFilter, setAlertTypeFilter] = useState("all");

  // Create/Edit dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<KosherAlert | null>(null);
  const [form, setForm] = useState({
    productName: "",
    brand: "",
    alertType: "recall",
    description: "",
    certifyingAgency: "",
    customAgency: "",
    effectiveDate: "",
    issueDate: "",
    approvalStatus: "approved",
    isActive: true,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Delete dialog
  const [deleteAlert, setDeleteAlert] = useState<KosherAlert | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchAlerts();
  }, [pagination.page, statusFilter, alertTypeFilter]);

  const fetchAlerts = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        status: statusFilter,
        alertType: alertTypeFilter,
        search: search,
      });

      const res = await fetch(`/api/admin/kosher-alerts?${params}`);
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
      console.error("Error fetching kosher alerts:", error);
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
      productName: "",
      brand: "",
      alertType: "recall",
      description: "",
      certifyingAgency: "",
      customAgency: "",
      effectiveDate: "",
      issueDate: "",
      approvalStatus: "approved",
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (alert: KosherAlert) => {
    setEditingAlert(alert);
    const isCustomAgency = alert.certifyingAgency &&
      !CERTIFYING_AGENCIES.some(a => a.value === alert.certifyingAgency);

    setForm({
      productName: alert.productName || "",
      brand: alert.brand || "",
      alertType: alert.alertType || "recall",
      description: alert.description || "",
      certifyingAgency: isCustomAgency ? "other" : (alert.certifyingAgency || ""),
      customAgency: isCustomAgency ? (alert.certifyingAgency || "") : "",
      effectiveDate: alert.effectiveDate || "",
      issueDate: alert.issueDate || "",
      approvalStatus: alert.approvalStatus || "approved",
      isActive: alert.isActive ?? true,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async (sendNotification: boolean) => {
    if (!form.productName.trim()) {
      toast.error("Product name is required");
      return;
    }
    if (!form.description.trim()) {
      toast.error("Description is required");
      return;
    }

    setIsSaving(true);
    try {
      const url = editingAlert
        ? `/api/admin/kosher-alerts/${editingAlert.id}`
        : "/api/admin/kosher-alerts";

      const certifyingAgency = form.certifyingAgency === "other"
        ? form.customAgency
        : form.certifyingAgency;

      const res = await fetch(url, {
        method: editingAlert ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          certifyingAgency: certifyingAgency || null,
          effectiveDate: form.effectiveDate || null,
          issueDate: form.issueDate || null,
          sendNotification: sendNotification,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        if (sendNotification && data.notificationsSent) {
          toast.success(`Alert saved and sent to ${data.notificationsSent} subscribers`);
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

  const handleQuickApprove = async (alert: KosherAlert) => {
    try {
      const res = await fetch(`/api/admin/kosher-alerts/${alert.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalStatus: "approved" }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.notificationsSent) {
          toast.success(`Alert approved and sent to ${data.notificationsSent} subscribers`);
        } else {
          toast.success("Alert approved");
        }
        fetchAlerts();
      } else {
        toast.error("Failed to approve alert");
      }
    } catch (error) {
      toast.error("Failed to approve alert");
    }
  };

  const handleQuickReject = async (alert: KosherAlert) => {
    try {
      const res = await fetch(`/api/admin/kosher-alerts/${alert.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalStatus: "rejected" }),
      });

      if (res.ok) {
        toast.success("Alert rejected");
        fetchAlerts();
      } else {
        toast.error("Failed to reject alert");
      }
    } catch (error) {
      toast.error("Failed to reject alert");
    }
  };

  const handleDelete = async () => {
    if (!deleteAlert) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/kosher-alerts/${deleteAlert.id}`, {
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

  const getAlertTypeBadge = (type: string | null) => {
    const opt = ALERT_TYPES.find((t) => t.value === type);
    if (!opt) return <Badge variant="secondary">{type || "Unknown"}</Badge>;
    return <Badge className={opt.color}>{opt.label}</Badge>;
  };

  const getStatusBadge = (status: string | null) => {
    const opt = STATUS_OPTIONS.find((s) => s.value === status);
    if (!opt) return <Badge variant="secondary">{status || "Unknown"}</Badge>;
    return <Badge className={opt.color}>{opt.label}</Badge>;
  };

  const pendingCount = entries.filter(e => e.approvalStatus === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kosher Alerts</h1>
          <p className="text-gray-600 text-sm">
            Manage kosher product alerts and user submissions
            {pendingCount > 0 && (
              <Badge className="ml-2 bg-yellow-100 text-yellow-800">
                {pendingCount} pending review
              </Badge>
            )}
          </p>
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
                  placeholder="Search by product, brand, or description..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="w-[150px]">
              <Label htmlFor="status">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[150px]">
              <Label htmlFor="alertType">Alert Type</Label>
              <Select
                value={alertTypeFilter}
                onValueChange={(v) => {
                  setAlertTypeFilter(v);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {ALERT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
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
            <ShieldAlert className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No kosher alerts found</p>
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
              <Card key={alert.id} className={`hover:shadow-md transition-shadow ${
                alert.approvalStatus === "pending" ? "border-yellow-300 bg-yellow-50/30" : ""
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-3">
                      <AlertTriangle className={`h-5 w-5 mt-1 ${
                        alert.alertType === "recall" ? "text-red-500" :
                        alert.alertType === "warning" ? "text-orange-500" :
                        "text-blue-500"
                      }`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {getStatusBadge(alert.approvalStatus)}
                          {getAlertTypeBadge(alert.alertType)}
                          {!alert.isActive && (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                          <span className="text-xs text-gray-400">#{alert.id}</span>
                        </div>

                        <h3 className="font-semibold text-lg">{alert.productName}</h3>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-600">
                          {alert.brand && (
                            <span className="flex items-center gap-1">
                              <Package className="h-3 w-3" />
                              {alert.brand}
                            </span>
                          )}
                          {alert.certifyingAgency && (
                            <span>Agency: {alert.certifyingAgency}</span>
                          )}
                          {alert.effectiveDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Effective: {alert.effectiveDate}
                            </span>
                          )}
                        </div>

                        <p className="text-gray-600 text-sm mt-2 line-clamp-2">
                          {alert.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-500">
                          <span>Created: {new Date(alert.createdAt).toLocaleDateString()}</span>
                          {alert.submittedByName && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              Submitted by: {alert.submittedByName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {alert.approvalStatus === "pending" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleQuickApprove(alert)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleQuickReject(alert)}
                            className="text-red-600 border-red-200 hover:bg-red-50"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
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
            <DialogTitle>{editingAlert ? "Edit Kosher Alert" : "Create Kosher Alert"}</DialogTitle>
            <DialogDescription>
              {editingAlert
                ? "Update the details for this kosher alert"
                : "Create a new kosher product alert"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="productName">Product Name *</Label>
              <Input
                id="productName"
                value={form.productName}
                onChange={(e) => setForm({ ...form, productName: e.target.value })}
                placeholder="Enter product name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brand">Brand</Label>
                <Input
                  id="brand"
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  placeholder="Enter brand name"
                />
              </div>

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
            </div>

            <div className="space-y-2">
              <Label htmlFor="certifyingAgency">Certifying Agency</Label>
              <Select
                value={form.certifyingAgency}
                onValueChange={(v) => setForm({ ...form, certifyingAgency: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select agency" />
                </SelectTrigger>
                <SelectContent>
                  {CERTIFYING_AGENCIES.map((agency) => (
                    <SelectItem key={agency.value} value={agency.value}>
                      {agency.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.certifyingAgency === "other" && (
                <Input
                  value={form.customAgency}
                  onChange={(e) => setForm({ ...form, customAgency: e.target.value })}
                  placeholder="Enter agency name"
                  className="mt-2"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe the kosher alert..."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="effectiveDate">Effective Date</Label>
                <Input
                  id="effectiveDate"
                  type="date"
                  value={form.effectiveDate}
                  onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="issueDate">Issue Date</Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={form.issueDate}
                  onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
                />
              </div>
            </div>

            {editingAlert && (
              <div className="space-y-2">
                <Label htmlFor="approvalStatus">Status</Label>
                <Select
                  value={form.approvalStatus}
                  onValueChange={(v) => setForm({ ...form, approvalStatus: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch
                id="isActive"
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
              />
              <Label htmlFor="isActive">Active</Label>
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
            <Button onClick={() => handleSave(true)} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Save & Notify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteAlert} onOpenChange={() => setDeleteAlert(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Kosher Alert?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the alert for &quot;{deleteAlert?.productName}&quot;.
              This action cannot be undone.
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
