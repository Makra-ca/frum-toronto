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
          <Link href="/register-business">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add New Business
            </Button>
          </Link>
        </div>

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
              <Link href="/register-business">
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
                  {business.categoryName && (
                    <p className="text-sm text-gray-500">{business.categoryName}</p>
                  )}
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
