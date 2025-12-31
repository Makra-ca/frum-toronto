"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2, MapPin, Phone, Mail, Tag } from "lucide-react";

interface Business {
  id: number;
  name: string;
  description: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  approvalStatus: string | null;
  createdAt: Date | null;
  categoryName: string | null;
  ownerEmail: string | null;
  ownerName: string | null;
}

interface BusinessApprovalListProps {
  businesses: Business[];
}

export function BusinessApprovalList({ businesses: initialBusinesses }: BusinessApprovalListProps) {
  const [businesses, setBusinesses] = useState(initialBusinesses);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [loadingAction, setLoadingAction] = useState<"approve" | "reject" | null>(null);

  const handleAction = async (id: number, action: "approve" | "reject") => {
    setLoadingId(id);
    setLoadingAction(action);

    try {
      const response = await fetch(`/api/admin/businesses/${id}/${action}`, {
        method: "POST",
      });

      if (response.ok) {
        setBusinesses((prev) =>
          prev.map((b) =>
            b.id === id ? { ...b, approvalStatus: action === "approve" ? "approved" : "rejected" } : b
          )
        );
      }
    } catch (error) {
      console.error("Failed to update business:", error);
    } finally {
      setLoadingId(null);
      setLoadingAction(null);
    }
  };

  return (
    <div className="grid gap-4">
      {businesses.map((business) => (
        <Card key={business.id} className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <CardTitle className="text-xl">{business.name}</CardTitle>
                <div className="flex flex-wrap gap-2 mt-2">
                  {business.categoryName && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {business.categoryName}
                    </Badge>
                  )}
                  {business.ownerEmail && (
                    <span className="text-sm text-gray-500">
                      by {business.ownerName || business.ownerEmail}
                    </span>
                  )}
                </div>
              </div>
              <Badge
                className={
                  business.approvalStatus === "approved"
                    ? "bg-green-100 text-green-800"
                    : business.approvalStatus === "rejected"
                    ? "bg-red-100 text-red-800"
                    : "bg-yellow-100 text-yellow-800"
                }
              >
                {business.approvalStatus}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {business.description && (
              <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                {business.description}
              </p>
            )}

            <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-4">
              {business.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {business.address}
                </span>
              )}
              {business.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  {business.phone}
                </span>
              )}
              {business.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  {business.email}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <span className="text-xs text-gray-400">
                Submitted: {business.createdAt ? new Date(business.createdAt).toLocaleDateString() : "N/A"}
              </span>

              {business.approvalStatus === "pending" && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(business.id, "reject")}
                    disabled={loadingId === business.id}
                    className="text-red-600 hover:bg-red-50"
                  >
                    {loadingId === business.id && loadingAction === "reject" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleAction(business.id, "approve")}
                    disabled={loadingId === business.id}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {loadingId === business.id && loadingAction === "approve" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
