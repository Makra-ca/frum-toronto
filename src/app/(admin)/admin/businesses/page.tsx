"use client";

import { useState, useEffect, useMemo } from "react";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BusinessForm } from "@/components/admin/BusinessForm";
import { BusinessTable } from "@/components/admin/BusinessTable";
import { Plus, Search, X, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface BusinessHours {
  sunday?: { open: string; close: string } | null;
  monday?: { open: string; close: string } | null;
  tuesday?: { open: string; close: string } | null;
  wednesday?: { open: string; close: string } | null;
  thursday?: { open: string; close: string } | null;
  friday?: { open: string; close: string } | null;
  saturday?: { open: string; close: string } | null;
}

interface Business {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  hours: BusinessHours | null;
  isKosher: boolean | null;
  kosherCertification: string | null;
  approvalStatus: string | null;
  isFeatured: boolean | null;
  displayOrder: number | null;
  isActive: boolean | null;
  createdAt: Date | string | null;
  categoryId: number | null;
  categoryName: string | null;
  parentCategoryId: number | null;
  ownerEmail: string | null;
  ownerName: string | null;
}

interface Category {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  children?: Category[];
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}

const ITEMS_PER_PAGE = 50;

export default function AdminBusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [deletingBusiness, setDeletingBusiness] = useState<Business | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: ITEMS_PER_PAGE,
    totalCount: 0,
    totalPages: 0,
    hasMore: false,
  });

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function fetchCategories() {
    try {
      const response = await fetch("/api/admin/business-categories");
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  }

  async function fetchBusinesses(page = currentPage) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", statusFilter);
      params.set("page", page.toString());
      params.set("limit", ITEMS_PER_PAGE.toString());
      if (categoryFilter !== "all") {
        params.set("categoryId", categoryFilter);
      }
      if (debouncedSearch) {
        params.set("search", debouncedSearch);
      }

      const response = await fetch(`/api/admin/businesses?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setBusinesses(data.businesses);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error fetching businesses:", error);
      toast.error("Failed to fetch businesses");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCategories();
  }, []);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
    fetchBusinesses(1);
  }, [statusFilter, categoryFilter, debouncedSearch]);

  // Fetch when page changes (but not on filter change - that's handled above)
  useEffect(() => {
    if (currentPage > 1) {
      fetchBusinesses(currentPage);
    }
  }, [currentPage]);

  async function handleSubmit(data: {
    name: string;
    categoryId: number | null;
    description: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    address: string | null;
    city: string;
    postalCode: string | null;
    isKosher: boolean;
    kosherCertification: string | null;
    isFeatured: boolean;
    hours: BusinessHours | null;
  }) {
    setIsSubmitting(true);
    try {
      const url = editingBusiness
        ? `/api/admin/businesses/${editingBusiness.id}`
        : "/api/admin/businesses";
      const method = editingBusiness ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save business");
      }

      toast.success(
        editingBusiness
          ? "Business updated successfully"
          : "Business created successfully"
      );

      setIsDialogOpen(false);
      setEditingBusiness(null);
      fetchBusinesses();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save business"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deletingBusiness) return;

    try {
      const response = await fetch(
        `/api/admin/businesses/${deletingBusiness.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete business");
      }

      toast.success("Business deleted successfully");

      setIsDeleteDialogOpen(false);
      setDeletingBusiness(null);
      fetchBusinesses();
    } catch (error) {
      toast.error("Failed to delete business");
    }
  }

  async function handleApprove(id: number) {
    try {
      const response = await fetch(`/api/admin/businesses/${id}/approve`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to approve business");
      }

      toast.success("Business approved");
      fetchBusinesses();
    } catch (error) {
      toast.error("Failed to approve business");
    }
  }

  async function handleReject(id: number) {
    try {
      const response = await fetch(`/api/admin/businesses/${id}/reject`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to reject business");
      }

      toast.success("Business rejected");
      fetchBusinesses();
    } catch (error) {
      toast.error("Failed to reject business");
    }
  }

  async function handleReorder(businessId: number, direction: "up" | "down") {
    try {
      const response = await fetch("/api/admin/businesses/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, direction }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to reorder business");
      }

      // Refresh the list to show new order
      await fetchBusinesses();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reorder business"
      );
    }
  }

  function handleEdit(business: Business) {
    setEditingBusiness(business);
    setIsDialogOpen(true);
  }

  function handleDeleteClick(business: Business) {
    setDeletingBusiness(business);
    setIsDeleteDialogOpen(true);
  }

  function handleDialogClose() {
    setIsDialogOpen(false);
    setEditingBusiness(null);
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

  // Show pending count from current page results (not accurate for total, but gives indication)
  const pendingOnPage = businesses.filter(
    (b) => b.approvalStatus === "pending"
  ).length;

  const hasActiveFilters = categoryFilter !== "all" || searchQuery.length > 0;

  function clearFilters() {
    setSearchQuery("");
    setCategoryFilter("all");
    setCurrentPage(1);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Business Directory</h1>
          <p className="text-gray-500">
            Manage business listings
            {statusFilter === "pending" && pagination.totalCount > 0 && (
              <span className="ml-2 text-yellow-600">
                ({pagination.totalCount} pending approval)
              </span>
            )}
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Business
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border p-4 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, email, phone, or address..."
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

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Status Tabs */}
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">
                Pending
              </TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="h-6 w-px bg-gray-200" />

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-[300px]">
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((parent) => (
                  <SelectGroup key={parent.id}>
                    <SelectLabel className="font-semibold text-gray-900">
                      {parent.name}
                    </SelectLabel>
                    {parent.children && parent.children.length > 0 ? (
                      parent.children.map((child) => (
                        <SelectItem key={child.id} value={child.id.toString()}>
                          {child.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value={parent.id.toString()}>
                        {parent.name}
                      </SelectItem>
                    )}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4 mr-1" />
              Clear filters
            </Button>
          )}

          {/* Results Count */}
          <div className="ml-auto text-sm text-gray-500">
            {pagination.totalCount > 0 ? (
              <>
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-
                {Math.min(currentPage * ITEMS_PER_PAGE, pagination.totalCount)} of{" "}
                {pagination.totalCount.toLocaleString()} businesses
              </>
            ) : (
              "0 businesses"
            )}
          </div>
        </div>
      </div>

      <BusinessTable
        businesses={businesses}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
        onApprove={handleApprove}
        onReject={handleReject}
        onReorder={handleReorder}
      />

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-4">
          <div className="text-sm text-gray-500">
            Page {currentPage} of {pagination.totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1 || loading}
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            {/* Page number buttons */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                let pageNum: number;
                if (pagination.totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= pagination.totalPages - 2) {
                  pageNum = pagination.totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    className="w-9"
                    onClick={() => setCurrentPage(pageNum)}
                    disabled={loading}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={currentPage === pagination.totalPages || loading}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(pagination.totalPages)}
              disabled={currentPage === pagination.totalPages || loading}
            >
              Last
            </Button>
          </div>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBusiness ? "Edit Business" : "Add New Business"}
            </DialogTitle>
          </DialogHeader>
          <BusinessForm
            initialData={editingBusiness || undefined}
            onSubmit={handleSubmit}
            onCancel={handleDialogClose}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Business</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingBusiness?.name}&quot;?
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
