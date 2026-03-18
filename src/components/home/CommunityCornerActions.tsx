"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { SimchaSubmitModal } from "@/components/simchas/SimchaSubmitModal";
import { ShivaSubmitModal } from "@/components/shiva/ShivaSubmitModal";
import { SubmitQuestionModal } from "@/components/ask-the-rabbi/SubmitQuestionModal";
import { KosherAlertSubmitModal } from "@/components/kosher-alerts/KosherAlertSubmitModal";

export function AskRabbiActions() {
  return (
    <div className="mt-4 pt-4 border-t flex gap-2">
      <div className="flex-1 [&_button]:w-full [&_button]:bg-transparent [&_button]:text-foreground [&_button]:border [&_button]:border-input [&_button]:shadow-xs [&_button]:hover:bg-accent [&_button]:hover:text-accent-foreground">
        <SubmitQuestionModal
          trigger={
            <Button variant="outline" className="w-full">
              Ask a Question
            </Button>
          }
        />
      </div>
      <Button asChild variant="ghost" className="flex-1">
        <Link href="/ask-the-rabbi">
          View All <ArrowRight className="h-4 w-4 ml-2" />
        </Link>
      </Button>
    </div>
  );
}

export function SimchasActions() {
  return (
    <div className="mt-4 pt-4 border-t flex gap-2">
      <div className="flex-1 [&_button]:w-full [&_button]:bg-transparent [&_button]:text-foreground [&_button]:border [&_button]:border-input [&_button]:shadow-xs [&_button]:hover:bg-accent [&_button]:hover:text-accent-foreground">
        <SimchaSubmitModal />
      </div>
      <Button asChild variant="ghost" className="flex-1">
        <Link href="/simchas">
          View All <ArrowRight className="h-4 w-4 ml-2" />
        </Link>
      </Button>
    </div>
  );
}

export function ShivaActions() {
  return (
    <div className="mt-4 pt-4 border-t flex gap-2">
      <div className="flex-1 [&_button]:w-full [&_button]:bg-transparent [&_button]:text-foreground [&_button]:border [&_button]:border-input [&_button]:shadow-xs [&_button]:hover:bg-accent [&_button]:hover:text-accent-foreground">
        <ShivaSubmitModal />
      </div>
      <Button asChild variant="ghost" className="flex-1">
        <Link href="/shiva">
          View All <ArrowRight className="h-4 w-4 ml-2" />
        </Link>
      </Button>
    </div>
  );
}

export function KosherAlertActions() {
  return (
    <div className="mt-4 pt-4 border-t flex gap-2">
      <div className="flex-1 [&_button]:w-full [&_button]:bg-transparent [&_button]:text-foreground [&_button]:border [&_button]:border-input [&_button]:shadow-xs [&_button]:hover:bg-accent [&_button]:hover:text-accent-foreground">
        <KosherAlertSubmitModal />
      </div>
      <Button asChild variant="ghost" className="flex-1">
        <Link href="/kosher-alerts">
          View All <ArrowRight className="h-4 w-4 ml-2" />
        </Link>
      </Button>
    </div>
  );
}

export function BulletinAlertActions() {
  return (
    <div className="mt-4 pt-4 border-t flex gap-2">
      <Button asChild variant="ghost" className="flex-1 ml-auto">
        <Link href="/alerts">
          View All <ArrowRight className="h-4 w-4 ml-2" />
        </Link>
      </Button>
    </div>
  );
}
