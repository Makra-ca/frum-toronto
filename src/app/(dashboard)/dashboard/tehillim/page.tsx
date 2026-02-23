"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Loader2,
  Plus,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";

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

export default function MyTehillimPage() {
  const { data: session, status } = useSession();
  const [submissions, setSubmissions] = useState<TehillimEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      fetchSubmissions();
    }
  }, [status]);

  const fetchSubmissions = async () => {
    try {
      const res = await fetch("/api/user/tehillim");
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data);
      }
    } catch (error) {
      console.error("Failed to fetch submissions:", error);
      toast.error("Failed to load your submissions");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/user/tehillim?id=${deleteId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setSubmissions(submissions.filter((s) => s.id !== deleteId));
        toast.success("Name removed from Tehillim list");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete");
      }
    } catch (error) {
      toast.error("Failed to delete submission");
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const getStatusBadge = (entry: TehillimEntry) => {
    const today = new Date().toISOString().split("T")[0];
    const isExpired = entry.expiresAt && entry.expiresAt <= today && !entry.isPermanent;

    if (isExpired) {
      return (
        <Badge variant="secondary" className="bg-gray-100 text-gray-600">
          <Clock className="h-3 w-3 mr-1" />
          Expired
        </Badge>
      );
    }

    switch (entry.approvalStatus) {
      case "approved":
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <AlertCircle className="h-3 w-3 mr-1" />
            Pending Approval
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="secondary">{entry.approvalStatus}</Badge>;
    }
  };

  const getExpirationText = (entry: TehillimEntry) => {
    if (entry.isPermanent) {
      return <span className="text-green-600">Permanent</span>;
    }
    if (!entry.expiresAt) {
      return <span className="text-gray-500">No expiration set</span>;
    }

    const expiresDate = new Date(entry.expiresAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (expiresDate <= today) {
      return <span className="text-red-600">Expired</span>;
    }

    return (
      <span className="text-gray-600">
        Expires {formatDistanceToNow(expiresDate, { addSuffix: true })}
      </span>
    );
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto py-12 px-4">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto py-12 px-4">
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Login Required</h2>
              <p className="text-gray-600 mb-4">
                You must be logged in to view your Tehillim submissions.
              </p>
              <Link href="/login">
                <Button>Sign In</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>My Tehillim Submissions</CardTitle>
                <CardDescription>
                  Manage the names you&apos;ve submitted to the Tehillim list
                </CardDescription>
              </div>
              <Link href="/community/tehillim/add">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Name
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {submissions.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No submissions yet
                </h3>
                <p className="text-gray-600 mb-4">
                  You haven&apos;t submitted any names to the Tehillim list.
                </p>
                <Link href="/community/tehillim/add">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Name
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {submissions.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(entry)}
                        <span className="text-xs text-gray-500">
                          Submitted {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                        </span>
                      </div>

                      <div className="space-y-1">
                        {entry.hebrewName && (
                          <p className="font-medium text-lg" dir="rtl">
                            {entry.hebrewName}
                          </p>
                        )}
                        {entry.englishName && (
                          <p className="text-gray-700">{entry.englishName}</p>
                        )}
                        {entry.reason && (
                          <p className="text-sm text-gray-500">
                            Reason: {entry.reason}
                          </p>
                        )}
                      </div>

                      <p className="text-xs">
                        {getExpirationText(entry)}
                        {entry.expiresAt && !entry.isPermanent && (
                          <span className="text-gray-400 ml-2">
                            ({format(new Date(entry.expiresAt), "MMM d, yyyy")})
                          </span>
                        )}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteId(entry.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove from Tehillim List?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove the name from the Tehillim list. This action cannot be undone.
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
                    Removing...
                  </>
                ) : (
                  "Remove"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
