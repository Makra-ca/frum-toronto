"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type BlockType = "omer" | "shoutout" | "atr" | "events" | "simchas" | "shiva" | "blogs" | "tehillim";

interface BlockSetting {
  blockType: BlockType;
  isEnabled: boolean;
  config?: Record<string, unknown>;
}

interface BlockPreviewData {
  data: unknown;
  isEmpty: boolean;
}

interface BlockMeta {
  type: BlockType;
  label: string;
  description: string;
  readOnly?: boolean; // Omer: no toggle, auto-shows/hides
}

const BLOCKS: BlockMeta[] = [
  {
    type: "omer",
    label: "Sefirat HaOmer",
    description: "Auto-shown during the 49-day Omer period",
    readOnly: true,
  },
  {
    type: "shoutout",
    label: "Business Shoutout",
    description: "Paid business spotlight for today's send date",
  },
  {
    type: "atr",
    label: "Ask the Rabbi",
    description: "Q&A published in the last 7 days",
  },
  {
    type: "events",
    label: "Upcoming Events",
    description: "Community events in the next 7 days",
  },
  {
    type: "simchas",
    label: "Recent Simchas",
    description: "Mazel Tov announcements from the past 7 days",
  },
  {
    type: "shiva",
    label: "Shiva Notices",
    description: "Current (non-expired) shiva notices",
  },
  {
    type: "blogs",
    label: "Latest Blog Posts",
    description: "Last 3 published blog posts",
  },
  {
    type: "tehillim",
    label: "Tehillim List",
    description: "All active Tehillim names",
  },
];

const SIMCHA_TYPE_OPTIONS = [
  { value: "birth", label: "Births" },
  { value: "engagement", label: "Engagements" },
  { value: "wedding", label: "Weddings" },
];

// ─── SimchaTypesPicker ────────────────────────────────────────────────────────

function SimchaTypesPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="mt-2 space-y-1.5 pl-1">
      <p className="text-xs text-gray-500 font-medium">Include types:</p>
      {SIMCHA_TYPE_OPTIONS.map((opt) => (
        <div key={opt.value} className="flex items-center gap-2">
          <Checkbox
            id={`simcha-${opt.value}`}
            checked={selected.includes(opt.value)}
            onCheckedChange={() => toggle(opt.value)}
          />
          <Label
            htmlFor={`simcha-${opt.value}`}
            className="text-xs text-gray-700 cursor-pointer"
          >
            {opt.label}
          </Label>
        </div>
      ))}
      {selected.length === 0 && (
        <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
          <AlertTriangle className="h-3 w-3" />
          Select at least one type
        </p>
      )}
    </div>
  );
}

// ─── Block preview summary helpers ───────────────────────────────────────────

function renderPreviewSummary(blockType: BlockType, previewData: BlockPreviewData): React.ReactNode {
  const { data, isEmpty } = previewData;

  if (blockType === "omer") {
    const d = data as { isOmer: boolean; day: number | null; hebrewDay: string | null } | null;
    if (!d || !d.isOmer) {
      return <span className="text-xs text-gray-400">Not currently Omer period</span>;
    }
    return (
      <span className="text-xs text-amber-700 font-medium">
        Day {d.day} of the Omer
        {d.hebrewDay ? ` — ${d.hebrewDay}` : ""}
      </span>
    );
  }

  if (blockType === "shoutout") {
    const d = data as { businessName?: string } | null;
    if (isEmpty || !d) {
      return <span className="text-xs text-gray-400">No business booked for this date</span>;
    }
    return (
      <span className="text-xs text-green-700 font-medium">
        Booked: {d.businessName}
      </span>
    );
  }

  if (blockType === "atr") {
    const items = data as Array<{ title: string }> | null;
    if (isEmpty || !items || items.length === 0) {
      return <span className="text-xs text-gray-400">No questions published this week</span>;
    }
    return (
      <div className="space-y-0.5">
        <span className="text-xs text-green-700 font-medium">
          {items.length} question{items.length !== 1 ? "s" : ""} this week
        </span>
        {items.slice(0, 2).map((q, i) => (
          <p key={i} className="text-xs text-gray-500 truncate pl-1">
            &bull; {q.title.slice(0, 55)}{q.title.length > 55 ? "…" : ""}
          </p>
        ))}
      </div>
    );
  }

  if (blockType === "events") {
    const items = data as Array<{ title: string; startTime: string }> | null;
    if (isEmpty || !items || items.length === 0) {
      return <span className="text-xs text-gray-400">No events this week</span>;
    }
    return (
      <div className="space-y-0.5">
        <span className="text-xs text-green-700 font-medium">
          {items.length} event{items.length !== 1 ? "s" : ""} this week
        </span>
        {items.slice(0, 2).map((e, i) => {
          const date = e.startTime
            ? new Date(e.startTime).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })
            : "";
          return (
            <p key={i} className="text-xs text-gray-500 truncate pl-1">
              &bull; {date} — {e.title.slice(0, 45)}{e.title.length > 45 ? "…" : ""}
            </p>
          );
        })}
      </div>
    );
  }

  if (blockType === "simchas") {
    const items = data as Array<{ familyName: string; typeName: string }> | null;
    if (isEmpty || !items || items.length === 0) {
      return <span className="text-xs text-gray-400">No simchas this week</span>;
    }
    return (
      <div className="space-y-0.5">
        <span className="text-xs text-green-700 font-medium">
          {items.length} simch{items.length !== 1 ? "os" : "a"} this week
        </span>
        {items.slice(0, 2).map((s, i) => (
          <p key={i} className="text-xs text-gray-500 truncate pl-1">
            &bull; {s.familyName} ({s.typeName})
          </p>
        ))}
      </div>
    );
  }

  if (blockType === "shiva") {
    const items = data as Array<{ niftarName: string }> | null;
    if (isEmpty || !items || items.length === 0) {
      return <span className="text-xs text-gray-400">No current shiva notices</span>;
    }
    return (
      <div className="space-y-0.5">
        <span className="text-xs text-green-700 font-medium">
          {items.length} notice{items.length !== 1 ? "s" : ""}
        </span>
        {items.slice(0, 2).map((n, i) => (
          <p key={i} className="text-xs text-gray-500 truncate pl-1">
            &bull; {n.niftarName}
          </p>
        ))}
      </div>
    );
  }

  if (blockType === "blogs") {
    const items = data as Array<{ title: string }> | null;
    if (isEmpty || !items || items.length === 0) {
      return <span className="text-xs text-gray-400">No published posts</span>;
    }
    return (
      <div className="space-y-0.5">
        <span className="text-xs text-green-700 font-medium">
          {items.length} post{items.length !== 1 ? "s" : ""}
        </span>
        {items.slice(0, 2).map((p, i) => (
          <p key={i} className="text-xs text-gray-500 truncate pl-1">
            &bull; {p.title.slice(0, 55)}{p.title.length > 55 ? "…" : ""}
          </p>
        ))}
      </div>
    );
  }

  if (blockType === "tehillim") {
    const items = data as Array<{ hebrewName?: string; englishName?: string }> | null;
    if (isEmpty || !items || items.length === 0) {
      return <span className="text-xs text-gray-400">Tehillim list is empty</span>;
    }
    const names = items.slice(0, 3).map((t) => t.hebrewName || t.englishName || "Unknown");
    return (
      <div className="space-y-0.5">
        <span className="text-xs text-green-700 font-medium">
          {items.length} name{items.length !== 1 ? "s" : ""} on list
        </span>
        <p className="text-xs text-gray-500 pl-1 truncate">
          {names.join(", ")}{items.length > 3 ? ` +${items.length - 3} more` : ""}
        </p>
      </div>
    );
  }

  return null;
}

// ─── BlockCard ────────────────────────────────────────────────────────────────

interface BlockCardProps {
  meta: BlockMeta;
  setting: BlockSetting;
  previewData: BlockPreviewData | null;
  isLoadingPreview: boolean;
  onToggle: (enabled: boolean) => void;
  onConfigChange: (config: Record<string, unknown>) => void;
  onExpandPreview: () => void;
  isPreviewExpanded: boolean;
}

function BlockCard({
  meta,
  setting,
  previewData,
  isLoadingPreview,
  onToggle,
  onConfigChange,
  onExpandPreview,
  isPreviewExpanded,
}: BlockCardProps) {
  const isEnabled = setting.isEnabled;
  const simchaTypes = (setting.config?.simchaTypes as string[]) ?? ["birth", "engagement", "wedding"];

  // Omer: hide entire card if not Omer period and we have loaded preview data
  if (meta.readOnly && previewData && !(previewData.data as { isOmer?: boolean })?.isOmer) {
    return null;
  }

  const hasData = previewData && !previewData.isEmpty;
  const noData = previewData && previewData.isEmpty;

  return (
    <div
      className={cn(
        "rounded-lg border bg-white transition-opacity",
        !isEnabled && !meta.readOnly && "opacity-60"
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 p-3">
        {!meta.readOnly && (
          <Switch
            checked={isEnabled}
            onCheckedChange={onToggle}
            aria-label={`Toggle ${meta.label}`}
          />
        )}
        {meta.readOnly && (
          <Info className="h-4 w-4 text-amber-500 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 leading-tight">
            {meta.label}
          </p>
          <p className="text-xs text-gray-500 leading-tight mt-0.5">
            {meta.description}
          </p>
        </div>
        {/* Preview expand toggle */}
        {(isEnabled || meta.readOnly) && (
          <button
            type="button"
            onClick={onExpandPreview}
            className="flex-shrink-0 p-1 rounded hover:bg-gray-100 transition-colors"
            title={isPreviewExpanded ? "Hide preview" : "Show preview data"}
          >
            {isPreviewExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
            )}
          </button>
        )}
      </div>

      {/* Status badge row — shown when enabled/read-only */}
      {(isEnabled || meta.readOnly) && (
        <div className="px-3 pb-2 flex items-center gap-1.5">
          {isLoadingPreview && (
            <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
          )}
          {!isLoadingPreview && hasData && (
            <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
          )}
          {!isLoadingPreview && noData && (
            <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />
          )}
          {!isLoadingPreview && noData && !meta.readOnly && (
            <span className="text-xs text-amber-600">
              No data — block will be hidden in email
            </span>
          )}
          {!isLoadingPreview && hasData && meta.type === "omer" && (
            <span className="text-xs text-amber-700 font-medium">
              Active
            </span>
          )}
          {!isLoadingPreview && hasData && meta.type !== "omer" && (
            <Badge variant="secondary" className="text-xs h-4 px-1.5 bg-green-50 text-green-700 border-green-200">
              Data found
            </Badge>
          )}
        </div>
      )}

      {/* Preview data — expanded */}
      {(isEnabled || meta.readOnly) && isPreviewExpanded && (
        <div className="border-t mx-3 mb-3 pt-2">
          {isLoadingPreview ? (
            <div className="flex items-center gap-1.5 py-1">
              <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
              <span className="text-xs text-gray-400">Loading preview...</span>
            </div>
          ) : previewData ? (
            renderPreviewSummary(meta.type, previewData)
          ) : (
            <span className="text-xs text-gray-400">Click expand to load preview</span>
          )}
        </div>
      )}

      {/* Simchas config — only when enabled */}
      {meta.type === "simchas" && isEnabled && (
        <div className="border-t mx-3 mb-3 pt-2">
          <SimchaTypesPicker
            selected={simchaTypes}
            onChange={(types) => onConfigChange({ simchaTypes: types })}
          />
        </div>
      )}
    </div>
  );
}

// ─── NewsletterBlockSidebar ───────────────────────────────────────────────────

interface NewsletterBlockSidebarProps {
  newsletterId: number;
  isCollapsed: boolean;
  onCollapseToggle: () => void;
}

export function NewsletterBlockSidebar({
  newsletterId,
  isCollapsed,
  onCollapseToggle,
}: NewsletterBlockSidebarProps) {
  const [settings, setSettings] = useState<Record<BlockType, BlockSetting>>(() => {
    const initial: Record<string, BlockSetting> = {};
    for (const b of BLOCKS) {
      initial[b.type] = {
        blockType: b.type,
        isEnabled: false,
        config: b.type === "simchas" ? { simchaTypes: ["birth", "engagement", "wedding"] } : undefined,
      };
    }
    return initial as Record<BlockType, BlockSetting>;
  });

  const [previewData, setPreviewData] = useState<Record<BlockType, BlockPreviewData | null>>(() => {
    const initial: Record<string, null> = {};
    for (const b of BLOCKS) initial[b.type] = null;
    return initial as Record<BlockType, null>;
  });

  const [loadingPreviews, setLoadingPreviews] = useState<Record<BlockType, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const b of BLOCKS) initial[b.type] = false;
    return initial as Record<BlockType, boolean>;
  });

  const [expandedPreviews, setExpandedPreviews] = useState<Record<BlockType, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const b of BLOCKS) initial[b.type] = false;
    return initial as Record<BlockType, boolean>;
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved settings on mount
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/admin/newsletters/${newsletterId}/block-settings`);
        if (!res.ok) return;
        const json = await res.json();
        const saved: BlockSetting[] = json.settings || [];
        setSettings((prev) => {
          const next = { ...prev };
          for (const s of saved) {
            if (next[s.blockType as BlockType]) {
              next[s.blockType as BlockType] = {
                ...next[s.blockType as BlockType],
                isEnabled: s.isEnabled,
                config: s.config
                  ? (s.config as Record<string, unknown>)
                  : next[s.blockType as BlockType].config,
              };
            }
          }
          return next;
        });
      } catch (err) {
        console.error("[BlockSidebar] Failed to load settings:", err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [newsletterId]);

  // Fetch preview data for a block
  const fetchPreview = useCallback(
    async (blockType: BlockType) => {
      setLoadingPreviews((prev) => ({ ...prev, [blockType]: true }));
      try {
        const config = settings[blockType]?.config as Record<string, unknown> | undefined;
        let url = `/api/admin/newsletters/${newsletterId}/block-data?blockType=${blockType}`;
        if (blockType === "simchas" && config?.simchaTypes) {
          url += `&simchaTypes=${(config.simchaTypes as string[]).join(",")}`;
        }
        const res = await fetch(url);
        if (!res.ok) return;
        const json = await res.json();
        setPreviewData((prev) => ({
          ...prev,
          [blockType]: { data: json.data, isEmpty: json.isEmpty },
        }));
      } catch (err) {
        console.error("[BlockSidebar] Failed to fetch preview:", err);
      } finally {
        setLoadingPreviews((prev) => ({ ...prev, [blockType]: false }));
      }
    },
    [newsletterId, settings]
  );

  // Auto-fetch Omer preview on mount (read-only block)
  useEffect(() => {
    fetchPreview("omer");
  }, [fetchPreview]);

  // Save a single block setting to API
  const saveBlockSetting = useCallback(
    async (blockType: BlockType, isEnabled: boolean, config?: Record<string, unknown>) => {
      setIsSaving(true);
      try {
        await fetch(`/api/admin/newsletters/${newsletterId}/block-settings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blockType, isEnabled, config }),
        });
      } catch (err) {
        console.error("[BlockSidebar] Failed to save setting:", err);
      } finally {
        setIsSaving(false);
      }
    },
    [newsletterId]
  );

  const handleToggle = useCallback(
    (blockType: BlockType, enabled: boolean) => {
      setSettings((prev) => {
        const updated = {
          ...prev,
          [blockType]: { ...prev[blockType], isEnabled: enabled },
        };
        return updated;
      });
      saveBlockSetting(blockType, enabled, settings[blockType]?.config);
      // Auto-fetch preview when enabling a block
      if (enabled) {
        setTimeout(() => fetchPreview(blockType), 0);
        setExpandedPreviews((prev) => ({ ...prev, [blockType]: true }));
      }
    },
    [settings, saveBlockSetting, fetchPreview]
  );

  const handleConfigChange = useCallback(
    (blockType: BlockType, config: Record<string, unknown>) => {
      setSettings((prev) => ({
        ...prev,
        [blockType]: { ...prev[blockType], config },
      }));
      saveBlockSetting(blockType, settings[blockType]?.isEnabled ?? false, config);
      // Re-fetch preview with new config
      setTimeout(() => fetchPreview(blockType), 100);
    },
    [settings, saveBlockSetting, fetchPreview]
  );

  const handleExpandPreview = useCallback(
    (blockType: BlockType) => {
      const willExpand = !expandedPreviews[blockType];
      setExpandedPreviews((prev) => ({ ...prev, [blockType]: willExpand }));
      if (willExpand && !previewData[blockType]) {
        fetchPreview(blockType);
      }
    },
    [expandedPreviews, previewData, fetchPreview]
  );

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center py-4 w-10 border-l bg-gray-50">
        <button
          type="button"
          onClick={onCollapseToggle}
          className="p-1.5 rounded hover:bg-gray-200 transition-colors"
          title="Expand content blocks panel"
        >
          <ChevronLeft className="h-4 w-4 text-gray-500" />
        </button>
        <span className="mt-3 text-xs text-gray-400 [writing-mode:vertical-rl] rotate-180 select-none">
          Content Blocks
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-80 border-l bg-gray-50 overflow-hidden flex-shrink-0">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b bg-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-800">Content Blocks</h3>
          {isSaving && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
        </div>
        <button
          type="button"
          onClick={onCollapseToggle}
          className="p-1 rounded hover:bg-gray-100 transition-colors"
          title="Collapse panel"
        >
          <ChevronRight className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {/* Scrollable block list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : (
          BLOCKS.map((meta) => {
            // Hide Omer if not Omer period (after data loaded)
            if (
              meta.readOnly &&
              previewData[meta.type] !== null &&
              !(previewData[meta.type]?.data as { isOmer?: boolean })?.isOmer
            ) {
              return null;
            }

            return (
              <BlockCard
                key={meta.type}
                meta={meta}
                setting={settings[meta.type]}
                previewData={previewData[meta.type]}
                isLoadingPreview={loadingPreviews[meta.type]}
                onToggle={(enabled) => handleToggle(meta.type, enabled)}
                onConfigChange={(config) => handleConfigChange(meta.type, config)}
                onExpandPreview={() => handleExpandPreview(meta.type)}
                isPreviewExpanded={expandedPreviews[meta.type]}
              />
            );
          })
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-2 border-t bg-white flex-shrink-0">
        <p className="text-xs text-gray-400">
          Enabled blocks will be appended to your newsletter at send time.
        </p>
      </div>
    </div>
  );
}
