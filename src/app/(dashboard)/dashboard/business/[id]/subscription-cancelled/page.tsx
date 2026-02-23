import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle, ArrowRight, RefreshCw } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SubscriptionCancelledPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-8 w-8 text-orange-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Payment Cancelled
            </h2>
            <p className="text-gray-600 mb-6">
              Your payment was cancelled. Don&apos;t worry - your business listing
              has been saved and you can complete the payment anytime.
            </p>

            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
              <div className="flex items-start gap-3">
                <RefreshCw className="h-5 w-5 text-gray-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-gray-900">Ready to try again?</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    You can complete your payment from your business dashboard
                    at any time. Your business details have been saved.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href={`/dashboard/business/${id}/payment`}>
                <Button>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry Payment
                </Button>
              </Link>
              <Link href="/dashboard/business">
                <Button variant="outline">
                  View My Businesses
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
