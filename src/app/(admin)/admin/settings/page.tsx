"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, Mail, Plus, Trash2, Edit2, X, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface FormType {
  value: string;
  label: string;
}

interface Recipient {
  id: number;
  formType: string;
  email: string;
  name: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function SettingsPage() {
  const [formTypes, setFormTypes] = useState<FormType[]>([]);
  const [recipients, setRecipients] = useState<Record<string, Recipient[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null);
  const [selectedFormType, setSelectedFormType] = useState<string>("");

  // Form state
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchRecipients();
  }, []);

  const fetchRecipients = async () => {
    try {
      const res = await fetch("/api/admin/form-recipients");
      const data = await res.json();
      setRecipients(data.recipients || {});
      setFormTypes(data.formTypes || []);
    } catch (error) {
      console.error("Error fetching recipients:", error);
      toast.error("Failed to load email recipients");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRecipient = async () => {
    if (!selectedFormType || !newEmail) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/form-recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formType: selectedFormType,
          email: newEmail,
          name: newName || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to add recipient");
      }

      toast.success("Recipient added successfully");
      setIsAddDialogOpen(false);
      setNewEmail("");
      setNewName("");
      setSelectedFormType("");
      fetchRecipients();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add recipient");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateRecipient = async () => {
    if (!editingRecipient) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/form-recipients/${editingRecipient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          name: newName || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update recipient");
      }

      toast.success("Recipient updated successfully");
      setEditingRecipient(null);
      setNewEmail("");
      setNewName("");
      fetchRecipients();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update recipient");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRecipient = async (id: number) => {
    if (!confirm("Are you sure you want to remove this recipient?")) return;

    try {
      const res = await fetch(`/api/admin/form-recipients/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete recipient");
      }

      toast.success("Recipient removed successfully");
      fetchRecipients();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete recipient");
    }
  };

  const openEditDialog = (recipient: Recipient) => {
    setEditingRecipient(recipient);
    setNewEmail(recipient.email);
    setNewName(recipient.name || "");
  };

  const openAddDialog = (formType?: string) => {
    setIsAddDialogOpen(true);
    setSelectedFormType(formType || "");
    setNewEmail("");
    setNewName("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-gray-700" />
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-gray-500">Configure system settings and email notifications</p>
          </div>
        </div>
      </div>

      {/* Email Recipients Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              <CardTitle>Form Email Recipients</CardTitle>
            </div>
            <Button onClick={() => openAddDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Recipient
            </Button>
          </div>
          <CardDescription>
            Configure which email addresses receive notifications when forms are submitted
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {formTypes.map((formType) => (
            <div key={formType.value} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">{formType.label}</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openAddDialog(formType.value)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>

              {recipients[formType.value]?.length > 0 ? (
                <div className="space-y-2">
                  {recipients[formType.value].map((recipient) => (
                    <div
                      key={recipient.id}
                      className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <Mail className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{recipient.email}</p>
                          {recipient.name && (
                            <p className="text-xs text-gray-500">{recipient.name}</p>
                          )}
                        </div>
                        {!recipient.isActive && (
                          <Badge variant="secondary" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(recipient)}
                        >
                          <Edit2 className="h-4 w-4 text-gray-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRecipient(recipient.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  No recipients configured. Add email addresses to receive notifications.
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Add Recipient Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Email Recipient</DialogTitle>
            <DialogDescription>
              Add an email address to receive form submission notifications
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="formType">Form Type</Label>
              <Select value={selectedFormType} onValueChange={setSelectedFormType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select form type" />
                </SelectTrigger>
                <SelectContent>
                  {formTypes.map((ft) => (
                    <SelectItem key={ft.value} value={ft.value}>
                      {ft.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                placeholder="recipient@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Display Name (Optional)</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddRecipient} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Recipient
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Recipient Dialog */}
      <Dialog open={!!editingRecipient} onOpenChange={(open) => !open && setEditingRecipient(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Recipient</DialogTitle>
            <DialogDescription>
              Update the email recipient details
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editEmail">Email Address *</Label>
              <Input
                id="editEmail"
                type="email"
                placeholder="recipient@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editName">Display Name (Optional)</Label>
              <Input
                id="editName"
                placeholder="John Doe"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRecipient(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateRecipient} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
