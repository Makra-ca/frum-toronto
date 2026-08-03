"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ATR_TABS, parseAtrTab, type AtrTab } from "./atr-tabs";
import { SubmissionsInbox } from "./SubmissionsInbox";
import { QuestionsLibrary } from "./QuestionsLibrary";
import { CommentsModeration } from "./CommentsModeration";
import { AtrQuickPost } from "../AtrQuickPost";

interface AtrManageTabsProps {
  /** Tab to show when the URL carries no ?tab=. Each shell picks its own. */
  defaultTab?: AtrTab;
}

/**
 * The four Ask the Rabbi management screens, rendered identically in the admin
 * panel and in the dashboard.
 *
 * The active tab is DERIVED from ?tab= rather than held in state, and clicking
 * writes it back. Both directions matter: three server-side notifications deep
 * link into these pages, and a tab held in useState would ignore a URL change
 * after mount.
 *
 * No page heading here — each shell supplies its own.
 */
export function AtrManageTabs({ defaultTab }: AtrManageTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const raw = searchParams.get("tab");
  const tab: AtrTab = raw ? parseAtrTab(raw) : (defaultTab ?? parseAtrTab(null));

  const select = (next: AtrTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    // replace, not push — the back button should leave the page rather than
    // walk back through every tab the user looked at.
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b overflow-x-auto" role="tablist">
        {ATR_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => select(t.key)}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "submissions" && <SubmissionsInbox />}
      {tab === "questions" && <QuestionsLibrary />}
      {tab === "new" && (
        // canManageAtr is safe to hardcode: both shells gate on the capability
        // before rendering, and every API this calls re-checks server-side.
        // onPublished exists because AtrQuickPost's router.refresh() only
        // refreshes server-rendered content, so it is a no-op for the
        // client-fetched Questions list — without this, publishing left the
        // Questions tab stale.
        <AtrQuickPost canManageAtr onPublished={() => select("questions")} />
      )}
      {tab === "comments" && <CommentsModeration />}
    </div>
  );
}
