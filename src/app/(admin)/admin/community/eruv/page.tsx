"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Save, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

interface EruvEntry {
  id: number;
  statusDate: string;
  isUp: boolean;
  message: string | null;
  updatedBy: number | null;
  updatedAt: string | null;
}

function getToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatStatusDate(dateStr: string): string {
  // statusDate is a date string like "2026-03-18" - parse as local date
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function EruvManagementPage() {
  const [statuses, setStatuses] = useState<EruvEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [statusDate, setStatusDate] = useState(getToday());
  const [isUp, setIsUp] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchStatuses();
  }, []);

  const fetchStatuses = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/eruv");
      const data = await res.json();
      if (res.ok) {
        setStatuses(data.statuses || []);
      }
    } catch (error) {
      console.error("Error fetching eruv statuses:", error);
      toast.error("Failed to load eruv statuses");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!statusDate) {
      toast.error("Please select a date");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/eruv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusDate, isUp, message }),
      });

      if (res.ok) {
        toast.success("Eruv status saved");
        setMessage("");
        setStatusDate(getToday());
        setIsUp(true);
        fetchStatuses();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save");
      }
    } catch (error) {
      toast.error("Failed to save eruv status");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Form */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="statusDate">Date</Label>
                <Input
                  id="statusDate"
                  type="date"
                  value={statusDate}
                  onChange={(e) => setStatusDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Eruv Status</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={isUp ? "default" : "outline"}
                    className={
                      isUp
                        ? "flex-1 bg-green-600 hover:bg-green-700 text-white"
                        : "flex-1"
                    }
                    onClick={() => setIsUp(true)}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Up
                  </Button>
                  <Button
                    type="button"
                    variant={!isUp ? "default" : "outline"}
                    className={
                      !isUp
                        ? "flex-1 bg-red-600 hover:bg-red-700 text-white"
                        : "flex-1"
                    }
                    onClick={() => setIsUp(false)}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Down
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Optional notes about eruv status..."
                rows={3}
              />
            </div>

            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Status
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Statuses Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : statuses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">No eruv statuses recorded yet</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statuses.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {formatStatusDate(entry.statusDate)}
                    </TableCell>
                    <TableCell>
                      {entry.isUp ? (
                        <Badge className="bg-green-100 text-green-800">
                          Up
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800">
                          Down
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate whitespace-normal">
                      {entry.message || (
                        <span className="text-gray-400">--</span>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {entry.updatedAt
                        ? formatRelativeDate(entry.updatedAt)
                        : "--"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
