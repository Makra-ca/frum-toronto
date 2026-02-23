"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2, Infinity, Trash2 } from "lucide-react";

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
  isPermanent: boolean | null;
  createdAt: Date | null;
}

interface ContentApprovalTabsProps {
  simchas: Simcha[];
  classifieds: Classified[];
  tehillim: Tehillim[];
}

export function ContentApprovalTabs({
  simchas: initialSimchas,
  classifieds: initialClassifieds,
  tehillim: initialTehillim,
}: ContentApprovalTabsProps) {
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
        const newStatus = action === "approve" ? "approved" : "rejected";
        if (type === "simchas") {
          setSimchas((prev) =>
            prev.map((item) =>
              item.id === id ? { ...item, approvalStatus: newStatus } : item
            )
          );
        } else if (type === "classifieds") {
          setClassifieds((prev) =>
            prev.map((item) =>
              item.id === id ? { ...item, approvalStatus: newStatus } : item
            )
          );
        } else if (type === "tehillim") {
          setTehillimList((prev) =>
            prev.map((item) =>
              item.id === id ? { ...item, approvalStatus: newStatus, isPermanent: isPermanent || item.isPermanent } : item
            )
          );
        }
      }
    } catch (error) {
      console.error("Failed to update content:", error);
    } finally {
      setLoading(null);
    }
  };

  const handleDeleteTehillim = async (id: number) => {
    if (!confirm("Are you sure you want to permanently delete this tehillim entry?")) return;

    setLoading({ type: "tehillim", id, action: "delete" });
    try {
      const response = await fetch(`/api/admin/tehillim/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setTehillimList((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete tehillim:", error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Tabs defaultValue="simchas" className="w-full">
      <TabsList className="grid w-full grid-cols-3 mb-6">
        <TabsTrigger value="simchas">
          Simchas ({simchas.filter((s) => s.approvalStatus === "pending").length})
        </TabsTrigger>
        <TabsTrigger value="classifieds">
          Classifieds ({classifieds.filter((c) => c.approvalStatus === "pending").length})
        </TabsTrigger>
        <TabsTrigger value="tehillim">
          Tehillim ({tehillimList.filter((t) => t.approvalStatus === "pending").length} pending / {tehillimList.length} total)
        </TabsTrigger>
      </TabsList>

      <TabsContent value="simchas">
        {simchas.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">No pending simchas</p>
          </div>
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
                    <Badge
                      className={
                        simcha.approvalStatus === "approved"
                          ? "bg-green-100 text-green-800"
                          : simcha.approvalStatus === "rejected"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }
                    >
                      {simcha.approvalStatus}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4">{simcha.announcement}</p>
                  <div className="flex items-center justify-between pt-4 border-t">
                    <span className="text-xs text-gray-400">
                      {simcha.createdAt ? new Date(simcha.createdAt).toLocaleDateString() : "N/A"}
                    </span>
                    {simcha.approvalStatus === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAction("simchas", simcha.id, "reject")}
                          disabled={loading?.id === simcha.id}
                          className="text-red-600 hover:bg-red-50"
                        >
                          {loading?.id === simcha.id && loading?.action === "reject" ? (
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
                          onClick={() => handleAction("simchas", simcha.id, "approve")}
                          disabled={loading?.id === simcha.id}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {loading?.id === simcha.id && loading?.action === "approve" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="classifieds">
        {classifieds.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">No pending classifieds</p>
          </div>
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
                    <Badge
                      className={
                        classified.approvalStatus === "approved"
                          ? "bg-green-100 text-green-800"
                          : classified.approvalStatus === "rejected"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }
                    >
                      {classified.approvalStatus}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {classified.description}
                  </p>
                  <div className="flex items-center justify-between pt-4 border-t">
                    <span className="text-xs text-gray-400">
                      {classified.createdAt
                        ? new Date(classified.createdAt).toLocaleDateString()
                        : "N/A"}
                    </span>
                    {classified.approvalStatus === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAction("classifieds", classified.id, "reject")}
                          disabled={loading?.id === classified.id}
                          className="text-red-600 hover:bg-red-50"
                        >
                          {loading?.id === classified.id && loading?.action === "reject" ? (
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
                          onClick={() => handleAction("classifieds", classified.id, "approve")}
                          disabled={loading?.id === classified.id}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {loading?.id === classified.id && loading?.action === "approve" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="tehillim">
        {tehillimList.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">No tehillim entries on the list</p>
          </div>
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
                    <Badge
                      className={
                        item.approvalStatus === "approved"
                          ? "bg-green-100 text-green-800"
                          : item.approvalStatus === "rejected"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }
                    >
                      {item.approvalStatus}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {item.reason && (
                    <p className="text-sm text-gray-600 mb-2">{item.reason}</p>
                  )}
                  {item.expiresAt && (
                    <p className="text-xs text-gray-500 mb-4">
                      Expires: {new Date(item.expiresAt).toLocaleDateString()}
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-4 border-t">
                    <span className="text-xs text-gray-400">
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "N/A"}
                    </span>
                    <div className="flex flex-col items-end gap-2">
                      {item.approvalStatus === "pending" && (
                        <>
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
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAction("tehillim", item.id, "reject")}
                              disabled={loading?.id === item.id}
                              className="text-red-600 hover:bg-red-50"
                            >
                              {loading?.id === item.id && loading?.action === "reject" ? (
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
                              onClick={() => handleAction("tehillim", item.id, "approve")}
                              disabled={loading?.id === item.id}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {loading?.id === item.id && loading?.action === "approve" ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Check className="h-4 w-4 mr-1" />
                                  Approve
                                </>
                              )}
                            </Button>
                          </div>
                        </>
                      )}
                      {/* Delete button - always visible */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteTehillim(item.id)}
                        disabled={loading?.id === item.id}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        {loading?.id === item.id && loading?.action === "delete" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
