"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2 } from "lucide-react";

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
  hebrewName: string;
  englishName: string | null;
  reason: string | null;
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
  tehillim,
}: ContentApprovalTabsProps) {
  const [simchas, setSimchas] = useState(initialSimchas);
  const [classifieds, setClassifieds] = useState(initialClassifieds);
  const [loading, setLoading] = useState<{ type: string; id: number; action: string } | null>(null);

  const handleAction = async (
    type: "simchas" | "classifieds",
    id: number,
    action: "approve" | "reject"
  ) => {
    setLoading({ type, id, action });

    try {
      const response = await fetch(`/api/admin/content/${type}/${id}/${action}`, {
        method: "POST",
      });

      if (response.ok) {
        if (type === "simchas") {
          setSimchas((prev) =>
            prev.map((item) =>
              item.id === id
                ? { ...item, approvalStatus: action === "approve" ? "approved" : "rejected" }
                : item
            )
          );
        } else {
          setClassifieds((prev) =>
            prev.map((item) =>
              item.id === id
                ? { ...item, approvalStatus: action === "approve" ? "approved" : "rejected" }
                : item
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

  return (
    <Tabs defaultValue="simchas" className="w-full">
      <TabsList className="grid w-full grid-cols-3 mb-6">
        <TabsTrigger value="simchas">
          Simchas ({simchas.filter((s) => s.approvalStatus === "pending").length})
        </TabsTrigger>
        <TabsTrigger value="classifieds">
          Classifieds ({classifieds.filter((c) => c.approvalStatus === "pending").length})
        </TabsTrigger>
        <TabsTrigger value="tehillim">Tehillim ({tehillim.length})</TabsTrigger>
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
        <Card>
          <CardHeader>
            <CardTitle>Active Tehillim List</CardTitle>
          </CardHeader>
          <CardContent>
            {tehillim.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No tehillim entries</p>
            ) : (
              <div className="divide-y">
                {tehillim.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{item.hebrewName}</p>
                      {item.englishName && (
                        <p className="text-sm text-gray-500">{item.englishName}</p>
                      )}
                      {item.reason && (
                        <p className="text-xs text-gray-400 mt-1">{item.reason}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "N/A"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
