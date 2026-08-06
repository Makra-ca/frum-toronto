"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2, Infinity, Clock, Pencil } from "lucide-react";
import { ApprovalEditDialog } from "@/components/admin/approvals/ApprovalEditDialog";
import type { ApprovalType } from "@/components/admin/approvals/approval-edit-fields";
import { toast } from "sonner";
import { formatInstant, formatDateOnly } from "@/lib/datetime";

interface Simcha {
  id: number;
  familyName: string;
  announcement: string;
  approvalStatus: string | null;
  createdAt: Date | null;
  typeName: string | null;
}

interface Classified {
  id: number;
  title: string;
  description: string;
  price: string | null;
  approvalStatus: string | null;
  createdAt: Date | null;
  categoryName: string | null;
}

interface Tehillim {
  id: number;
  hebrewName: string | null;
  englishName: string | null;
  motherHebrewName: string | null;
  reason: string | null;
  approvalStatus: string | null;
  expiresAt: string | null;
  createdAt: Date | null;
}

interface EventItem {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  startTime: Date | null;
  organization: string | null;
  approvalStatus: string | null;
  createdAt: Date | null;
}

interface Counts {
  simchas: number;
  classifieds: number;
  tehillim: number;
  events: number;
  total: number;
}

interface ApprovalsClientProps {
  simchas: Simcha[];
  classifieds: Classified[];
  tehillim: Tehillim[];
  events: EventItem[];
  counts: Counts;
}

export function ApprovalsClient({
  simchas: initialSimchas,
  classifieds: initialClassifieds,
  tehillim: initialTehillim,
  events: initialEvents,
  counts,
}: ApprovalsClientProps) {
  const [simchas, setSimchas] = useState(initialSimchas);
  const [classifieds, setClassifieds] = useState(initialClassifieds);
  const [tehillimList, setTehillimList] = useState(initialTehillim);
  const [events, setEvents] = useState(initialEvents);
  const [loading, setLoading] = useState<{ type: string; id: number; action: string } | null>(null);
  const [permanentChecked, setPermanentChecked] = useState<Record<number, boolean>>({});
  const [editing, setEditing] = useState<{ type: ApprovalType; id: number } | null>(null);

  /**
   * Merge a saved correction back into whichever list it came from, so the card
   * shows the corrected values without a page reload — the admin is mid-queue
   * and should not lose their place to see their own edit.
   */
  const applyEdit = (type: ApprovalType, id: number, updated: Record<string, unknown>) => {
    const merge = <T extends { id: number }>(list: T[]) =>
      list.map((item) => (item.id === id ? { ...item, ...updated } : item));

    if (type === "simchas") setSimchas((prev) => merge(prev));
    else if (type === "classifieds") setClassifieds((prev) => merge(prev));
    else if (type === "tehillim") setTehillimList((prev) => merge(prev));
    else if (type === "events") setEvents((prev) => merge(prev));
  };

  const handleAction = async (
    type: "simchas" | "classifieds" | "tehillim" | "events",
    id: number,
    action: "approve" | "reject"
  ) => {
    // The reason is optional by decision, so a blank answer is a real answer —
    // the submitter's email then writes considered fallback copy rather than a
    // bare "not approved". null means the admin cancelled the prompt, which is
    // not the same thing and must not reject anything.
    let rejectionReason: string | null = null;
    if (action === "reject") {
      const answer = window.prompt(
        "Why wasn't this approved? (optional — the submitter sees this)"
      );
      if (answer === null) return;
      rejectionReason = answer.trim() || null;
    }

    setLoading({ type, id, action });

    try {
      const isPermanent = type === "tehillim" && action === "approve" ? permanentChecked[id] || false : undefined;

      const response = await fetch(`/api/admin/content/${type}/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPermanent, rejectionReason }),
      });

      if (response.ok) {
        toast.success(`${type.slice(0, -1)} ${action}d successfully`);

        // Remove from list after action
        if (type === "simchas") {
          setSimchas((prev) => prev.filter((item) => item.id !== id));
        } else if (type === "classifieds") {
          setClassifieds((prev) => prev.filter((item) => item.id !== id));
        } else if (type === "tehillim") {
          setTehillimList((prev) => prev.filter((item) => item.id !== id));
        } else if (type === "events") {
          setEvents((prev) => prev.filter((item) => item.id !== id));
        }
      } else {
        toast.error(`Failed to ${action} ${type.slice(0, -1)}`);
      }
    } catch (error) {
      console.error("Failed to update content:", error);
      toast.error("An error occurred");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Approvals</h1>
        <p className="text-gray-600 mt-1">Review pending community submissions</p>
      </div>

      {editing && (
        <ApprovalEditDialog
          type={editing.type}
          id={editing.id}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          onSaved={(updated) => applyEdit(editing.type, editing.id, updated)}
        />
      )}

      {counts.total === 0 ? (
        <Card className="mt-6">
          <CardContent className="py-12 text-center">
            <Check className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">All Caught Up!</h3>
            <p className="text-gray-500">No pending content to review.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs
          // Opens on whichever tab actually has something waiting, so the
          // queue does not present an empty Simchas tab while five events sit
          // unreviewed one click away.
          defaultValue={
            simchas.length > 0
              ? "simchas"
              : events.length > 0
                ? "events"
                : classifieds.length > 0
                  ? "classifieds"
                  : "tehillim"
          }
          className="w-full mt-6"
        >
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-6">
            <TabsTrigger value="simchas">
              Simchas ({simchas.length})
            </TabsTrigger>
            <TabsTrigger value="events">
              Events ({events.length})
            </TabsTrigger>
            <TabsTrigger value="classifieds">
              Classifieds ({classifieds.length})
            </TabsTrigger>
            <TabsTrigger value="tehillim">
              Tehillim ({tehillimList.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="simchas">
            {simchas.length === 0 ? (
              <EmptyState message="No pending simchas" />
            ) : (
              <div className="grid gap-4">
                {simchas.map((simcha) => (
                  <Card key={simcha.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{simcha.familyName}</CardTitle>
                          {simcha.typeName && (
                            <Badge variant="outline" className="mt-1">
                              {simcha.typeName}
                            </Badge>
                          )}
                        </div>
                        <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600 mb-4">{simcha.announcement}</p>
                      <div className="flex items-center justify-between pt-4 border-t">
                        <span className="text-xs text-gray-400">
                          {simcha.createdAt ? formatInstant(simcha.createdAt, { month: "numeric", day: "numeric", year: "numeric" }) : "N/A"}
                        </span>
                        <ActionButtons
                          type="simchas"
                          id={simcha.id}
                          loading={loading}
                          onApprove={() => handleAction("simchas", simcha.id, "approve")}
                          onReject={() => handleAction("simchas", simcha.id, "reject")}
                          onEdit={() => setEditing({ type: "simchas", id: simcha.id })}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="classifieds">
            {classifieds.length === 0 ? (
              <EmptyState message="No pending classifieds" />
            ) : (
              <div className="grid gap-4">
                {classifieds.map((classified) => (
                  <Card key={classified.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{classified.title}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            {classified.categoryName && (
                              <Badge variant="outline">{classified.categoryName}</Badge>
                            )}
                            {classified.price && (
                              <span className="text-sm font-medium text-green-600">
                                ${classified.price}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                        {classified.description}
                      </p>
                      <div className="flex items-center justify-between pt-4 border-t">
                        <span className="text-xs text-gray-400">
                          {classified.createdAt ? formatInstant(classified.createdAt, { month: "numeric", day: "numeric", year: "numeric" }) : "N/A"}
                        </span>
                        <ActionButtons
                          type="classifieds"
                          id={classified.id}
                          loading={loading}
                          onApprove={() => handleAction("classifieds", classified.id, "approve")}
                          onReject={() => handleAction("classifieds", classified.id, "reject")}
                          onEdit={() => setEditing({ type: "classifieds", id: classified.id })}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="tehillim">
            {tehillimList.length === 0 ? (
              <EmptyState message="No pending tehillim" />
            ) : (
              <div className="grid gap-4">
                {tehillimList.map((item) => (
                  <Card key={item.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          {item.hebrewName ? (
                            <>
                              <CardTitle className="text-lg" dir="rtl">{item.hebrewName}</CardTitle>
                              {item.englishName && (
                                <p className="text-sm text-gray-500">{item.englishName}</p>
                              )}
                            </>
                          ) : (
                            <CardTitle className="text-lg">{item.englishName}</CardTitle>
                          )}
                          {item.motherHebrewName && (
                            <p className="text-sm text-gray-400">ben/bat {item.motherHebrewName}</p>
                          )}
                        </div>
                        <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {item.reason && (
                        <p className="text-sm text-gray-600 mb-2">{item.reason}</p>
                      )}
                      {item.expiresAt && (
                        <p className="text-xs text-gray-500 flex items-center gap-1 mb-4">
                          <Clock className="h-3 w-3" />
                          Expires: {formatDateOnly(item.expiresAt, { month: "numeric", day: "numeric", year: "numeric" })}
                        </p>
                      )}
                      <div className="flex items-center justify-between pt-4 border-t">
                        <span className="text-xs text-gray-400">
                          {item.createdAt ? formatInstant(item.createdAt, { month: "numeric", day: "numeric", year: "numeric" }) : "N/A"}
                        </span>
                        <div className="flex flex-col items-end gap-2">
                          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={permanentChecked[item.id] || false}
                              onChange={(e) => setPermanentChecked(prev => ({ ...prev, [item.id]: e.target.checked }))}
                              className="h-3.5 w-3.5 rounded border-gray-300"
                            />
                            <Infinity className="h-3 w-3" />
                            Make Permanent
                          </label>
                          <ActionButtons
                            type="tehillim"
                            id={item.id}
                            loading={loading}
                            onApprove={() => handleAction("tehillim", item.id, "approve")}
                            onReject={() => handleAction("tehillim", item.id, "reject")}
                            onEdit={() => setEditing({ type: "tehillim", id: item.id })}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="events">
            {events.length === 0 ? (
              <EmptyState message="No pending events" />
            ) : (
              <div className="grid gap-4">
                {events.map((event) => (
                  <Card key={event.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-lg">{event.title}</CardTitle>
                          {event.organization && (
                            <Badge variant="outline" className="mt-1">
                              {event.organization}
                            </Badge>
                          )}
                        </div>
                        <Badge className="bg-yellow-100 text-yellow-800 shrink-0">
                          {event.approvalStatus === "pending_edit"
                            ? "Edited"
                            : "Pending"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-700 mb-3">
                        {/*
                          formatInstant, not formatDateOnly: events.start_time is
                          a real moment, and the site shows every time in
                          Toronto regardless of where it is being read.
                        */}
                        {event.startTime && (
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-gray-400" />
                            {formatInstant(event.startTime, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                        {event.location && <span>{event.location}</span>}
                      </div>

                      {event.description && (
                        <p className="text-sm text-gray-600 mb-4 line-clamp-4 whitespace-pre-line">
                          {event.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-4 border-t">
                        <span className="text-xs text-gray-400">
                          Submitted{" "}
                          {event.createdAt
                            ? formatInstant(event.createdAt, {
                                month: "numeric",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "N/A"}
                        </span>
                        <ActionButtons
                          type="events"
                          id={event.id}
                          loading={loading}
                          onApprove={() => handleAction("events", event.id, "approve")}
                          onReject={() => handleAction("events", event.id, "reject")}
                          onEdit={() => setEditing({ type: "events", id: event.id })}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-8 text-center">
      <p className="text-gray-500">{message}</p>
    </div>
  );
}

function ActionButtons({
  type,
  id,
  loading,
  onApprove,
  onReject,
  onEdit,
}: {
  type: string;
  id: number;
  loading: { type: string; id: number; action: string } | null;
  onApprove: () => void;
  onReject: () => void;
  /** Correct the item before approving. Absent means the tab is read-only. */
  onEdit?: () => void;
}) {
  const isLoading = loading?.type === type && loading?.id === id;

  return (
    <div className="flex gap-2">
      {onEdit && (
        <Button size="sm" variant="outline" onClick={onEdit} disabled={isLoading}>
          <Pencil className="h-4 w-4 mr-1" />
          Edit
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={onReject}
        disabled={isLoading}
        className="text-red-600 hover:bg-red-50"
      >
        {isLoading && loading?.action === "reject" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <X className="h-4 w-4 mr-1" />
            Reject
          </>
        )}
      </Button>
      <Button
        size="sm"
        onClick={onApprove}
        disabled={isLoading}
        className="bg-green-600 hover:bg-green-700"
      >
        {isLoading && loading?.action === "approve" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Check className="h-4 w-4 mr-1" />
            Approve
          </>
        )}
      </Button>
    </div>
  );
}
