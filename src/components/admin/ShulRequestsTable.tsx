"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ShulRequest {
  id: number;
  message: string | null;
  status: string;
  createdAt: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  user: {
    id: number;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  shul: {
    id: number;
    businessId: number | null;
  } | null;
  shulName: string | null;
}

interface ShulRequestsTableProps {
  requests: ShulRequest[];
  onRefresh: () => void;
}

export function ShulRequestsTable({ requests, onRefresh }: ShulRequestsTableProps) {
  const [processing, setProcessing] = useState<number | null>(null);
  const [reviewDialog, setReviewDialog] = useState<{
    request: ShulRequest;
    action: "approve" | "reject";
  } | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  async function handleAction(requestId: number, action: "approve" | "reject", notes: string) {
    setProcessing(requestId);
    try {
      const response = await fetch(`/api/admin/shul-requests/${requestId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reviewNotes: notes }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to process request");
      }

      toast.success(`Request ${action}d successfully`);
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process request");
    } finally {
      setProcessing(null);
      setReviewDialog(null);
      setReviewNotes("");
    }
  }

  function openReviewDialog(request: ShulRequest, action: "approve" | "reject") {
    setReviewDialog({ request, action });
    setReviewNotes("");
  }

  if (requests.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">No pending shul management requests.</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Shul</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((request) => (
              <TableRow key={request.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">
                      {request.user?.firstName} {request.user?.lastName}
                    </div>
                    <div className="text-sm text-gray-500">
                      {request.user?.email}
                    </div>
                  </div>
                </TableCell>
                <TableCell>{request.shulName || "Unknown Shul"}</TableCell>
                <TableCell>
                  <span className="text-sm text-gray-600 line-clamp-2">
                    {request.message || "-"}
                  </span>
                </TableCell>
                <TableCell>
                  {request.createdAt
                    ? new Date(request.createdAt).toLocaleDateString()
                    : "-"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={() => openReviewDialog(request, "approve")}
                      disabled={processing === request.id}
                    >
                      {processing === request.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => openReviewDialog(request, "reject")}
                      disabled={processing === request.id}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reject
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
        {requests.map((request) => (
          <div key={request.id} className="bg-white rounded-lg shadow p-4">
            <div className="mb-3">
              <div className="font-medium text-gray-900">
                {request.user?.firstName} {request.user?.lastName}
              </div>
              <div className="text-sm text-gray-500">{request.user?.email}</div>
            </div>

            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-gray-500">Shul:</span>
                <span className="font-medium">{request.shulName || "Unknown Shul"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Requested:</span>
                <span>
                  {request.createdAt
                    ? new Date(request.createdAt).toLocaleDateString()
                    : "-"}
                </span>
              </div>
              {request.message && (
                <div>
                  <span className="text-gray-500">Message:</span>
                  <p className="text-gray-600 mt-1">{request.message}</p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={() => openReviewDialog(request, "approve")}
                disabled={processing === request.id}
              >
                {processing === request.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Approve
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => openReviewDialog(request, "reject")}
                disabled={processing === request.id}
              >
                <X className="h-4 w-4 mr-1" />
                Reject
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!reviewDialog} onOpenChange={() => setReviewDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewDialog?.action === "approve" ? "Approve" : "Reject"} Request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm text-gray-600">
                User: <strong>{reviewDialog?.request.user?.firstName} {reviewDialog?.request.user?.lastName}</strong>
              </p>
              <p className="text-sm text-gray-600">
                Shul: <strong>{reviewDialog?.request.shulName}</strong>
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Review Notes (optional)</Label>
              <Textarea
                id="notes"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add any notes about this decision..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (reviewDialog) {
                  handleAction(reviewDialog.request.id, reviewDialog.action, reviewNotes);
                }
              }}
              className={reviewDialog?.action === "approve" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
              disabled={processing !== null}
            >
              {processing !== null ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {reviewDialog?.action === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
