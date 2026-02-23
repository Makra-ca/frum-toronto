"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2, Infinity } from "lucide-react";

interface ApprovalCardProps {
  id: number;
  title: string;
  subtitle?: string;
  description?: string;
  type: "business" | "simcha" | "classified" | "event" | "tehillim";
  status: string;
  createdAt?: Date | null;
  expiresAt?: string | null;
  onApprove: (id: number, options?: { isPermanent?: boolean }) => Promise<void>;
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
  expiresAt,
  onApprove,
  onReject,
}: ApprovalCardProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);
  const [makePermanent, setMakePermanent] = useState(false);

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      if (type === "tehillim") {
        await onApprove(id, { isPermanent: makePermanent });
      } else {
        await onApprove(id);
      }
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

        {/* Show expiration info for tehillim */}
        {type === "tehillim" && expiresAt && (
          <p className="text-xs text-gray-500 mb-3">
            Expires: {new Date(expiresAt).toLocaleDateString()}
          </p>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {createdAt ? new Date(createdAt).toLocaleDateString() : "N/A"}
          </span>

          {currentStatus === "pending" && (
            <div className="flex flex-col items-end gap-2">
              {/* Make Permanent checkbox for tehillim */}
              {type === "tehillim" && (
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={makePermanent}
                    onChange={(e) => setMakePermanent(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gray-300"
                  />
                  <Infinity className="h-3 w-3" />
                  Make Permanent
                </label>
              )}
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
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
