"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Mail, Eye } from "lucide-react";

interface ContactSubmission {
  id: number;
  category: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: string | null;
  createdAt: Date | null;
}

interface ContactTableProps {
  submissions: ContactSubmission[];
}

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  read: "bg-yellow-100 text-yellow-800",
  responded: "bg-green-100 text-green-800",
};

export function ContactTable({ submissions: initialSubmissions }: ContactTableProps) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [updating, setUpdating] = useState<number | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<ContactSubmission | null>(null);

  const updateStatus = async (id: number, status: string) => {
    setUpdating(id);

    try {
      const response = await fetch(`/api/admin/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        setSubmissions((prev) =>
          prev.map((sub) => (sub.id === id ? { ...sub, status } : sub))
        );
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setUpdating(null);
    }
  };

  const viewMessage = (submission: ContactSubmission) => {
    setSelectedMessage(submission);
    if (submission.status === "new") {
      updateStatus(submission.id, "read");
    }
  };

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  From
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subject
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {submissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No contact submissions yet
                  </td>
                </tr>
              ) : (
                submissions.map((submission) => (
                  <tr
                    key={submission.id}
                    className={`hover:bg-gray-50 ${
                      submission.status === "new" ? "bg-blue-50/50" : ""
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {submission.createdAt
                        ? new Date(submission.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant="outline">{submission.category}</Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="font-medium text-gray-900">
                          {submission.name}
                        </div>
                        <div className="text-sm text-gray-500">{submission.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {submission.subject || "(No subject)"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Select
                        value={submission.status || "new"}
                        onValueChange={(value) => updateStatus(submission.id, value)}
                        disabled={updating === submission.id}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="read">Read</SelectItem>
                          <SelectItem value="responded">Responded</SelectItem>
                        </SelectContent>
                      </Select>
                      {updating === submission.id && (
                        <Loader2 className="h-4 w-4 animate-spin inline ml-2" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => viewMessage(submission)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                        >
                          <a href={`mailto:${submission.email}?subject=Re: ${submission.subject || "Your message to FrumToronto"}`}>
                            <Mail className="h-4 w-4 mr-1" />
                            Reply
                          </a>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {submissions.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
            No contact submissions yet
          </div>
        ) : (
          submissions.map((submission) => (
            <div
              key={submission.id}
              className={`bg-white rounded-lg shadow p-4 ${
                submission.status === "new" ? "border-l-4 border-blue-500" : ""
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-medium text-gray-900">{submission.name}</div>
                  <div className="text-sm text-gray-500">{submission.email}</div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {submission.category}
                </Badge>
              </div>

              <div className="text-sm text-gray-900 mb-2">
                <span className="font-medium">Subject:</span>{" "}
                {submission.subject || "(No subject)"}
              </div>

              <div className="text-xs text-gray-500 mb-3">
                {submission.createdAt
                  ? new Date(submission.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "N/A"}
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm text-gray-500">Status:</span>
                <Select
                  value={submission.status || "new"}
                  onValueChange={(value) => updateStatus(submission.id, value)}
                  disabled={updating === submission.id}
                >
                  <SelectTrigger className="w-28 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="read">Read</SelectItem>
                    <SelectItem value="responded">Responded</SelectItem>
                  </SelectContent>
                </Select>
                {updating === submission.id && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => viewMessage(submission)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
                <Button size="sm" variant="outline" className="flex-1" asChild>
                  <a
                    href={`mailto:${submission.email}?subject=Re: ${
                      submission.subject || "Your message to FrumToronto"
                    }`}
                  >
                    <Mail className="h-4 w-4 mr-1" />
                    Reply
                  </a>
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Message Detail Dialog */}
      <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Message Details</DialogTitle>
          </DialogHeader>
          {selectedMessage && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-500">From:</span>
                  <p className="text-gray-900">{selectedMessage.name}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-500">Email:</span>
                  <p className="text-gray-900">{selectedMessage.email}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-500">Category:</span>
                  <p className="text-gray-900">{selectedMessage.category}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-500">Date:</span>
                  <p className="text-gray-900">
                    {selectedMessage.createdAt
                      ? new Date(selectedMessage.createdAt).toLocaleString()
                      : "N/A"}
                  </p>
                </div>
              </div>
              <div>
                <span className="font-medium text-gray-500 text-sm">Subject:</span>
                <p className="text-gray-900">{selectedMessage.subject || "(No subject)"}</p>
              </div>
              <div>
                <span className="font-medium text-gray-500 text-sm">Message:</span>
                <div className="mt-1 p-4 bg-gray-50 rounded-lg whitespace-pre-wrap text-gray-900">
                  {selectedMessage.message}
                </div>
              </div>
              <div className="flex justify-end">
                <Button asChild>
                  <a href={`mailto:${selectedMessage.email}?subject=Re: ${selectedMessage.subject || "Your message to FrumToronto"}`}>
                    <Mail className="h-4 w-4 mr-2" />
                    Reply via Email
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
