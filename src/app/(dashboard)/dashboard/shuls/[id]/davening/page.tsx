"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";

interface DaveningSchedule {
  id: number;
  shulId: number;
  tefilahType: string;
  dayOfWeek: number | null;
  time: string;
  notes: string | null;
  isWinter: boolean | null;
  isSummer: boolean | null;
  isShabbos: boolean | null;
}

const TEFILAH_TYPES = [
  { value: "shacharis", label: "Shacharis" },
  { value: "mincha", label: "Mincha" },
  { value: "maariv", label: "Maariv" },
];

const DAYS_OF_WEEK = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Shabbos" },
];

function getDayLabel(day: number | null): string {
  if (day === null) return "Daily";
  return DAYS_OF_WEEK.find((d) => d.value === day.toString())?.label || "Unknown";
}

function getTefilahLabel(type: string): string {
  return TEFILAH_TYPES.find((t) => t.value === type)?.label || type;
}

export default function DaveningPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [schedules, setSchedules] = useState<DaveningSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [shulName, setShulName] = useState("");

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<DaveningSchedule | null>(null);
  const [deletingSchedule, setDeletingSchedule] = useState<DaveningSchedule | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    tefilahType: "shacharis",
    dayOfWeek: "",
    time: "",
    notes: "",
    isWinter: false,
    isSummer: false,
    isShabbos: false,
  });

  async function fetchSchedules() {
    try {
      const response = await fetch(`/api/shuls/${id}/davening`);
      if (response.ok) {
        const data = await response.json();
        setSchedules(data);
      } else if (response.status === 403) {
        toast.error("You don't have permission to manage this shul");
        router.push("/dashboard/shuls");
      }
    } catch (error) {
      console.error("Error fetching schedules:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchShulName() {
    try {
      const response = await fetch(`/api/shuls/${id}`);
      if (response.ok) {
        const data = await response.json();
        setShulName(data.business?.name || `Shul #${id}`);
      }
    } catch (error) {
      console.error("Error fetching shul:", error);
    }
  }

  useEffect(() => {
    fetchSchedules();
    fetchShulName();
  }, [id]);

  function openAddDialog() {
    setEditingSchedule(null);
    setFormData({
      tefilahType: "shacharis",
      dayOfWeek: "",
      time: "",
      notes: "",
      isWinter: false,
      isSummer: false,
      isShabbos: false,
    });
    setIsDialogOpen(true);
  }

  function openEditDialog(schedule: DaveningSchedule) {
    setEditingSchedule(schedule);
    setFormData({
      tefilahType: schedule.tefilahType,
      dayOfWeek: schedule.dayOfWeek?.toString() || "",
      time: schedule.time,
      notes: schedule.notes || "",
      isWinter: schedule.isWinter || false,
      isSummer: schedule.isSummer || false,
      isShabbos: schedule.isShabbos || false,
    });
    setIsDialogOpen(true);
  }

  async function handleSubmit() {
    if (!formData.time) {
      toast.error("Please enter a time");
      return;
    }

    setSaving(true);
    try {
      const url = editingSchedule
        ? `/api/shuls/${id}/davening/${editingSchedule.id}`
        : `/api/shuls/${id}/davening`;
      const method = editingSchedule ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tefilahType: formData.tefilahType,
          dayOfWeek: formData.dayOfWeek ? parseInt(formData.dayOfWeek) : null,
          time: formData.time,
          notes: formData.notes || null,
          isWinter: formData.isWinter,
          isSummer: formData.isSummer,
          isShabbos: formData.isShabbos,
        }),
      });

      if (response.ok) {
        toast.success(
          editingSchedule
            ? "Schedule updated successfully"
            : "Schedule added successfully"
        );
        setIsDialogOpen(false);
        fetchSchedules();
      } else {
        const data = await response.json();
        throw new Error(data.error || "Failed to save schedule");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save schedule");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingSchedule) return;

    try {
      const response = await fetch(
        `/api/shuls/${id}/davening/${deletingSchedule.id}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        toast.success("Schedule deleted successfully");
        setIsDeleteDialogOpen(false);
        setDeletingSchedule(null);
        fetchSchedules();
      } else {
        throw new Error("Failed to delete schedule");
      }
    } catch (error) {
      toast.error("Failed to delete schedule");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href={`/dashboard/shuls/${id}`}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Shul Profile
          </Link>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Davening Schedule
              </h1>
              <p className="mt-2 text-gray-600">{shulName}</p>
            </div>
            <Button onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Schedule
            </Button>
          </div>
        </div>

        {schedules.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Clock className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Schedules Yet
              </h3>
              <p className="text-gray-500 mb-6">
                Add your shul&apos;s davening times so the community knows when to attend.
              </p>
              <Button onClick={openAddDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Schedule
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>All Schedules</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tefilah</TableHead>
                    <TableHead>Day</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Season</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((schedule) => (
                    <TableRow key={schedule.id}>
                      <TableCell className="font-medium">
                        {getTefilahLabel(schedule.tefilahType)}
                      </TableCell>
                      <TableCell>{getDayLabel(schedule.dayOfWeek)}</TableCell>
                      <TableCell>{schedule.time}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {schedule.isWinter && (
                            <Badge variant="outline" className="text-xs">
                              Winter
                            </Badge>
                          )}
                          {schedule.isSummer && (
                            <Badge variant="outline" className="text-xs">
                              Summer
                            </Badge>
                          )}
                          {schedule.isShabbos && (
                            <Badge variant="outline" className="text-xs">
                              Shabbos
                            </Badge>
                          )}
                          {!schedule.isWinter &&
                            !schedule.isSummer &&
                            !schedule.isShabbos && (
                              <span className="text-gray-400 text-xs">
                                Year-round
                              </span>
                            )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {schedule.notes || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(schedule)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              setDeletingSchedule(schedule);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingSchedule ? "Edit Schedule" : "Add Schedule"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Tefilah Type</Label>
                <Select
                  value={formData.tefilahType}
                  onValueChange={(value) =>
                    setFormData({ ...formData, tefilahType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEFILAH_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Day of Week</Label>
                <Select
                  value={formData.dayOfWeek}
                  onValueChange={(value) =>
                    setFormData({ ...formData, dayOfWeek: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Daily (leave empty for every day)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Daily</SelectItem>
                    {DAYS_OF_WEEK.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="time">Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={(e) =>
                    setFormData({ ...formData, time: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes (optional)</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="e.g., 10 minutes before shkia"
                />
              </div>
              <div className="space-y-2">
                <Label>Season/Special</Label>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="isWinter"
                      checked={formData.isWinter}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, isWinter: checked })
                      }
                    />
                    <Label htmlFor="isWinter">Winter</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="isSummer"
                      checked={formData.isSummer}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, isSummer: checked })
                      }
                    />
                    <Label htmlFor="isSummer">Summer</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="isShabbos"
                      checked={formData.isShabbos}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, isShabbos: checked })
                      }
                    />
                    <Label htmlFor="isShabbos">Shabbos</Label>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {editingSchedule ? "Save Changes" : "Add Schedule"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Schedule</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this {getTefilahLabel(deletingSchedule?.tefilahType || "")} schedule?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
