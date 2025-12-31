"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Send, Loader2, CheckCircle, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";

interface Shul {
  id: number;
  businessName: string | null;
  address: string | null;
}

interface MyRequest {
  id: number;
  shulId: number;
  message: string | null;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
}

export default function RequestShulPage() {
  const [shuls, setShuls] = useState<Shul[]>([]);
  const [myRequests, setMyRequests] = useState<MyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedShulId, setSelectedShulId] = useState<string>("");
  const [message, setMessage] = useState("");

  async function fetchData() {
    try {
      // Fetch all shuls (public endpoint)
      const shulsRes = await fetch("/api/davening");
      if (shulsRes.ok) {
        const shulsData = await shulsRes.json();
        // Map the shuls data
        const mappedShuls = shulsData.map((s: { id: number; businessName: string; address: string }) => ({
          id: s.id,
          businessName: s.businessName,
          address: s.address,
        }));
        setShuls(mappedShuls);
      }

      // Fetch my requests
      const requestsRes = await fetch("/api/shuls/request");
      if (requestsRes.ok) {
        const requestsData = await requestsRes.json();
        setMyRequests(requestsData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedShulId) {
      toast.error("Please select a shul");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/shuls/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shulId: parseInt(selectedShulId),
          message: message || null,
        }),
      });

      if (response.ok) {
        toast.success("Request submitted successfully");
        setSelectedShulId("");
        setMessage("");
        fetchData();
      } else {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit request");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
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

  // Filter out shuls that already have pending requests
  const pendingShulIds = myRequests
    .filter((r) => r.status === "pending")
    .map((r) => r.shulId);
  const availableShuls = shuls.filter((s) => !pendingShulIds.includes(s.id));

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/dashboard/shuls"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to My Shuls
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">
            Request Shul Access
          </h1>
          <p className="mt-2 text-gray-600">
            Request access to manage a shul&apos;s profile and davening times
          </p>
        </div>

        {/* Request Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Submit a Request</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Select Shul</Label>
                <Select value={selectedShulId} onValueChange={setSelectedShulId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a shul to manage" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableShuls.length === 0 ? (
                      <SelectItem value="" disabled>
                        No shuls available
                      </SelectItem>
                    ) : (
                      availableShuls.map((shul) => (
                        <SelectItem key={shul.id} value={shul.id.toString()}>
                          {shul.businessName || `Shul #${shul.id}`}
                          {shul.address && ` - ${shul.address}`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="message">
                  Message to Admin (optional)
                </Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Explain your connection to this shul (e.g., I am the gabbai, board member, etc.)"
                  rows={3}
                />
              </div>
              <Button type="submit" disabled={submitting || !selectedShulId}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Submit Request
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* My Requests */}
        {myRequests.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>My Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {myRequests.map((request) => {
                  const shul = shuls.find((s) => s.id === request.shulId);
                  return (
                    <div
                      key={request.id}
                      className="flex items-start justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-start gap-3">
                        {getStatusIcon(request.status)}
                        <div>
                          <p className="font-medium">
                            {shul?.businessName || `Shul #${request.shulId}`}
                          </p>
                          <p className="text-sm text-gray-500">
                            Requested on{" "}
                            {new Date(request.createdAt).toLocaleDateString()}
                          </p>
                          {request.reviewNotes && request.status !== "pending" && (
                            <p className="text-sm text-gray-600 mt-1">
                              <span className="font-medium">Admin notes:</span>{" "}
                              {request.reviewNotes}
                            </p>
                          )}
                        </div>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
