"use client";

import Link from "next/link";
import { Info, ExternalLink } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PublicLocationHintProps {
  /** Where this section's content appears publicly, e.g. "/eruv". */
  href: string;
  /** How a visitor navigates to it, e.g. "Alerts → Important Numbers". */
  navPath: string;
}

/**
 * "Where does this actually show up?" for an admin section.
 *
 * An admin tab does not say where its content surfaces, and the two can sit
 * under different menus — Important Numbers is administered under Community but
 * linked publicly under Alerts, which is why it could not be found on the site
 * at all.
 *
 * The nav path is the load-bearing half: a URL alone does not tell you how a
 * visitor is meant to arrive. The link opens in a new tab because the admin is
 * usually mid-edit.
 */
export function PublicLocationHint({ href, navPath }: PublicLocationHintProps) {
  // delayDuration 0: this is a "where am I?" hint someone is deliberately
  // reaching for, not an incidental label that should stay out of the way.
  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex items-center gap-1.5 text-sm text-gray-500">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Where this appears on the public site"
              className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-700"
            >
              <Info className="h-4 w-4" />
              <span>Where this appears</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="start" className="max-w-xs">
            <p className="font-medium">Appears publicly at</p>
            <p className="font-mono text-xs">{href}</p>
            <p className="mt-1.5 font-medium">Navigate there via</p>
            <p className="text-xs">{navPath}</p>
          </TooltipContent>
        </Tooltip>

        <Link
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:underline"
        >
          View page
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </TooltipProvider>
  );
}
