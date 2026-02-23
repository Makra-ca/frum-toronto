"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  MapPin,
  Phone,
  Globe,
  Eye,
  ArrowRight,
  Plus,
  Loader2,
  ExternalLink,
  Sparkles,
  ArrowUpRight,
  CreditCard,
} from "lucide-react";

interface Business {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  logoUrl: string | null;
  isKosher: boolean | null;
  approvalStatus: string | null;
  isActive: boolean | null;
  viewCount: number | null;
  createdAt: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  planId: number | null;
  planName: string | null;
  planSlug: string | null;
}

export default function MyBusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBusinesses() {
      try {
        const response = await fetch("/api/businesses/my-businesses");
        if (response.ok) {
          const data = await response.json();
          setBusinesses(data);
        }
      } catch (error) {
        console.error("Error fetching businesses:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchBusinesses();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending Review</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status || "Unknown"}</Badge>;
    }
  };

  const getPlanBadge = (planSlug: string | null, planName: string | null) => {
    if (!planSlug || planSlug === "free") {
      return <Badge variant="outline" className="text-gray-600">Free</Badge>;
    }
    if (planSlug === "premium") {
      return <Badge className="bg-blue-100 text-blue-700">{planName}</Badge>;
    }
    return <Badge className="bg-green-100 text-green-700">{planName}</Badge>;
  };

  const hasFreePlanBusinesses = businesses.some(
    (b) => !b.planSlug || b.planSlug === "free"
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Businesses</h1>
            <p className="mt-2 text-gray-600">
              Manage your business listings on FrumToronto
            </p>
          </div>
          <Link href="/dashboard/business/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add New Business
            </Button>
          </Link>
        </div>

        {/* Upgrade Prompt for Free Plan Users */}
        {hasFreePlanBusinesses && businesses.length > 0 && (
          <Card className="mb-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white border-0">
            <CardContent className="py-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="bg-white/20 rounded-lg p-3">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">
                      Boost Your Business Visibility
                    </h3>
                    <p className="text-blue-100 mt-1">
                      Upgrade to a paid plan for featured placement, full contact details,
                      business hours, social links, and priority search ranking.
                    </p>
                  </div>
                </div>
                <Link href="/dashboard/business/new">
                  <Button className="bg-white text-blue-600 hover:bg-blue-50">
                    View Plans
                    <ArrowUpRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {businesses.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Businesses Yet
              </h3>
              <p className="text-gray-500 mb-6">
                You haven&apos;t registered any businesses yet.
                Register your business to get listed in our directory.
              </p>
              <Link href="/dashboard/business/new">
                <Button>Register Your Business</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {businesses.map((business) => (
              <Card key={business.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">
                      {business.name || `Business #${business.id}`}
                    </CardTitle>
                    {getStatusBadge(business.approvalStatus)}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {business.categoryName && (
                      <p className="text-sm text-gray-500">{business.categoryName}</p>
                    )}
                    <span className="text-gray-300">•</span>
                    <div className="flex items-center gap-1">
                      <CreditCard className="h-3 w-3 text-gray-400" />
                      {getPlanBadge(business.planSlug, business.planName)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 mb-4">
                    {business.address && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">
                          {business.address}
                          {business.city && `, ${business.city}`}
                        </span>
                      </div>
                    )}
                    {business.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="h-4 w-4 flex-shrink-0" />
                        {business.phone}
                      </div>
                    )}
                    {business.website && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Globe className="h-4 w-4 flex-shrink-0" />
                        <a
                          href={business.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline truncate"
                        >
                          {business.website.replace(/^https?:\/\//, "")}
                        </a>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Eye className="h-4 w-4 flex-shrink-0" />
                      {business.viewCount || 0} views
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {business.isKosher && (
                        <Badge variant="outline" className="text-green-700 border-green-300">
                          Kosher
                        </Badge>
                      )}
                      {!business.isActive && (
                        <Badge variant="outline" className="text-red-700 border-red-300">
                          Inactive
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/directory/business/${business.slug}`} className="flex-1">
                      <Button variant="outline" className="w-full">
                        View Listing
                        <ExternalLink className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                    {(!business.planSlug || business.planSlug === "free") && (
                      <Link href="/dashboard/business/new">
                        <Button variant="default" size="icon" title="Upgrade Plan">
                          <ArrowUpRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
