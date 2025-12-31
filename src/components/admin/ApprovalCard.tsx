"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2 } from "lucide-react";

interface ApprovalCardProps {
  id: number;
  title: string;
  subtitle?: string;
  description?: string;
  type: "business" | "simcha" | "classified" | "event" | "tehillim";
  status: string;
  createdAt?: Date | null;
  onApprove: (id: number) => Promise<void>;
  onReject: (id: number) => Promise<void>;
}

export function ApprovalCard({
  id,
  title,
  subtitle,
  description,
  type,
  status,
  createdAt,
  onApprove,
  onReject,
}: ApprovalCardProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await onApprove(id);
      setCurrentStatus("approved");
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      await onReject(id);
      setCurrentStatus("rejected");
    } finally {
      setIsRejecting(false);
    }
  };

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-lg">{title}</CardTitle>
            {subtitle && (
              <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
          <Badge className={statusColors[currentStatus] || statusColors.pending}>
            {currentStatus}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {description && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-2">{description}</p>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {createdAt ? new Date(createdAt).toLocaleDateString() : "N/A"}
          </span>

          {currentStatus === "pending" && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleReject}
                disabled={isApproving || isRejecting}
                className="text-red-600 hover:bg-red-50"
              >
                {isRejecting ? (
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
                onClick={handleApprove}
                disabled={isApproving || isRejecting}
                className="bg-green-600 hover:bg-green-700"
              >
                {isApproving ? (
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
  );
}
