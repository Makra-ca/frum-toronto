"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, X, Pencil, Trash2, Eye, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { SpecialForm } from "@/components/admin/SpecialForm";

interface Special {
  id: number;
  title: string;
  description: string | null;
  fileUrl: string;
  fileType: string;
  startDate: string;
  endDate: string;
  approvalStatus: string;
  isActive: boolean;
  viewCount: number;
  createdAt: string;
  businessId: number | null;
  businessName: string | null;
  userId: number | null;
  userEmail: string | null;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusBadge(status: string) {
  switch (status) {
    case "approved":
      return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
    case "rejected":
      return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
    default:
      return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
  }
}

export default function AdminSpecialsPage() {
  const [specials, setSpecials] = useState<Special[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingSpecial, setEditingSpecial] = useState<Special | null>(null);
  const [deletingSpecial, setDeletingSpecial] = useState<Special | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [totalCount, setTotalCount] = useState(0);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function fetchSpecials() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", statusFilter);
      if (debouncedSearch) {
        params.set("search", debouncedSearch);
      }

      const response = await fetch(`/api/admin/specials?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setSpecials(data.specials);
        setTotalCount(data.pagination.totalCount);
      }
    } catch (error) {
      console.error("Error fetching specials:", error);
      toast.error("Failed to fetch specials");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSpecials();
  }, [statusFilter, debouncedSearch]);

  async function handleSubmit(data: {
    businessId: number;
    title: string;
    description?: string | null;
    fileUrl: string;
    fileType: "pdf" | "png" | "jpg" | "jpeg";
    startDate: string;
    endDate: string;
    approvalStatus?: "pending" | "approved" | "rejected";
    isActive?: boolean;
  }) {
    setIsSubmitting(true);
    try {
      const url = editingSpecial
        ? `/api/admin/specials/${editingSpecial.id}`
        : "/api/admin/specials";
      const method = editingSpecial ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save special");
      }

      toast.success(
        editingSpecial ? "Special updated successfully" : "Special created successfully"
      );

      setIsDialogOpen(false);
      setEditingSpecial(null);
      fetchSpecials();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save special"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deletingSpecial) return;

    try {
      const response = await fetch(`/api/admin/specials/${deletingSpecial.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete special");
      }

      toast.success("Special deleted successfully");

      setIsDeleteDialogOpen(false);
      setDeletingSpecial(null);
      fetchSpecials();
    } catch (error) {
      toast.error("Failed to delete special");
    }
  }

  async function handleApprove(special: Special) {
    try {
      const response = await fetch(`/api/admin/specials/${special.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...special,
          approvalStatus: "approved",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to approve special");
      }

      toast.success("Special approved");
      fetchSpecials();
    } catch (error) {
      toast.error("Failed to approve special");
    }
  }

  async function handleReject(special: Special) {
    try {
      const response = await fetch(`/api/admin/specials/${special.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...special,
          approvalStatus: "rejected",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to reject special");
      }

      toast.success("Special rejected");
      fetchSpecials();
    } catch (error) {
      toast.error("Failed to reject special");
    }
  }

  function handleEdit(special: Special) {
    setEditingSpecial(special);
    setIsDialogOpen(true);
  }

  function handleDeleteClick(special: Special) {
    setDeletingSpecial(special);
    setIsDeleteDialogOpen(true);
  }

  function handleDialogClose() {
    setIsDialogOpen(false);
    setEditingSpecial(null);
  }

  if (loading && specials.length === 0) {
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
          <h1 className="text-2xl font-bold">Specials & Deals</h1>
          <p className="text-gray-500">Manage business flyers and weekly specials</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Special
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search specials or businesses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="ml-auto text-sm text-gray-500">
            {totalCount} {totalCount === 1 ? "special" : "specials"}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Preview</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Business</TableHead>
              <TableHead>Valid Dates</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {specials.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  No specials found
                </TableCell>
              </TableRow>
            ) : (
              specials.map((special) => (
                <TableRow key={special.id}>
                  <TableCell>
                    <div className="w-12 h-12 bg-gray-100 rounded overflow-hidden relative">
                      {special.fileType === "pdf" ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileText className="h-6 w-6 text-red-500" />
                        </div>
                      ) : (
                        <Image
                          src={special.fileUrl}
                          alt={special.title}
                          fill
                          className="object-cover"
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{special.title}</p>
                      {special.userEmail && (
                        <p className="text-xs text-gray-400">by {special.userEmail}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{special.businessName || "-"}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {formatDate(special.startDate)} - {formatDate(special.endDate)}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(special.approvalStatus)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => window.open(special.fileUrl, "_blank")}
                        title="View File"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      {special.approvalStatus === "pending" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleApprove(special)}
                            className="text-green-600 hover:text-green-700"
                          >
                            Approve
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReject(special)}
                            className="text-red-600 hover:text-red-700"
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(special)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(special)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSpecial ? "Edit Special" : "Add New Special"}
            </DialogTitle>
          </DialogHeader>
          <SpecialForm
            initialData={editingSpecial || undefined}
            onSubmit={handleSubmit}
            onCancel={handleDialogClose}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Special</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingSpecial?.title}&quot;?
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
