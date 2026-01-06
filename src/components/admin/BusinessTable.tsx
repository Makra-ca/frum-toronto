"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, MapPin, Check, X, Loader2 } from "lucide-react";
import { ReorderButtons } from "./ReorderButtons";

interface BusinessHours {
  sunday?: { open: string; close: string } | null;
  monday?: { open: string; close: string } | null;
  tuesday?: { open: string; close: string } | null;
  wednesday?: { open: string; close: string } | null;
  thursday?: { open: string; close: string } | null;
  friday?: { open: string; close: string } | null;
  saturday?: { open: string; close: string } | null;
}

export interface Business {
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

interface BusinessTableProps {
  businesses: Business[];
  onEdit: (business: Business) => void;
  onDelete: (business: Business) => void;
  onApprove: (id: number) => Promise<void>;
  onReject: (id: number) => Promise<void>;
  onReorder?: (businessId: number, direction: "up" | "down") => Promise<void>;
}

function formatDate(date: Date | string | null): string {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusBadge(status: string | null) {
  switch (status) {
    case "approved":
      return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
    case "pending":
      return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
    case "rejected":
      return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export function BusinessTable({
  businesses,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  onReorder,
}: BusinessTableProps) {
  const [loadingApprove, setLoadingApprove] = useState<number | null>(null);
  const [loadingReject, setLoadingReject] = useState<number | null>(null);
  const [reorderingId, setReorderingId] = useState<number | null>(null);

  async function handleApprove(id: number) {
    setLoadingApprove(id);
    try {
      await onApprove(id);
    } finally {
      setLoadingApprove(null);
    }
  }

  async function handleReject(id: number) {
    setLoadingReject(id);
    try {
      await onReject(id);
    } finally {
      setLoadingReject(null);
    }
  }

  async function handleReorder(id: number, direction: "up" | "down") {
    if (!onReorder) return;
    setReorderingId(id);
    try {
      await onReorder(id, direction);
    } finally {
      setReorderingId(null);
    }
  }

  if (businesses.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-500">
          No businesses found. Create your first business listing to get started.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              {onReorder && <TableHead className="w-[60px]">Order</TableHead>}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {businesses.map((business) => (
              <TableRow key={business.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{business.name}</p>
                    {business.ownerEmail && (
                      <p className="text-sm text-gray-500">{business.ownerEmail}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {business.categoryName ? (
                    <Badge variant="secondary">{business.categoryName}</Badge>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {business.city ? (
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <MapPin className="h-3 w-3" />
                      <span>{business.city}</span>
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(business.approvalStatus)}
                    {business.isFeatured && (
                      <Badge className="bg-blue-100 text-blue-800">Featured</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-gray-500">
                  {formatDate(business.createdAt)}
                </TableCell>
                {onReorder && (
                  <TableCell>
                    <ReorderButtons
                      onMoveUp={() => handleReorder(business.id, "up")}
                      onMoveDown={() => handleReorder(business.id, "down")}
                      canMoveUp={businesses.indexOf(business) > 0}
                      canMoveDown={businesses.indexOf(business) < businesses.length - 1}
                      isLoading={reorderingId === business.id}
                    />
                  </TableCell>
                )}
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {business.approvalStatus === "pending" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => handleApprove(business.id)}
                          disabled={loadingApprove === business.id}
                        >
                          {loadingApprove === business.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleReject(business.id)}
                          disabled={loadingReject === business.id}
                        >
                          {loadingReject === business.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(business)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => onDelete(business)}
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

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {businesses.map((business) => (
          <div
            key={business.id}
            className="bg-white rounded-lg shadow p-4"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-medium text-gray-900">{business.name}</p>
                {business.ownerEmail && (
                  <p className="text-sm text-gray-500">{business.ownerEmail}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                {getStatusBadge(business.approvalStatus)}
                {business.isFeatured && (
                  <Badge className="bg-blue-100 text-blue-800">Featured</Badge>
                )}
              </div>
            </div>

            <div className="space-y-2 text-sm mb-4">
              {business.categoryName && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Category:</span>
                  <Badge variant="secondary">{business.categoryName}</Badge>
                </div>
              )}

              {business.city && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">{business.city}</span>
                </div>
              )}

              <div className="text-gray-500">
                Created: {formatDate(business.createdAt)}
              </div>
            </div>

            <div className="flex gap-2 flex-wrap items-center">
              {onReorder && (
                <ReorderButtons
                  onMoveUp={() => handleReorder(business.id, "up")}
                  onMoveDown={() => handleReorder(business.id, "down")}
                  canMoveUp={businesses.indexOf(business) > 0}
                  canMoveDown={businesses.indexOf(business) < businesses.length - 1}
                  isLoading={reorderingId === business.id}
                />
              )}
              {business.approvalStatus === "pending" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => handleApprove(business.id)}
                    disabled={loadingApprove === business.id}
                  >
                    {loadingApprove === business.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Check className="h-4 w-4 mr-1" />
                    )}
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleReject(business.id)}
                    disabled={loadingReject === business.id}
                  >
                    {loadingReject === business.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <X className="h-4 w-4 mr-1" />
                    )}
                    Reject
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => onEdit(business)}
              >
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700"
                onClick={() => onDelete(business)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
