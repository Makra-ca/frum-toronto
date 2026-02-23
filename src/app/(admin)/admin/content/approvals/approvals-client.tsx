"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2, Infinity, Clock } from "lucide-react";
import { toast } from "sonner";

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

interface Counts {
  simchas: number;
  classifieds: number;
  tehillim: number;
  total: number;
}

interface ApprovalsClientProps {
  simchas: Simcha[];
  classifieds: Classified[];
  tehillim: Tehillim[];
  counts: Counts;
}

export function ApprovalsClient({
  simchas: initialSimchas,
  classifieds: initialClassifieds,
  tehillim: initialTehillim,
  counts,
}: ApprovalsClientProps) {
  const [simchas, setSimchas] = useState(initialSimchas);
  const [classifieds, setClassifieds] = useState(initialClassifieds);
  const [tehillimList, setTehillimList] = useState(initialTehillim);
  const [loading, setLoading] = useState<{ type: string; id: number; action: string } | null>(null);
  const [permanentChecked, setPermanentChecked] = useState<Record<number, boolean>>({});

  const handleAction = async (
    type: "simchas" | "classifieds" | "tehillim",
    id: number,
    action: "approve" | "reject"
  ) => {
    setLoading({ type, id, action });

    try {
      const isPermanent = type === "tehillim" && action === "approve" ? permanentChecked[id] || false : undefined;

      const response = await fetch(`/api/admin/content/${type}/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPermanent }),
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
      {counts.total === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Check className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">All Caught Up!</h3>
            <p className="text-gray-500">No pending content to review.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="simchas" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="simchas">
              Simchas ({simchas.length})
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
                          {simcha.createdAt ? new Date(simcha.createdAt).toLocaleDateString() : "N/A"}
                        </span>
                        <ActionButtons
                          type="simchas"
                          id={simcha.id}
                          loading={loading}
                          onApprove={() => handleAction("simchas", simcha.id, "approve")}
                          onReject={() => handleAction("simchas", simcha.id, "reject")}
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
                          {classified.createdAt ? new Date(classified.createdAt).toLocaleDateString() : "N/A"}
                        </span>
                        <ActionButtons
                          type="classifieds"
                          id={classified.id}
                          loading={loading}
                          onApprove={() => handleAction("classifieds", classified.id, "approve")}
                          onReject={() => handleAction("classifieds", classified.id, "reject")}
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
                          Expires: {new Date(item.expiresAt).toLocaleDateString()}
                        </p>
                      )}
                      <div className="flex items-center justify-between pt-4 border-t">
                        <span className="text-xs text-gray-400">
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "N/A"}
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
                          />
                        </div>
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
}: {
  type: string;
  id: number;
  loading: { type: string; id: number; action: string } | null;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isLoading = loading?.type === type && loading?.id === id;

  return (
    <div className="flex gap-2">
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
