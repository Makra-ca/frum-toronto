"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Heart,
  ShieldAlert,
  Bell,
  Users,
  BookOpen,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AskRabbiActions,
  SimchasActions,
  ShivaActions,
  KosherAlertActions,
  BulletinAlertActions,
} from "@/components/home/CommunityCornerActions";

// --- Types ---

type TabKey =
  | "ask-rabbi"
  | "simchas"
  | "kosher-alerts"
  | "bulletin"
  | "shiva"
  | "tehillim";

export interface UnifiedItem {
  tab: TabKey;
  sortDate: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
}

interface CommunityCornerClientProps {
  items: UnifiedItem[];
}

// --- Tab definitions ---

const TABS: { key: TabKey; label: string; icon: typeof MessageSquare; color: string }[] = [
  { key: "ask-rabbi", label: "Ask Rabbi", icon: MessageSquare, color: "purple" },
  { key: "simchas", label: "Simchas", icon: Heart, color: "pink" },
  { key: "kosher-alerts", label: "Kosher Alerts", icon: ShieldAlert, color: "red" },
  { key: "bulletin", label: "Bulletin Alerts", icon: Bell, color: "amber" },
  { key: "shiva", label: "Shiva", icon: Users, color: "gray" },
  { key: "tehillim", label: "Tehillim", icon: BookOpen, color: "blue" },
];

const TAB_COLORS: Record<string, { active: string; hover: string }> = {
  purple: { active: "bg-purple-100 text-purple-800", hover: "hover:bg-purple-50" },
  pink: { active: "bg-pink-100 text-pink-800", hover: "hover:bg-pink-50" },
  red: { active: "bg-red-100 text-red-800", hover: "hover:bg-red-50" },
  amber: { active: "bg-amber-100 text-amber-800", hover: "hover:bg-amber-50" },
  gray: { active: "bg-gray-200 text-gray-800", hover: "hover:bg-gray-100" },
  blue: { active: "bg-blue-100 text-blue-800", hover: "hover:bg-blue-50" },
};

// --- Helpers ---

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "\u2026";
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// --- Item renderers ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AskRabbiCard({ data }: { data: Record<string, any> }) {
  return (
    <Link href={`/ask-the-rabbi/${data.id}`} className="block">
      <div className="p-4 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-900 line-clamp-2">
            {data.title as string}
          </h3>
          {data.questionNumber && (
            <Badge className="bg-purple-200 text-purple-800 shrink-0">
              #{data.questionNumber as number}
            </Badge>
          )}
        </div>
        {data.question && (
          <p className="text-sm text-gray-600 mt-2 line-clamp-3">
            {truncate(stripHtml(data.question as string), 150)}
          </p>
        )}
        <p className="text-xs text-purple-600 mt-2 font-medium">Read More &rarr;</p>
      </div>
    </Link>
  );
}

function SimchaCard({ data }: { data: Record<string, any> }) {
  return (
    <div className="p-4 rounded-lg bg-pink-50">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gray-900">
            {data.familyName as string} Family
          </h3>
          {data.announcement && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-3">
              {data.announcement as string}
            </p>
          )}
        </div>
        {data.typeName && (
          <Badge className="bg-pink-200 text-pink-800 shrink-0">
            {data.typeName as string}
          </Badge>
        )}
      </div>
      {data.eventDate && (
        <p className="text-xs text-gray-500 mt-2">
          {formatDate(data.eventDate as string)}
        </p>
      )}
    </div>
  );
}

function KosherAlertCard({ data }: { data: Record<string, any> }) {
  const typeColors: Record<string, string> = {
    recall: "bg-red-200 text-red-800",
    warning: "bg-orange-200 text-orange-800",
    status_change: "bg-yellow-200 text-yellow-800",
    update: "bg-blue-200 text-blue-800",
  };
  const alertType = data.alertType as string | null;

  return (
    <div className="p-4 rounded-lg bg-red-50">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900">
          {data.productName as string}
        </h3>
        {alertType && (
          <Badge className={typeColors[alertType] || "bg-gray-200 text-gray-800"}>
            {alertType.replace("_", " ")}
          </Badge>
        )}
      </div>
      {data.brand && (
        <p className="text-sm text-gray-600 mt-1">{data.brand as string}</p>
      )}
      {data.certifyingAgency && (
        <p className="text-xs text-gray-500 mt-1">
          Agency: {data.certifyingAgency as string}
        </p>
      )}
      {data.description && (
        <p className="text-sm text-gray-600 mt-2 line-clamp-2">
          {truncate(data.description as string, 120)}
        </p>
      )}
    </div>
  );
}

function BulletinAlertCard({ data }: { data: Record<string, any> }) {
  const urgencyColors: Record<string, string> = {
    normal: "bg-gray-200 text-gray-700",
    high: "bg-amber-200 text-amber-800",
    urgent: "bg-red-200 text-red-800",
  };
  const urgency = (data.urgency as string) || "normal";

  return (
    <div className="p-4 rounded-lg bg-amber-50">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900">{data.title as string}</h3>
        <Badge className={urgencyColors[urgency] || "bg-gray-200 text-gray-700"}>
          {urgency}
        </Badge>
      </div>
      {data.content && (
        <p className="text-sm text-gray-600 mt-2 line-clamp-3">
          {truncate(stripHtml(data.content as string), 150)}
        </p>
      )}
      {data.createdAt && (
        <p className="text-xs text-gray-500 mt-2">
          {formatDate(data.createdAt as string)}
        </p>
      )}
    </div>
  );
}

function ShivaCard({ data }: { data: Record<string, any> }) {
  const mournerNames = data.mournerNames as string[] | null;
  const mourners = mournerNames ? mournerNames.join(", ") : "";

  return (
    <div className="p-4 rounded-lg bg-gray-100">
      <h3 className="font-semibold text-gray-900">{data.niftarName as string}</h3>
      {mourners && <p className="text-sm text-gray-600 mt-1">{mourners}</p>}
      {data.shivaAddress && (
        <p className="text-sm text-gray-500 mt-1">{data.shivaAddress as string}</p>
      )}
      {data.shivaEnd && (
        <p className="text-xs text-gray-500 mt-1">
          Until {formatDate(data.shivaEnd as string)}
        </p>
      )}
    </div>
  );
}

function TehillimCard({ data }: { data: Record<string, any> }) {
  const hebrewName = data.hebrewName as string | null;
  const englishName = data.englishName as string | null;
  const motherHebrewName = data.motherHebrewName as string | null;
  const reason = data.reason as string | null;

  return (
    <div className="p-4 rounded-lg bg-blue-50">
      {hebrewName ? (
        <p className="font-semibold text-gray-900" dir="rtl">
          {hebrewName}
          {motherHebrewName && (
            <span className="text-gray-600"> בן/בת {motherHebrewName}</span>
          )}
        </p>
      ) : (
        <p className="font-semibold text-gray-900">
          {englishName}
          {motherHebrewName && (
            <span className="text-gray-600"> ben/bat {motherHebrewName}</span>
          )}
        </p>
      )}
      {reason && <p className="text-sm text-gray-500 mt-1">{reason}</p>}
    </div>
  );
}

// --- Render item by tab type ---

function renderItem(item: UnifiedItem) {
  switch (item.tab) {
    case "ask-rabbi":
      return <AskRabbiCard data={item.data} />;
    case "simchas":
      return <SimchaCard data={item.data} />;
    case "kosher-alerts":
      return <KosherAlertCard data={item.data} />;
    case "bulletin":
      return <BulletinAlertCard data={item.data} />;
    case "shiva":
      return <ShivaCard data={item.data} />;
    case "tehillim":
      return <TehillimCard data={item.data} />;
  }
}

// --- Actions by tab type ---

function renderActions(tab: TabKey) {
  switch (tab) {
    case "ask-rabbi":
      return <AskRabbiActions />;
    case "simchas":
      return <SimchasActions />;
    case "kosher-alerts":
      return <KosherAlertActions />;
    case "bulletin":
      return <BulletinAlertActions />;
    case "shiva":
      return <ShivaActions />;
    case "tehillim":
      return (
        <div className="mt-4 pt-4 border-t flex gap-2">
          <Link
            href="/community/tehillim/add"
            className="flex-1 inline-flex items-center justify-center rounded-md border border-input bg-transparent px-4 py-2 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Add Name
          </Link>
          <Link
            href="/community/tehillim"
            className="flex-1 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            View All &rarr;
          </Link>
        </div>
      );
  }
}

// --- Main component ---

export function CommunityCornerClient({ items }: CommunityCornerClientProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Which tabs have items (for showing counts on tab pills)
  const tabCounts = useMemo(() => {
    const counts: Record<TabKey, number> = {
      "ask-rabbi": 0,
      simchas: 0,
      "kosher-alerts": 0,
      bulletin: 0,
      shiva: 0,
      tehillim: 0,
    };
    for (const item of items) {
      counts[item.tab]++;
    }
    return counts;
  }, [items]);

  if (items.length === 0) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="py-8 text-center text-gray-500">
          <p>No community content to display.</p>
        </CardContent>
      </Card>
    );
  }

  const currentItem = items[currentIndex];
  const activeTab = currentItem.tab;

  function navigate(direction: "prev" | "next") {
    setCurrentIndex((prev) => {
      if (direction === "next") return (prev + 1) % items.length;
      return (prev - 1 + items.length) % items.length;
    });
  }

  // Clicking a tab jumps to the first item of that type
  function jumpToTab(tab: TabKey) {
    const idx = items.findIndex((item) => item.tab === tab);
    if (idx !== -1) setCurrentIndex(idx);
  }

  return (
    <Card className="border-0 shadow-md">
      {/* Tabs - 2-col grid on mobile, horizontal row on md+ */}
      <div className="p-4 pb-0">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const colors = TAB_COLORS[tab.color];
            const Icon = tab.icon;
            const hasItems = tabCounts[tab.key] > 0;

            return (
              <button
                key={tab.key}
                onClick={() => jumpToTab(tab.key)}
                disabled={!hasItems}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                  !hasItems
                    ? "text-gray-300 cursor-not-allowed"
                    : isActive
                      ? `${colors.active} cursor-pointer`
                      : `text-gray-600 ${colors.hover} cursor-pointer`
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <CardContent className="pt-4">
        {/* Carousel area */}
        <div className="relative">
          {/* Prev/Next arrows */}
          {items.length > 1 && (
            <>
              <button
                onClick={() => navigate("prev")}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 bg-white shadow-md rounded-full p-1.5 hover:bg-gray-50 transition-colors cursor-pointer"
                aria-label="Previous item"
              >
                <ChevronLeft className="h-4 w-4 text-gray-600" />
              </button>
              <button
                onClick={() => navigate("next")}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 bg-white shadow-md rounded-full p-1.5 hover:bg-gray-50 transition-colors cursor-pointer"
                aria-label="Next item"
              >
                <ChevronRight className="h-4 w-4 text-gray-600" />
              </button>
            </>
          )}

          {/* Content with padding for arrows */}
          <div className="px-6">{renderItem(currentItem)}</div>
        </div>

        {/* Position indicator */}
        {items.length > 1 && (
          <p className="text-center text-xs text-gray-400 mt-3">
            {currentIndex + 1} of {items.length}
          </p>
        )}

        {/* Actions change based on current item's tab */}
        {renderActions(activeTab)}
      </CardContent>
    </Card>
  );
}
