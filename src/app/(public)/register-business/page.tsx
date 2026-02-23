import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, CheckCircle, ArrowRight, Check, Star } from "lucide-react";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { subscriptionPlans } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export const metadata = {
  title: "Register Your Business - FrumToronto",
  description: "List your business in the FrumToronto directory and reach the Toronto Jewish community",
};

export default async function RegisterBusinessPage() {
  // Check if user is logged in - redirect to dashboard flow
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard/business/new");
  }

  // Fetch plans for pricing display
  const plans = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.isActive, true))
    .orderBy(asc(subscriptionPlans.displayOrder));

  const formatPrice = (price: string | null) => {
    if (!price || parseFloat(price) === 0) return "Free";
    return `$${parseFloat(price).toFixed(2)}`;
  };

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <Building2 className="h-16 w-16 mx-auto mb-6" />
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Register Your Business
          </h1>
          <p className="text-blue-200 max-w-2xl mx-auto text-lg">
            Join the FrumToronto Business Directory and connect with the
            Toronto Jewish community.
          </p>
        </div>
      </div>

      {/* Pricing Plans */}
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Choose Your Plan</h2>
          <p className="text-gray-600 mt-2">
            Select the plan that best fits your business needs
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
          {plans.map((plan) => {
            const isFree = !plan.priceMonthly || parseFloat(plan.priceMonthly) === 0;
            const isPremium = plan.slug === "premium";

            return (
              <Card
                key={plan.id}
                className={`relative ${isPremium ? "border-2 border-blue-500 shadow-lg" : ""}`}
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
                    <span className="text-3xl font-bold">
                      {formatPrice(plan.priceMonthly)}
                    </span>
                    {!isFree && <span className="text-gray-500">/month</span>}
                  </div>
                  {plan.priceYearly && parseFloat(plan.priceYearly) > 0 && (
                    <p className="text-sm text-gray-500">
                      or {formatPrice(plan.priceYearly)}/year (save 2 months)
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
                          <Check
                            className={`h-4 w-4 ${
                              plan[key as keyof typeof plan]
                                ? "text-green-600"
                                : "text-gray-300"
                            }`}
                          />
                          <span
                            className={
                              plan[key as keyof typeof plan]
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
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* CTA Section */}
        <div className="max-w-lg mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl text-center">Get Started Today</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700 text-center">
                Create an account to register your business and choose your plan.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/register" className="flex-1">
                  <Button className="w-full" size="lg">
                    Create Account
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/login" className="flex-1">
                  <Button variant="outline" className="w-full" size="lg">
                    Sign In
                  </Button>
                </Link>
              </div>

              <p className="text-sm text-gray-500 text-center pt-2">
                Questions?{" "}
                <Link href="/contact" className="text-blue-600 hover:underline">
                  Contact us
                </Link>{" "}
                for assistance.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Benefits */}
        <div className="max-w-3xl mx-auto mt-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Why List Your Business?</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {[
                  "Reach thousands of community members",
                  "Appear in category searches",
                  "Display your contact information",
                  "Showcase your business hours",
                  "Highlight kosher certifications",
                  "Get featured placement with premium plans",
                ].map((benefit, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-gray-700">{benefit}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
