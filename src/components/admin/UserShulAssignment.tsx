"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Assignment {
  id: number;
  assignedAt: string | null;
  user: {
    id: number;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
  } | null;
  shul: {
    id: number;
    name: string | null;
  } | null;
  shulName: string | null;
}

interface User {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface Shul {
  id: number;
  name: string | null;
}

interface UserShulAssignmentProps {
  assignments: Assignment[];
  onRefresh: () => void;
}

export function UserShulAssignment({ assignments, onRefresh }: UserShulAssignmentProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingAssignment, setDeletingAssignment] = useState<Assignment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [shuls, setShuls] = useState<Shul[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedShulId, setSelectedShulId] = useState<string>("");
  const [loadingData, setLoadingData] = useState(false);

  async function loadUsersAndShuls() {
    setLoadingData(true);
    try {
      const [usersRes, shulsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/shuls"),
      ]);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData);
      }
      if (shulsRes.ok) {
        const shulsData = await shulsRes.json();
        setShuls(shulsData);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoadingData(false);
    }
  }

  function openAssignDialog() {
    loadUsersAndShuls();
    setSelectedUserId("");
    setSelectedShulId("");
    setIsDialogOpen(true);
  }

  async function handleAssign() {
    if (!selectedUserId || !selectedShulId) {
      toast.error("Please select both a user and a shul");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/user-shuls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: parseInt(selectedUserId),
          shulId: parseInt(selectedShulId),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create assignment");
      }

      toast.success("User assigned to shul successfully");
      setIsDialogOpen(false);
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create assignment");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deletingAssignment) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/user-shuls/${deletingAssignment.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to remove assignment");
      }

      toast.success("Assignment removed successfully");
      setIsDeleteDialogOpen(false);
      setDeletingAssignment(null);
      onRefresh();
    } catch (error) {
      toast.error("Failed to remove assignment");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">User-Shul Assignments</h2>
        <Button onClick={openAssignDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Assign User to Shul
        </Button>
      </div>

      {assignments.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">No user-shul assignments yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Shul</TableHead>
                <TableHead>Assigned On</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {assignment.user?.firstName} {assignment.user?.lastName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {assignment.user?.email}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{assignment.shulName || "Unknown Shul"}</TableCell>
                  <TableCell>
                    {assignment.assignedAt
                      ? new Date(assignment.assignedAt).toLocaleDateString()
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        setDeletingAssignment(assignment);
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign User to Shul</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {loadingData ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Select User</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.firstName} {user.lastName} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Select Shul</Label>
                  <Select value={selectedShulId} onValueChange={setSelectedShulId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a shul" />
                    </SelectTrigger>
                    <SelectContent>
                      {shuls.map((shul) => (
                        <SelectItem key={shul.id} value={shul.id.toString()}>
                          {shul.name || `Shul #${shul.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={isSubmitting || loadingData}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {deletingAssignment?.user?.firstName} {deletingAssignment?.user?.lastName}&apos;s
              access to {deletingAssignment?.shulName}? They will no longer be able to manage this shul.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
