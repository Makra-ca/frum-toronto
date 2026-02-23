"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Building2,
  Check,
  X,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CreditCard,
  Star,
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
}

interface Category {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  children?: Category[];
}

interface BusinessHours {
  sunday?: { open: string; close: string } | null;
  monday?: { open: string; close: string } | null;
  tuesday?: { open: string; close: string } | null;
  wednesday?: { open: string; close: string } | null;
  thursday?: { open: string; close: string } | null;
  friday?: { open: string; close: string } | null;
  saturday?: { open: string; close: string } | null;
}

const FEATURE_LABELS: Record<string, string> = {
  showDescription: "Business Description",
  showContactName: "Contact Name",
  showEmail: "Email Address",
  showWebsite: "Website Link",
  showHours: "Business Hours",
  showMap: "Map & Directions",
  showLogo: "Business Logo",
  showSocialLinks: "Social Media Links",
  showKosherBadge: "Kosher Badge",
  isFeatured: "Featured Placement",
  priorityInSearch: "Priority in Search",
};

const DAYS = [
  { key: "sunday", label: "Sunday" },
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
] as const;

export default function NewBusinessPage() {
  const router = useRouter();
  const [step, setStep] = useState<"plan" | "details" | "success">("plan");
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    categoryId: "",
    description: "",
    contactName: "",
    phone: "",
    email: "",
    website: "",
    address: "",
    city: "Toronto",
    postalCode: "",
    isKosher: false,
    kosherCertification: "",
    hours: {} as BusinessHours,
    socialLinks: {
      facebook: "",
      instagram: "",
      twitter: "",
      linkedin: "",
    },
  });

  useEffect(() => {
    Promise.all([fetchPlans(), fetchCategories()]).then(() => setIsLoading(false));
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await fetch("/api/subscription-plans");
      const data = await res.json();
      setPlans(data.plans || []);
    } catch (error) {
      console.error("Error fetching plans:", error);
      toast.error("Failed to load pricing plans");
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/admin/business-categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const formatPrice = (price: string | null) => {
    if (!price || parseFloat(price) === 0) return "Free";
    return `$${parseFloat(price).toFixed(2)}`;
  };

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    // Always go to details first - we need business data before payment
    setStep("details");
  };

  const isPaidPlan = (plan: SubscriptionPlan | null): boolean => {
    if (!plan) return false;
    const price = billingCycle === "monthly" ? plan.priceMonthly : plan.priceYearly;
    return !!(price && parseFloat(price) > 0);
  };

  const handleSubmitBusiness = async () => {
    if (!formData.name.trim()) {
      toast.error("Business name is required");
      return;
    }

    const paid = isPaidPlan(selectedPlan);
    setIsSubmitting(true);

    try {
      // Create business - with pendingPayment flag for paid plans
      const res = await fetch("/api/businesses/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          categoryId: formData.categoryId ? parseInt(formData.categoryId) : null,
          subscriptionPlanId: selectedPlan?.id,
          hours: Object.keys(formData.hours).length > 0 ? formData.hours : null,
          socialLinks:
            Object.values(formData.socialLinks).some((v) => v)
              ? formData.socialLinks
              : null,
          pendingPayment: paid, // Mark as pending payment if paid plan
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create business");
      }

      // For free plans, we're done
      if (!paid) {
        toast.success(data.message);
        setStep("success");
        return;
      }

      // For paid plans, redirect to PayPal
      const businessId = data.business.id;
      setIsProcessingPayment(true);

      const paypalRes = await fetch("/api/paypal/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedPlan?.id,
          businessId,
          billingCycle,
        }),
      });

      const paypalData = await paypalRes.json();

      if (!paypalRes.ok) {
        // Business created but PayPal failed - user can retry from dashboard
        toast.error(paypalData.error || "Payment setup failed. You can retry from your dashboard.");
        router.push(`/dashboard/business/${businessId}/payment`);
        return;
      }

      // Redirect to PayPal for approval
      if (paypalData.approvalUrl) {
        window.location.href = paypalData.approvalUrl;
      } else {
        throw new Error("No approval URL received from PayPal");
      }
    } catch (error) {
      console.error("Business creation error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create business");
    } finally {
      setIsSubmitting(false);
      setIsProcessingPayment(false);
    }
  };

  const updateFormField = <K extends keyof typeof formData>(
    field: K,
    value: (typeof formData)[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateHours = (day: string, type: "open" | "close", value: string) => {
    setFormData((prev) => ({
      ...prev,
      hours: {
        ...prev.hours,
        [day]: {
          ...((prev.hours as Record<string, { open: string; close: string }>)[day] || {}),
          [type]: value,
        },
      },
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Step 1: Plan Selection
  if (step === "plan") {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <Building2 className="h-12 w-12 mx-auto text-blue-600 mb-4" />
            <h1 className="text-3xl font-bold text-gray-900">Register Your Business</h1>
            <p className="text-gray-600 mt-2">
              Choose a plan that fits your business needs
            </p>
          </div>

          {/* Billing Toggle */}
          <div className="flex justify-center items-center gap-4 mb-8">
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

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const price = billingCycle === "monthly" ? plan.priceMonthly : plan.priceYearly;
              const isFree = !price || parseFloat(price) === 0;
              const isPremium = plan.slug === "premium";

              return (
                <Card
                  key={plan.id}
                  className={`relative cursor-pointer transition-all hover:shadow-lg ${
                    isPremium ? "border-2 border-blue-500 shadow-lg" : ""
                  } ${selectedPlan?.id === plan.id ? "ring-2 ring-blue-500" : ""}`}
                  onClick={() => setSelectedPlan(plan)}
                >
                  {isPremium && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-blue-500 flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        Most Popular
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <div className="mt-2">
                      <span className="text-3xl font-bold">{formatPrice(price)}</span>
                      {!isFree && (
                        <span className="text-gray-500">
                          /{billingCycle === "monthly" ? "month" : "year"}
                        </span>
                      )}
                    </div>
                    {billingCycle === "yearly" && plan.priceMonthly && parseFloat(plan.priceMonthly) > 0 && (
                      <p className="text-sm text-green-600">
                        Save ${(parseFloat(plan.priceMonthly) * 12 - parseFloat(price || "0")).toFixed(0)}/year
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
                          <span className="font-medium">
                            {plan.maxPhotos === 999 ? "Unlimited" : plan.maxPhotos}
                          </span>
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
                            <span
                              className={
                                plan[key as keyof SubscriptionPlan]
                                  ? "text-gray-700"
                                  : "text-gray-400"
                              }
                            >
                              {label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button
                      className="w-full mt-4"
                      variant={isPremium ? "default" : "outline"}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectPlan(plan);
                      }}
                    >
                      {isFree ? "Start Free" : "Choose Plan"}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="text-center mt-8">
            <Link href="/dashboard/business" className="text-gray-600 hover:text-gray-900">
              <Button variant="ghost">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to My Businesses
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Business Details Form
  if (step === "details") {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Business Details</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedPlan?.name} Plan
                    {selectedPlan?.slug !== "free" && (
                      <Badge variant="secondary" className="ml-2">
                        {billingCycle}
                      </Badge>
                    )}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep("plan")}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Business Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => updateFormField("name", e.target.value)}
                    placeholder="Enter business name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.categoryId || "none"}
                    onValueChange={(value) =>
                      updateFormField("categoryId", value === "none" ? "" : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No category</SelectItem>
                      {categories.map((parent) => (
                        <SelectGroup key={parent.id}>
                          <SelectLabel className="font-semibold">{parent.name}</SelectLabel>
                          {parent.children && parent.children.length > 0 ? (
                            parent.children.map((child) => (
                              <SelectItem key={child.id} value={child.id.toString()}>
                                {child.name}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value={parent.id.toString()}>{parent.name}</SelectItem>
                          )}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedPlan?.showDescription && (
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => updateFormField("description", e.target.value)}
                      placeholder="Describe your business"
                      rows={3}
                    />
                  </div>
                )}
              </div>

              {/* Contact Info */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Contact Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => updateFormField("phone", e.target.value)}
                      placeholder="(416) 555-0000"
                    />
                  </div>

                  {selectedPlan?.showContactName && (
                    <div className="space-y-2">
                      <Label htmlFor="contactName">Contact Name</Label>
                      <Input
                        id="contactName"
                        value={formData.contactName}
                        onChange={(e) => updateFormField("contactName", e.target.value)}
                        placeholder="John Doe"
                      />
                    </div>
                  )}

                  {selectedPlan?.showEmail && (
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => updateFormField("email", e.target.value)}
                        placeholder="contact@business.com"
                      />
                    </div>
                  )}

                  {selectedPlan?.showWebsite && (
                    <div className="space-y-2">
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        value={formData.website}
                        onChange={(e) => updateFormField("website", e.target.value)}
                        placeholder="https://www.example.com"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Location */}
              {selectedPlan?.showMap && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Location</h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => updateFormField("address", e.target.value)}
                        placeholder="123 Main Street"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          value={formData.city}
                          onChange={(e) => updateFormField("city", e.target.value)}
                          placeholder="Toronto"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="postalCode">Postal Code</Label>
                        <Input
                          id="postalCode"
                          value={formData.postalCode}
                          onChange={(e) => updateFormField("postalCode", e.target.value)}
                          placeholder="M5V 1A1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Kosher */}
              {selectedPlan?.showKosherBadge && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Kosher Status</h4>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="isKosher"
                        checked={formData.isKosher}
                        onCheckedChange={(checked) => updateFormField("isKosher", checked)}
                      />
                      <Label htmlFor="isKosher">Kosher Certified</Label>
                    </div>
                    {formData.isKosher && (
                      <div className="space-y-2">
                        <Label htmlFor="kosherCertification">Certification</Label>
                        <Input
                          id="kosherCertification"
                          value={formData.kosherCertification}
                          onChange={(e) =>
                            updateFormField("kosherCertification", e.target.value)
                          }
                          placeholder="e.g., COR, OU, OK"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Hours */}
              {selectedPlan?.showHours && (
                <Accordion type="single" collapsible className="border-t pt-4">
                  <AccordionItem value="hours" className="border-none">
                    <AccordionTrigger className="font-medium py-2">
                      Business Hours (optional)
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pt-2">
                        {DAYS.map((day) => (
                          <div
                            key={day.key}
                            className="grid grid-cols-5 gap-2 items-center"
                          >
                            <Label className="col-span-1">{day.label}</Label>
                            <Input
                              type="time"
                              value={
                                (formData.hours as Record<string, { open: string; close: string }>)[
                                  day.key
                                ]?.open || ""
                              }
                              onChange={(e) => updateHours(day.key, "open", e.target.value)}
                              className="col-span-2"
                            />
                            <Input
                              type="time"
                              value={
                                (formData.hours as Record<string, { open: string; close: string }>)[
                                  day.key
                                ]?.close || ""
                              }
                              onChange={(e) => updateHours(day.key, "close", e.target.value)}
                              className="col-span-2"
                            />
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}

              {/* Social Links */}
              {selectedPlan?.showSocialLinks && (
                <Accordion type="single" collapsible className="border-t pt-4">
                  <AccordionItem value="social" className="border-none">
                    <AccordionTrigger className="font-medium py-2">
                      Social Media (optional)
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pt-2">
                        <div className="space-y-2">
                          <Label htmlFor="facebook">Facebook</Label>
                          <Input
                            id="facebook"
                            value={formData.socialLinks.facebook}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                socialLinks: { ...prev.socialLinks, facebook: e.target.value },
                              }))
                            }
                            placeholder="https://facebook.com/yourbusiness"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="instagram">Instagram</Label>
                          <Input
                            id="instagram"
                            value={formData.socialLinks.instagram}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                socialLinks: { ...prev.socialLinks, instagram: e.target.value },
                              }))
                            }
                            placeholder="https://instagram.com/yourbusiness"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="twitter">Twitter/X</Label>
                          <Input
                            id="twitter"
                            value={formData.socialLinks.twitter}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                socialLinks: { ...prev.socialLinks, twitter: e.target.value },
                              }))
                            }
                            placeholder="https://twitter.com/yourbusiness"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="linkedin">LinkedIn</Label>
                          <Input
                            id="linkedin"
                            value={formData.socialLinks.linkedin}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                socialLinks: { ...prev.socialLinks, linkedin: e.target.value },
                              }))
                            }
                            placeholder="https://linkedin.com/company/yourbusiness"
                          />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}

              {/* Submit */}
              <div className="flex flex-col gap-4 pt-4 border-t">
                {/* Show price summary for paid plans */}
                {isPaidPlan(selectedPlan) && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium">{selectedPlan?.name} Plan</span>
                      <Badge>{billingCycle}</Badge>
                    </div>
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Total:</span>
                      <span>
                        {formatPrice(
                          billingCycle === "monthly"
                            ? selectedPlan?.priceMonthly
                            : selectedPlan?.priceYearly
                        )}
                        <span className="text-sm font-normal text-gray-500">
                          /{billingCycle === "monthly" ? "mo" : "yr"}
                        </span>
                      </span>
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/dashboard/business")}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmitBusiness}
                    disabled={isSubmitting || isProcessingPayment}
                  >
                    {isSubmitting || isProcessingPayment ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {isProcessingPayment ? "Redirecting to PayPal..." : "Creating..."}
                      </>
                    ) : isPaidPlan(selectedPlan) ? (
                      <>
                        <CreditCard className="h-4 w-4 mr-2" />
                        Continue to Payment
                      </>
                    ) : (
                      "Submit Business"
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Step 4: Success
  if (step === "success") {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-lg mx-auto">
          <Card>
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Business Submitted!
              </h2>
              <p className="text-gray-600 mb-6">
                Your business listing has been submitted for review. We&apos;ll notify
                you once it&apos;s approved.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/dashboard/business">
                  <Button>View My Businesses</Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("plan");
                    setSelectedPlan(null);
                    setFormData({
                      name: "",
                      categoryId: "",
                      description: "",
                      contactName: "",
                      phone: "",
                      email: "",
                      website: "",
                      address: "",
                      city: "Toronto",
                      postalCode: "",
                      isKosher: false,
                      kosherCertification: "",
                      hours: {},
                      socialLinks: {
                        facebook: "",
                        instagram: "",
                        twitter: "",
                        linkedin: "",
                      },
                    });
                  }}
                >
                  Add Another Business
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return null;
}
