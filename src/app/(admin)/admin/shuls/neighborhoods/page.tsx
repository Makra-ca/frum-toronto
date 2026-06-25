"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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
import { Loader2, Plus, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";

interface Neighborhood {
  id: number;
  name: string;
  displayOrder: number | null;
  isActive: boolean | null;
}

export default function NeighborhoodsPage() {
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Neighborhood | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchNeighborhoods = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/shul-neighborhoods");
      if (res.ok) setNeighborhoods(await res.json());
    } catch {
      toast.error("Failed to load neighborhoods");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNeighborhoods();
  }, [fetchNeighborhoods]);

  async function handleAdd() {
    if (!newName.trim()) {
      toast.error("Enter a neighborhood name");
      return;
    }
    setIsAdding(true);
    try {
      const res = await fetch("/api/admin/shul-neighborhoods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), displayOrder: neighborhoods.length * 10 }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add");
      }
      toast.success("Neighborhood added");
      setNewName("");
      fetchNeighborhoods();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add");
    } finally {
      setIsAdding(false);
    }
  }

  async function toggleActive(n: Neighborhood) {
    try {
      const res = await fetch(`/api/admin/shul-neighborhoods/${n.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !n.isActive }),
      });
      if (!res.ok) throw new Error();
      setNeighborhoods((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, isActive: !n.isActive } : x))
      );
    } catch {
      toast.error("Failed to update");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/shul-neighborhoods/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Neighborhood deleted");
      setDeleteTarget(null);
      fetchNeighborhoods();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Shul Neighborhoods
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          These are the areas users can filter shuls by. Add a new one anytime — it appears in the
          shul edit form and the public filter immediately. Inactive areas are hidden from the
          public filter but keep existing shul tags.
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="e.g., Bathurst & Sheppard"
            />
            <Button onClick={handleAdd} disabled={isAdding}>
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span className="ml-1">Add</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : neighborhoods.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-8">No neighborhoods yet.</p>
      ) : (
        <div className="space-y-2">
          {neighborhoods.map((n) => (
            <Card key={n.id}>
              <CardContent className="p-3 flex items-center justify-between gap-4">
                <span className={n.isActive ? "" : "text-gray-400 line-through"}>{n.name}</span>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs text-gray-500">
                    <Switch checked={!!n.isActive} onCheckedChange={() => toggleActive(n)} />
                    {n.isActive ? "Active" : "Hidden"}
                  </label>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => setDeleteTarget(n)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete neighborhood?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes &quot;{deleteTarget?.name}&quot; from the list. Shuls already tagged with it
              keep the label but it won&apos;t be a filter option. Consider hiding it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
