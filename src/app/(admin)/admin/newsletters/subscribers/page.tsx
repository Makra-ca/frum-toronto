"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Search, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { EmailSubscriber } from "@/types/newsletter";
import Link from "next/link";

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<EmailSubscriber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [activeCount, setActiveCount] = useState(0);

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingSubscriber, setEditingSubscriber] = useState<EmailSubscriber | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    newsletter: true,
    kosherAlerts: false,
    eruvStatus: false,
    simchas: false,
    shiva: false,
    tehillim: false,
    communityEvents: false,
  });

  useEffect(() => {
    fetchSubscribers();
  }, [search]);

  const fetchSubscribers = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("limit", "100");

      const res = await fetch(`/api/admin/newsletter-subscribers?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setSubscribers(data.subscribers);
      setTotal(data.total);
      setActiveCount(data.activeCount);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load subscribers");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: "",
      firstName: "",
      lastName: "",
      newsletter: true,
      kosherAlerts: false,
      eruvStatus: false,
      simchas: false,
      shiva: false,
      tehillim: false,
      communityEvents: false,
    });
  };

  const handleEdit = (subscriber: EmailSubscriber) => {
    setEditingSubscriber(subscriber);
    setFormData({
      email: subscriber.email,
      firstName: subscriber.firstName || "",
      lastName: subscriber.lastName || "",
      newsletter: subscriber.newsletter,
      kosherAlerts: subscriber.kosherAlerts,
      eruvStatus: subscriber.eruvStatus,
      simchas: subscriber.simchas,
      shiva: subscriber.shiva,
      tehillim: subscriber.tehillim || false,
      communityEvents: subscriber.communityEvents || false,
    });
  };

  const handleSave = async () => {
    if (!formData.email) {
      toast.error("Email is required");
      return;
    }

    setIsSaving(true);
    try {
      const url = editingSubscriber
        ? `/api/admin/newsletter-subscribers/${editingSubscriber.id}`
        : "/api/admin/newsletter-subscribers";

      const res = await fetch(url, {
        method: editingSubscriber ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      toast.success(editingSubscriber ? "Subscriber updated" : "Subscriber added");
      setShowAddDialog(false);
      setEditingSubscriber(null);
      resetForm();
      fetchSubscribers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save subscriber");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const res = await fetch(`/api/admin/newsletter-subscribers/${deleteId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete");

      toast.success("Subscriber deleted");
      setSubscribers((prev) => prev.filter((s) => s.id !== deleteId));
    } catch (error) {
      toast.error("Failed to delete subscriber");
    } finally {
      setDeleteId(null);
    }
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/newsletters">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Subscribers</h1>
            <p className="text-gray-600">
              {activeCount} active of {total} total subscribers
            </p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <strong>Note:</strong> Only subscribers with linked user accounts receive emails.
        Users create accounts at registration and manage preferences in their dashboard settings.
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by email or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">Loading...</p>
        </div>
      ) : subscribers.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">
            {search ? "No subscribers found matching your search" : "No subscribers yet"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Subscriptions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscribers.map((subscriber) => (
                <TableRow key={subscriber.id}>
                  <TableCell className="font-medium">{subscriber.email}</TableCell>
                  <TableCell>
                    {subscriber.firstName || subscriber.lastName
                      ? `${subscriber.firstName || ""} ${subscriber.lastName || ""}`.trim()
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {subscriber.newsletter && (
                        <Badge variant="secondary" className="text-xs">Newsletter</Badge>
                      )}
                      {subscriber.kosherAlerts && (
                        <Badge variant="secondary" className="text-xs">Kosher</Badge>
                      )}
                      {subscriber.eruvStatus && (
                        <Badge variant="secondary" className="text-xs">Eruv</Badge>
                      )}
                      {subscriber.simchas && (
                        <Badge variant="secondary" className="text-xs">Simchas</Badge>
                      )}
                      {subscriber.shiva && (
                        <Badge variant="secondary" className="text-xs">Shiva</Badge>
                      )}
                      {subscriber.tehillim && (
                        <Badge variant="secondary" className="text-xs">Tehillim</Badge>
                      )}
                      {subscriber.communityEvents && (
                        <Badge variant="secondary" className="text-xs">Events</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {subscriber.unsubscribedAt ? (
                        <Badge variant="destructive">Unsubscribed</Badge>
                      ) : subscriber.isActive ? (
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                      {subscriber.userId ? (
                        <Badge className="bg-blue-100 text-blue-800">Linked</Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-500">No Account</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm">
                    {formatDate(subscriber.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(subscriber)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(subscriber.id)}
                        className="text-red-600 hover:text-red-700"
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
      )}

      {/* Add/Edit Dialog */}
      <Dialog
        open={showAddDialog || !!editingSubscriber}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false);
            setEditingSubscriber(null);
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSubscriber ? "Edit Subscriber" : "Add Subscriber"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t">
              <Label className="text-sm font-medium text-gray-700">Subscriptions</Label>
              <div className="space-y-3">
                {[
                  { key: "newsletter", label: "Newsletter" },
                  { key: "kosherAlerts", label: "Kosher Alerts" },
                  { key: "eruvStatus", label: "Eruv Status" },
                  { key: "simchas", label: "Simchas" },
                  { key: "shiva", label: "Shiva Notices" },
                  { key: "tehillim", label: "Tehillim Updates" },
                  { key: "communityEvents", label: "Community Events" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label htmlFor={key} className="font-normal">{label}</Label>
                    <Switch
                      id={key}
                      checked={formData[key as keyof typeof formData] as boolean}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, [key]: checked })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddDialog(false);
                setEditingSubscriber(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subscriber</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this subscriber? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
