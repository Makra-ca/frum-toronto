"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Landmark, MapPin, Phone, Clock, ArrowRight, Plus, Loader2 } from "lucide-react";

interface Shul {
  id: number;
  name: string;
  slug: string;
  rabbi: string | null;
  denomination: string | null;
  nusach: string | null;
  hasMinyan: boolean | null;
  address: string | null;
  phone: string | null;
  assignedAt?: string | null;
}

export default function MyShulsPage() {
  const [shuls, setShuls] = useState<Shul[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchShuls() {
      try {
        const response = await fetch("/api/shuls/my-shuls");
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
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Shuls</h1>
            <p className="mt-2 text-gray-600">
              Manage the shuls you are assigned to
            </p>
          </div>
          <Link href="/dashboard/shuls/request">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Request Access to Shul
            </Button>
          </Link>
        </div>

        {shuls.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Landmark className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Shuls Assigned
              </h3>
              <p className="text-gray-500 mb-6">
                You haven&apos;t been assigned to manage any shuls yet.
                Request access to a shul to get started.
              </p>
              <Link href="/dashboard/shuls/request">
                <Button>Request Access to a Shul</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shuls.map((shul) => (
              <Card key={shul.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">
                      {shul.name || `Shul #${shul.id}`}
                    </CardTitle>
                    {shul.hasMinyan && (
                      <Badge className="bg-green-100 text-green-800">
                        Has Minyan
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 mb-4">
                    {shul.address && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="h-4 w-4" />
                        {shul.address}
                      </div>
                    )}
                    {shul.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="h-4 w-4" />
                        {shul.phone}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {shul.denomination && (
                        <Badge variant="outline">{shul.denomination}</Badge>
                      )}
                      {shul.nusach && (
                        <Badge variant="outline">{shul.nusach}</Badge>
                      )}
                    </div>
                    {shul.rabbi && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Rabbi:</span> {shul.rabbi}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/dashboard/shuls/${shul.id}`} className="flex-1">
                      <Button variant="outline" className="w-full">
                        Edit Profile
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                    <Link href={`/dashboard/shuls/${shul.id}/davening`}>
                      <Button variant="outline">
                        <Clock className="h-4 w-4" />
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
