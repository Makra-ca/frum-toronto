"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShulRequestsTable } from "@/components/admin/ShulRequestsTable";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

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

export default function ShulRequestsPage() {
  const [pendingRequests, setPendingRequests] = useState<ShulRequest[]>([]);
  const [approvedRequests, setApprovedRequests] = useState<ShulRequest[]>([]);
  const [rejectedRequests, setRejectedRequests] = useState<ShulRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");

  async function fetchRequests() {
    setLoading(true);
    try {
      const [pending, approved, rejected] = await Promise.all([
        fetch("/api/admin/shul-requests?status=pending").then((r) => r.json()),
        fetch("/api/admin/shul-requests?status=approved").then((r) => r.json()),
        fetch("/api/admin/shul-requests?status=rejected").then((r) => r.json()),
      ]);

      setPendingRequests(pending);
      setApprovedRequests(approved);
      setRejectedRequests(rejected);
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRequests();
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Shul Management Requests</h1>
        <p className="text-gray-500">
          Review and approve requests from users who want to manage shuls
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            Pending
            {pendingRequests.length > 0 && (
              <Badge className="bg-yellow-100 text-yellow-800">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved ({approvedRequests.length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected ({rejectedRequests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          <ShulRequestsTable requests={pendingRequests} onRefresh={fetchRequests} />
        </TabsContent>

        <TabsContent value="approved" className="mt-6">
          {approvedRequests.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">No approved requests yet.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Shul
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Reviewed On
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {approvedRequests.map((request) => (
                    <tr key={request.id}>
                      <td className="px-6 py-4">
                        <div className="font-medium">
                          {request.user?.firstName} {request.user?.lastName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {request.user?.email}
                        </div>
                      </td>
                      <td className="px-6 py-4">{request.shulName}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {request.reviewedAt
                          ? new Date(request.reviewedAt).toLocaleDateString()
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="rejected" className="mt-6">
          {rejectedRequests.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">No rejected requests.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Shul
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Notes
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Reviewed On
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rejectedRequests.map((request) => (
                    <tr key={request.id}>
                      <td className="px-6 py-4">
                        <div className="font-medium">
                          {request.user?.firstName} {request.user?.lastName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {request.user?.email}
                        </div>
                      </td>
                      <td className="px-6 py-4">{request.shulName}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {request.reviewNotes || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {request.reviewedAt
                          ? new Date(request.reviewedAt).toLocaleDateString()
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
