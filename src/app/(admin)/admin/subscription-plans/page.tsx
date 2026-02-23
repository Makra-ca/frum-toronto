"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CreditCard,
  Edit2,
  Save,
  Loader2,
  Check,
  X,
  DollarSign,
  RefreshCw,
  Plus,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface SubscriptionPlan {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  priceMonthly: string | null;
  priceYearly: string | null;
  maxCategories: number;
  maxPhotos: number;
  showDescription: boolean;
  showContactName: boolean;
  showEmail: boolean;
  showWebsite: boolean;
  showHours: boolean;
  showMap: boolean;
  showLogo: boolean;
  showSocialLinks: boolean;
  showKosherBadge: boolean;
  isFeatured: boolean;
  priorityInSearch: boolean;
  paypalPlanIdMonthly: string | null;
  paypalPlanIdYearly: string | null;
  paypalPlanIdMonthlySandbox: string | null;
  paypalPlanIdYearlySandbox: string | null;
  displayOrder: number;
  isActive: boolean;
}

interface SyncResult {
  planId: number;
  planName: string;
  action: string;
  paypalPlanIdMonthly?: string;
  paypalPlanIdYearly?: string;
  error?: string;
}

const FEATURE_LABELS: Record<string, string> = {
  showDescription: "Description",
  showContactName: "Contact Name",
  showEmail: "Email",
  showWebsite: "Website",
  showHours: "Business Hours",
  showMap: "Map/Directions",
  showLogo: "Logo",
  showSocialLinks: "Social Links",
  showKosherBadge: "Kosher Badge",
  isFeatured: "Featured Placement",
  priorityInSearch: "Priority in Search",
};

const DEFAULT_PLAN: Omit<SubscriptionPlan, "id"> = {
  name: "",
  slug: "",
  description: "",
  priceMonthly: "0",
  priceYearly: "0",
  maxCategories: 1,
  maxPhotos: 0,
  showDescription: false,
  showContactName: false,
  showEmail: false,
  showWebsite: false,
  showHours: false,
  showMap: false,
  showLogo: false,
  showSocialLinks: false,
  showKosherBadge: false,
  isFeatured: false,
  priorityInSearch: false,
  paypalPlanIdMonthly: null,
  paypalPlanIdYearly: null,
  paypalPlanIdMonthlySandbox: null,
  paypalPlanIdYearlySandbox: null,
  displayOrder: 0,
  isActive: true,
};

export default function SubscriptionPlansPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newPlan, setNewPlan] = useState<Omit<SubscriptionPlan, "id">>(DEFAULT_PLAN);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<SyncResult[] | null>(null);
  const [paypalMode, setPaypalMode] = useState<string>("");

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await fetch("/api/admin/subscription-plans");
      const data = await res.json();
      setPlans(data.plans || []);
    } catch (error) {
      console.error("Error fetching plans:", error);
      toast.error("Failed to load subscription plans");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingPlan) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/subscription-plans/${editingPlan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingPlan),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update plan");
      }

      toast.success("Plan updated successfully");
      setEditingPlan(null);
      fetchPlans();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update plan");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!newPlan.name.trim()) {
      toast.error("Plan name is required");
      return;
    }

    // Generate slug from name
    const slug = newPlan.name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");

    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/subscription-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newPlan, slug }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create plan");
      }

      toast.success("Plan created successfully");
      setIsCreating(false);
      setNewPlan(DEFAULT_PLAN);
      fetchPlans();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create plan");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncToPayPal = async () => {
    setIsSyncing(true);
    setSyncResults(null);

    try {
      const res = await fetch("/api/admin/subscription-plans/sync-paypal", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to sync to PayPal");
      }

      setPaypalMode(data.mode);
      setSyncResults(data.results);
      toast.success(`Synced to PayPal (${data.mode} mode)`);
      fetchPlans();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sync to PayPal");
    } finally {
      setIsSyncing(false);
    }
  };

  const formatPrice = (price: string | null) => {
    if (!price || parseFloat(price) === 0) return "Free";
    return `$${parseFloat(price).toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CreditCard className="h-8 w-8 text-gray-700" />
          <div>
            <h1 className="text-2xl font-bold">Subscription Plans</h1>
            <p className="text-gray-500">Manage business listing subscription tiers and pricing</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsCreating(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Plan
          </Button>
          <Button onClick={handleSyncToPayPal} disabled={isSyncing}>
            {isSyncing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync to PayPal
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Sync Results */}
      {syncResults && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Check className="h-5 w-5 text-green-600" />
            <span className="font-semibold text-green-800">
              Synced to PayPal ({paypalMode} mode)
            </span>
          </div>
          <div className="space-y-1">
            {syncResults.map((result) => (
              <div key={result.planId} className="text-sm text-green-700 flex items-center gap-2">
                {result.error ? (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                ) : (
                  <Check className="h-4 w-4 text-green-600" />
                )}
                <span>
                  <strong>{result.planName}:</strong> {result.action}
                  {result.error && <span className="text-red-600"> - {result.error}</span>}
                </span>
              </div>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => setSyncResults(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <strong>Note:</strong> Click &quot;Sync to PayPal&quot; to automatically create subscription plans in PayPal.
        Plans are created based on the current PAYPAL_MODE (sandbox/live) in your environment.
        Changing prices will create NEW PayPal plans - existing subscribers keep their current pricing.
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card key={plan.id} className={`relative ${plan.slug === "premium" ? "border-2 border-blue-500" : ""}`}>
            {plan.slug === "premium" && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-blue-500">Most Popular</Badge>
              </div>
            )}
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-xl">{plan.name}</CardTitle>
              <div className="mt-2">
                <span className="text-3xl font-bold">{formatPrice(plan.priceMonthly)}</span>
                {plan.priceMonthly && parseFloat(plan.priceMonthly) > 0 && (
                  <span className="text-gray-500">/month</span>
                )}
              </div>
              {plan.priceYearly && parseFloat(plan.priceYearly) > 0 && (
                <p className="text-sm text-gray-500">
                  or {formatPrice(plan.priceYearly)}/year (save ${(parseFloat(plan.priceMonthly || "0") * 12 - parseFloat(plan.priceYearly)).toFixed(0)})
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600 text-center min-h-[40px]">
                {plan.description}
              </p>

              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-2">Limits:</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Categories:</span>
                    <span className="font-medium">{plan.maxCategories}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Photos:</span>
                    <span className="font-medium">{plan.maxPhotos === 999 ? "Unlimited" : plan.maxPhotos}</span>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-2">Features:</h4>
                <div className="space-y-1">
                  {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      {plan[key as keyof SubscriptionPlan] ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <X className="h-4 w-4 text-gray-300" />
                      )}
                      <span className={plan[key as keyof SubscriptionPlan] ? "text-gray-700" : "text-gray-400"}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setEditingPlan(plan)}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit Plan
                </Button>
              </div>

              {!plan.isActive && (
                <Badge variant="secondary" className="w-full justify-center">
                  Inactive
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Plan Dialog */}
      <Dialog open={!!editingPlan} onOpenChange={(open) => !open && setEditingPlan(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {editingPlan?.name} Plan</DialogTitle>
            <DialogDescription>
              Update pricing and features for this subscription tier
            </DialogDescription>
          </DialogHeader>

          {editingPlan && (
            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Plan Name</Label>
                  <Input
                    value={editingPlan.name}
                    onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug (URL-friendly)</Label>
                  <Input
                    value={editingPlan.slug}
                    onChange={(e) => setEditingPlan({ ...editingPlan, slug: e.target.value })}
                    disabled
                    className="bg-gray-100"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editingPlan.description || ""}
                  onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                  rows={2}
                />
              </div>

              {/* Pricing */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Pricing
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Monthly Price ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingPlan.priceMonthly || "0"}
                      onChange={(e) => setEditingPlan({ ...editingPlan, priceMonthly: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Yearly Price ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingPlan.priceYearly || "0"}
                      onChange={(e) => setEditingPlan({ ...editingPlan, priceYearly: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* PayPal Integration */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">PayPal Plan IDs</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Monthly Plan ID</Label>
                    <Input
                      placeholder="P-XXXXXXXXXXXXX"
                      value={editingPlan.paypalPlanIdMonthly || ""}
                      onChange={(e) => setEditingPlan({ ...editingPlan, paypalPlanIdMonthly: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Yearly Plan ID</Label>
                    <Input
                      placeholder="P-XXXXXXXXXXXXX"
                      value={editingPlan.paypalPlanIdYearly || ""}
                      onChange={(e) => setEditingPlan({ ...editingPlan, paypalPlanIdYearly: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Limits */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Limits</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Max Categories</Label>
                    <Input
                      type="number"
                      min="1"
                      value={editingPlan.maxCategories}
                      onChange={(e) => setEditingPlan({ ...editingPlan, maxCategories: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Photos (999 = unlimited)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={editingPlan.maxPhotos}
                      onChange={(e) => setEditingPlan({ ...editingPlan, maxPhotos: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>

              {/* Feature Toggles */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Features</h4>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between">
                      <Label htmlFor={key} className="cursor-pointer">{label}</Label>
                      <Switch
                        id={key}
                        checked={editingPlan[key as keyof SubscriptionPlan] as boolean}
                        onCheckedChange={(checked) => setEditingPlan({ ...editingPlan, [key]: checked })}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="isActive">Active</Label>
                    <p className="text-sm text-gray-500">Inactive plans are hidden from users</p>
                  </div>
                  <Switch
                    id="isActive"
                    checked={editingPlan.isActive}
                    onCheckedChange={(checked) => setEditingPlan({ ...editingPlan, isActive: checked })}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPlan(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Plan Dialog */}
      <Dialog open={isCreating} onOpenChange={(open) => !open && setIsCreating(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Plan</DialogTitle>
            <DialogDescription>
              Add a new subscription tier for business listings
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-2">
              <Label>Plan Name *</Label>
              <Input
                placeholder="e.g., Enterprise"
                value={newPlan.name}
                onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Brief description of what this plan offers"
                value={newPlan.description || ""}
                onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                rows={2}
              />
            </div>

            {/* Pricing */}
            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Pricing
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Monthly Price ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newPlan.priceMonthly || "0"}
                    onChange={(e) => setNewPlan({ ...newPlan, priceMonthly: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Yearly Price ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newPlan.priceYearly || "0"}
                    onChange={(e) => setNewPlan({ ...newPlan, priceYearly: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Limits */}
            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3">Limits</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Categories</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newPlan.maxCategories}
                    onChange={(e) => setNewPlan({ ...newPlan, maxCategories: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Photos (999 = unlimited)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={newPlan.maxPhotos}
                    onChange={(e) => setNewPlan({ ...newPlan, maxPhotos: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            {/* Feature Toggles */}
            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3">Features</h4>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label htmlFor={`new-${key}`} className="cursor-pointer">{label}</Label>
                    <Switch
                      id={`new-${key}`}
                      checked={newPlan[key as keyof typeof newPlan] as boolean}
                      onCheckedChange={(checked) => setNewPlan({ ...newPlan, [key]: checked })}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Display Order */}
            <div className="border-t pt-4">
              <div className="space-y-2">
                <Label>Display Order</Label>
                <Input
                  type="number"
                  min="0"
                  value={newPlan.displayOrder}
                  onChange={(e) => setNewPlan({ ...newPlan, displayOrder: parseInt(e.target.value) || 0 })}
                />
                <p className="text-sm text-gray-500">Lower numbers appear first on the pricing page</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreating(false); setNewPlan(DEFAULT_PLAN); }}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Plan
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
