"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, Phone, Users, Clock } from "lucide-react";
import { DENOMINATIONS, NUSACH_OPTIONS } from "@/lib/validations/content";

interface Shul {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  rabbi: string | null;
  denomination: string | null;
  nusach: string | null;
  hasMinyan: boolean | null;
}

export default function ShulsPage() {
  const [shuls, setShuls] = useState<Shul[]>([]);
  const [loading, setLoading] = useState(true);
  const [denominationFilter, setDenominationFilter] = useState<string>("");
  const [nusachFilter, setNusachFilter] = useState<string>("");

  useEffect(() => {
    async function fetchShuls() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (denominationFilter) params.append("denomination", denominationFilter);
        if (nusachFilter) params.append("nusach", nusachFilter);

        const response = await fetch(`/api/shuls?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setShuls(data);
        }
      } catch (error) {
        console.error("Error fetching shuls:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchShuls();
  }, [denominationFilter, nusachFilter]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-blue-900 text-white py-12">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Shul Directory</h1>
          <p className="text-blue-200 text-lg">
            Find synagogues and davening times in the Toronto Jewish community
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">Filter by:</span>
            </div>
            <Select value={denominationFilter || "all"} onValueChange={(v) => setDenominationFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Denomination" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Denominations</SelectItem>
                {DENOMINATIONS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={nusachFilter || "all"} onValueChange={(v) => setNusachFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Nusach" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Nusach</SelectItem>
                {NUSACH_OPTIONS.map((n) => (
                  <SelectItem key={n.value} value={n.value}>
                    {n.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(denominationFilter || nusachFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDenominationFilter("");
                  setNusachFilter("");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Shuls Grid */}
      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow animate-pulse">
                <div className="p-6">
                  <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : shuls.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-semibold text-gray-600 mb-2">No shuls found</h2>
            <p className="text-gray-500">
              {denominationFilter || nusachFilter
                ? "Try adjusting your filters"
                : "Check back soon for updates"}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shuls.map((shul) => (
              <Link
                key={shul.id}
                href={`/shuls/${shul.slug}`}
                className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <h2 className="text-xl font-semibold text-gray-900">{shul.name}</h2>
                    {shul.hasMinyan && (
                      <Badge className="bg-green-100 text-green-800 shrink-0">
                        Minyan
                      </Badge>
                    )}
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {shul.denomination && (
                      <Badge variant="secondary" className="capitalize">
                        {shul.denomination.replace("-", " ")}
                      </Badge>
                    )}
                    {shul.nusach && (
                      <Badge variant="outline" className="capitalize">
                        {shul.nusach.replace("-", " ")}
                      </Badge>
                    )}
                  </div>

                  {/* Rabbi */}
                  {shul.rabbi && (
                    <p className="text-sm text-gray-600 mb-3">
                      <span className="font-medium">Rabbi:</span> {shul.rabbi}
                    </p>
                  )}

                  {/* Address */}
                  {shul.address && (
                    <div className="flex items-start gap-2 text-sm text-gray-500 mb-2">
                      <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{shul.address}{shul.city && `, ${shul.city}`}</span>
                    </div>
                  )}

                  {/* Phone */}
                  {shul.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Phone className="h-4 w-4" />
                      <span>{shul.phone}</span>
                    </div>
                  )}

                  {/* View Details CTA */}
                  <div className="mt-4 pt-4 border-t flex items-center justify-between">
                    <span className="text-sm text-blue-600 font-medium flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      View Davening Times
                    </span>
                    <span className="text-blue-600">&rarr;</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Results count */}
        {!loading && shuls.length > 0 && (
          <div className="mt-8 text-center text-sm text-gray-500">
            Showing {shuls.length} shul{shuls.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
