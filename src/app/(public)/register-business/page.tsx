import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, CheckCircle, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Register Your Business - FrumToronto",
  description: "List your business in the FrumToronto directory and reach the Toronto Jewish community",
};

export default function RegisterBusinessPage() {
  const benefits = [
    "Reach thousands of community members",
    "Appear in category searches",
    "Display your contact information",
    "Showcase your business hours",
    "Highlight kosher certifications",
  ];

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

      {/* Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-xl">Why List Your Business?</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-gray-700">{benefit}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">How to Get Started</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                To register your business on FrumToronto:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-gray-700">
                <li>Create a free account or sign in to your existing account</li>
                <li>Go to your dashboard and select &quot;My Businesses&quot;</li>
                <li>Click &quot;Add New Business&quot; and fill out your business details</li>
                <li>Submit for review - we&apos;ll approve your listing within 24-48 hours</li>
              </ol>

              <div className="pt-6 flex flex-col sm:flex-row gap-4">
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

              <p className="text-sm text-gray-500 text-center pt-4">
                Questions? <Link href="/contact" className="text-blue-600 hover:underline">Contact us</Link> for assistance.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
