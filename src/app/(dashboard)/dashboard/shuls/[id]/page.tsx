"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";

interface ShulData {
  id: number;
  businessId: number | null;
  rabbi: string | null;
  denomination: string | null;
  nusach: string | null;
  hasMinyan: boolean | null;
  business: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    address: string | null;
    city: string | null;
    postalCode: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    logoUrl: string | null;
    hours: Record<string, unknown> | null;
    socialLinks: Record<string, unknown> | null;
  } | null;
}

const DENOMINATIONS = [
  "Orthodox",
  "Modern Orthodox",
  "Chabad",
  "Sephardic",
  "Conservative",
  "Reform",
  "Traditional",
  "Other",
];

const NUSACH_OPTIONS = [
  "Ashkenaz",
  "Sefard",
  "Ari",
  "Edot HaMizrach",
  "Temani",
  "Other",
];

export default function EditShulPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [shul, setShul] = useState<ShulData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    // Shul data
    rabbi: "",
    denomination: "",
    nusach: "",
    hasMinyan: false,
    // Business data
    name: "",
    description: "",
    address: "",
    city: "",
    postalCode: "",
    phone: "",
    email: "",
    website: "",
  });

  useEffect(() => {
    async function fetchShul() {
      try {
        const response = await fetch(`/api/shuls/${id}`);
        if (response.ok) {
          const data = await response.json();
          setShul(data);
          setFormData({
            rabbi: data.rabbi || "",
            denomination: data.denomination || "",
            nusach: data.nusach || "",
            hasMinyan: data.hasMinyan || false,
            name: data.business?.name || "",
            description: data.business?.description || "",
            address: data.business?.address || "",
            city: data.business?.city || "",
            postalCode: data.business?.postalCode || "",
            phone: data.business?.phone || "",
            email: data.business?.email || "",
            website: data.business?.website || "",
          });
        } else if (response.status === 403) {
          toast.error("You don't have permission to manage this shul");
          router.push("/dashboard/shuls");
        } else {
          toast.error("Failed to load shul");
        }
      } catch (error) {
        console.error("Error fetching shul:", error);
        toast.error("Failed to load shul");
      } finally {
        setLoading(false);
      }
    }

    fetchShul();
  }, [id, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(`/api/shuls/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shulData: {
            rabbi: formData.rabbi || null,
            denomination: formData.denomination || null,
            nusach: formData.nusach || null,
            hasMinyan: formData.hasMinyan,
          },
          businessData: {
            name: formData.name,
            description: formData.description || null,
            address: formData.address || null,
            city: formData.city || null,
            postalCode: formData.postalCode || null,
            phone: formData.phone || null,
            email: formData.email || null,
            website: formData.website || null,
          },
        }),
      });

      if (response.ok) {
        toast.success("Shul updated successfully");
      } else {
        const data = await response.json();
        throw new Error(data.error || "Failed to update shul");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update shul");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!shul) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Shul not found</h2>
          <Link href="/dashboard/shuls">
            <Button className="mt-4">Back to My Shuls</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/dashboard/shuls"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to My Shuls
          </Link>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Edit {shul.business?.name || "Shul"}
              </h1>
              <p className="mt-2 text-gray-600">
                Update your shul&apos;s profile information
              </p>
            </div>
            <Link href={`/dashboard/shuls/${id}/davening`}>
              <Button variant="outline">
                <Clock className="h-4 w-4 mr-2" />
                Manage Davening Times
              </Button>
            </Link>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Shul Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={4}
                  placeholder="Tell the community about your shul..."
                />
              </div>
              <div>
                <Label htmlFor="rabbi">Rabbi</Label>
                <Input
                  id="rabbi"
                  value={formData.rabbi}
                  onChange={(e) =>
                    setFormData({ ...formData, rabbi: e.target.value })
                  }
                  placeholder="Rabbi's name"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="denomination">Denomination</Label>
                  <Select
                    value={formData.denomination}
                    onValueChange={(value) =>
                      setFormData({ ...formData, denomination: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select denomination" />
                    </SelectTrigger>
                    <SelectContent>
                      {DENOMINATIONS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="nusach">Nusach</Label>
                  <Select
                    value={formData.nusach}
                    onValueChange={(value) =>
                      setFormData({ ...formData, nusach: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select nusach" />
                    </SelectTrigger>
                    <SelectContent>
                      {NUSACH_OPTIONS.map((n) => (
                        <SelectItem key={n} value={n}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="hasMinyan"
                  checked={formData.hasMinyan}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, hasMinyan: checked })
                  }
                />
                <Label htmlFor="hasMinyan">Has Regular Minyan</Label>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  placeholder="Street address"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                    placeholder="City"
                  />
                </div>
                <div>
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <Input
                    id="postalCode"
                    value={formData.postalCode}
                    onChange={(e) =>
                      setFormData({ ...formData, postalCode: e.target.value })
                    }
                    placeholder="Postal code"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="Phone number"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="Email address"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  value={formData.website}
                  onChange={(e) =>
                    setFormData({ ...formData, website: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
