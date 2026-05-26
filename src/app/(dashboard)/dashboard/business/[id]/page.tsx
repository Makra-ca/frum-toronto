"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  Building2,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";
import { MuxVideoUploader } from "@/components/business/MuxVideoUploader";
import { NonProfitApplicationForm } from "@/components/business/NonProfitApplicationForm";
import { ShoutoutSection } from "@/components/business/ShoutoutEditor";

interface BusinessDetail {
  id: number;
  name: string;
  slug: string;
  userId: number | null;
  approvalStatus: string | null;
  isActive: boolean | null;
  // Video
  muxPlaybackId: string | null;
  muxAssetId: string | null;
  muxUploadId: string | null;
  videoStatus: string;
  videoApprovalStatus: string;
  videoRejectionReason: string | null;
  // Non-profit
  isNonProfit: boolean;
  nonProfitDocumentUrl: string | null;
  nonProfitStatus: string;
  nonProfitRejectionReason: string | null;
  // Dining
  diningType: string | null;
  // Plan
  subscriptionPlanId: number | null;
  planName: string | null;
  planSlug: string | null;
  showVideo: boolean | null;
  isElite: boolean;
  // Category
  categoryId: number | null;
  categoryName: string | null;
  categoryIsRestaurant: boolean | null;
  // Subscription
  activeSub: {
    id: number;
    billingCycle: string | null;
    status: string;
  } | null;
}

interface Shoutout {
  id: number;
  businessId: number;
  scheduledDate: string;
  contentHtml: string;
  imageUrl: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
}

export default function BusinessDashboardPage() {
  const params = useParams();
  const businessId = parseInt(params.id as string);

  const [business, setBusiness] = useState<BusinessDetail | null>(null);
  const [shoutouts, setShoutouts] = useState<Shoutout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [businessRes, shoutoutsRes] = await Promise.all([
          fetch(`/api/businesses/${businessId}`),
          fetch(`/api/businesses/${businessId}/shoutouts`),
        ]);

        if (!businessRes.ok) {
          const data = await businessRes.json();
          throw new Error(data.error || "Failed to load business");
        }

        const businessData = await businessRes.json();
        setBusiness(businessData);

        if (shoutoutsRes.ok) {
          const shoutoutsData = await shoutoutsRes.json();
          setShoutouts(shoutoutsData.data || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load business");
      } finally {
        setLoading(false);
      }
    }

    if (!isNaN(businessId)) {
      fetchData();
    } else {
      setError("Invalid business ID");
      setLoading(false);
    }
  }, [businessId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !business) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-600 mb-4">{error || "Business not found"}</p>
          <Link href="/dashboard/business">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to My Businesses
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  function getStatusBadge(status: string | null) {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-amber-100 text-amber-800">
            <Clock className="h-3 w-3 mr-1" />
            Pending Review
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status || "Unknown"}</Badge>;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto py-10 px-4 sm:px-6">
        {/* Back button */}
        <Link href="/dashboard/business" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to My Businesses
        </Link>

        {/* Business header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-xl">{business.name}</CardTitle>
                {business.categoryName && (
                  <p className="text-sm text-gray-500 mt-1">{business.categoryName}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {getStatusBadge(business.approvalStatus)}
                {business.planName && (
                  <Badge variant="outline" className="text-gray-600">
                    {business.planName}
                  </Badge>
                )}
                {business.isNonProfit && business.nonProfitStatus === "verified" && (
                  <Badge className="bg-purple-600 text-white">Non-Profit Verified</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 flex-wrap">
              <Link href={`/directory/business/${business.slug}`} target="_blank">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Public Listing
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* MUX Video Uploader — only for plans with showVideo */}
          {business.showVideo && (
            <MuxVideoUploader
              businessId={business.id}
              videoStatus={business.videoStatus}
              videoApprovalStatus={business.videoApprovalStatus}
              videoRejectionReason={business.videoRejectionReason}
              muxPlaybackId={business.muxPlaybackId}
              onStatusChange={(update) => {
                setBusiness((prev) =>
                  prev
                    ? {
                        ...prev,
                        videoStatus: update.videoStatus,
                        videoApprovalStatus: update.videoApprovalStatus,
                        videoRejectionReason: update.videoRejectionReason,
                        muxPlaybackId: update.muxPlaybackId,
                      }
                    : prev
                );
              }}
            />
          )}

          {/* Non-Profit Application — only when not yet verified */}
          {!business.isNonProfit || business.nonProfitStatus !== "verified" ? (
            <NonProfitApplicationForm
              businessId={business.id}
              nonProfitStatus={business.nonProfitStatus}
              nonProfitRejectionReason={business.nonProfitRejectionReason}
              isNonProfit={business.isNonProfit}
              onStatusChange={(update) => {
                setBusiness((prev) =>
                  prev
                    ? {
                        ...prev,
                        nonProfitStatus: update.nonProfitStatus,
                        isNonProfit: update.isNonProfit,
                        nonProfitRejectionReason: update.nonProfitRejectionReason,
                      }
                    : prev
                );
              }}
            />
          ) : (
            /* Verified non-profit — show badge card */
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-2">
                  <Badge className="bg-purple-600 text-white">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Verified Non-Profit
                  </Badge>
                  <p className="text-sm text-gray-600">
                    Your non-profit status is verified. You may be eligible for discounted subscription rates when renewing.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Newsletter Shoutout — only for Elite plan */}
          {business.isElite && (
            <ShoutoutSection
              businessId={business.id}
              initialShoutouts={shoutouts}
            />
          )}
        </div>
      </div>
    </div>
  );
}
