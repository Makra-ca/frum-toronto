import Link from "next/link";
import { MessageSquare, PenLine, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubmitQuestionModal } from "@/components/ask-the-rabbi/SubmitQuestionModal";

/**
 * Sits between the hero and the dark banner ad strip.
 *
 * This is a server component that renders one client component — the modal
 * itself carries `"use client"`, so nothing here needs to. `SubmitQuestionModal`
 * accepts a `trigger`, which means the whole submit flow (login gate for signed
 * out visitors, session pre-fill, image upload, success state) is reused rather
 * than reimplemented behind a link to /ask-the-rabbi.
 *
 * Light band on purpose: the hero above and the ad strip below are both dark, so
 * a dark CTA here would read as part of one of them.
 */
export function AskTheRabbiCta() {
  return (
    <section className="w-full border-y border-purple-100 bg-gradient-to-r from-purple-50 to-white">
      <div className="container mx-auto px-4 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-purple-600/10 text-purple-700">
              <MessageSquare className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Have a halachic question?
              </h2>
              <p className="text-sm text-gray-600">
                Submit it to Ask The Rabbi and receive an answer by email.
              </p>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-3">
            <SubmitQuestionModal
              trigger={
                <Button className="bg-purple-600 hover:bg-purple-700">
                  <PenLine className="mr-2 h-4 w-4" />
                  Submit a Question
                </Button>
              }
            />
            <Button
              asChild
              variant="ghost"
              className="text-purple-700 hover:bg-purple-100 hover:text-purple-800"
            >
              <Link href="/ask-the-rabbi">
                Browse answers
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
