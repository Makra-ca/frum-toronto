"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  CreditCard,
  ArrowLeft,
  Loader2,
  Building2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface SubscriptionPlan {
  id: number;
  name: string;
  slug: string;
  priceMonthly: string | null;
  priceYearly: string | null;
}

interface Business {
  id: number;
  name: string;
  subscriptionPlanId: number | null;
  approvalStatus: string;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function BusinessPaymentPage({ params }: PageProps) {
  const router = useRouter();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    params.then(({ id }) => {
      setBusinessId(id);
      fetchData(id);
    });
  }, [params]);

  const fetchData = async (id: string) => {
    try {
      // Fetch business details
      const businessRes = await fetch(`/api/businesses/${id}`);
      if (!businessRes.ok) {
        toast.error("Business not found");
        router.push("/dashboard/business");
        return;
      }
      const businessData = await businessRes.json();
      setBusiness(businessData);

      // Fetch plan details if business has one
      if (businessData.subscriptionPlanId) {
        const plansRes = await fetch("/api/subscription-plans");
        const plansData = await plansRes.json();
        const selectedPlan = plansData.plans?.find(
          (p: SubscriptionPlan) => p.id === businessData.subscriptionPlanId
        );
        setPlan(selectedPlan || null);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load business details");
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: string | null) => {
    if (!price || parseFloat(price) === 0) return "Free";
    return `$${parseFloat(price).toFixed(2)}`;
  };

  const handlePayment = async () => {
    if (!business || !plan) return;

    setIsProcessing(true);
    try {
      const res = await fetch("/api/paypal/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          businessId: business.id,
          billingCycle,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create subscription");
      }

      if (data.approvalUrl) {
        window.location.href = data.approvalUrl;
      } else {
        throw new Error("No approval URL received from PayPal");
      }
    } catch (error) {
      console.error("Payment error:", error);
      toast.error(error instanceof Error ? error.message : "Payment failed");
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!business || !plan) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-lg mx-auto">
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                No Payment Required
              </h2>
              <p className="text-gray-600 mb-6">
                This business doesn&apos;t require payment or wasn&apos;t found.
              </p>
              <Link href="/dashboard/business">
                <Button>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Businesses
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // If business is not pending_payment, show different message
  if (business.approvalStatus !== "pending_payment") {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-lg mx-auto">
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Payment Already Complete
              </h2>
              <p className="text-gray-600 mb-6">
                This business listing has already been paid for and is{" "}
                {business.approvalStatus === "approved" ? "live" : "pending review"}.
              </p>
              <Link href="/dashboard/business">
                <Button>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Businesses
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const price = billingCycle === "monthly" ? plan.priceMonthly : plan.priceYearly;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Complete Your Payment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Business Info */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">Business</p>
              <p className="font-medium text-gray-900">{business.name}</p>
            </div>

            {/* Billing Cycle Toggle */}
            <div className="flex items-center justify-center gap-4">
              <span
                className={`text-sm ${billingCycle === "monthly" ? "font-semibold" : "text-gray-500"}`}
              >
                Monthly
              </span>
              <Switch
                checked={billingCycle === "yearly"}
                onCheckedChange={(checked) =>
                  setBillingCycle(checked ? "yearly" : "monthly")
                }
              />
              <span
                className={`text-sm ${billingCycle === "yearly" ? "font-semibold" : "text-gray-500"}`}
              >
                Yearly
                <Badge variant="secondary" className="ml-2">
                  Save 2 months
                </Badge>
              </span>
            </div>

            {/* Price Summary */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">{plan.name} Plan</span>
                <Badge>{billingCycle}</Badge>
              </div>
              <div className="flex justify-between items-center text-2xl font-bold">
                <span>Total:</span>
                <span>
                  {formatPrice(price)}
                  <span className="text-sm font-normal text-gray-500">
                    /{billingCycle === "monthly" ? "mo" : "yr"}
                  </span>
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Button
                className="w-full"
                size="lg"
                onClick={handlePayment}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Redirecting to PayPal...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Pay with PayPal
                  </>
                )}
              </Button>

              <Link href="/dashboard/business" className="block">
                <Button variant="ghost" className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Businesses
                </Button>
              </Link>
            </div>

            <p className="text-xs text-gray-500 text-center">
              Your subscription will be billed {billingCycle}. You can cancel
              anytime from your dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
