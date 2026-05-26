"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { BarChart2, TrendingUp, TrendingDown, Users, Eye, UserPlus, FileText } from "lucide-react";
import type { AnalyticsData } from "@/lib/analytics/queries";

// ---------------------------------------------------------------------------
// Time range helpers
// ---------------------------------------------------------------------------

function resolveApiParams(range: string, from: string, to: string) {
  if (from && to) {
    return `startDate=${from}&endDate=${to}`;
  }
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  return `days=${days}`;
}

function rangeLabel(range: string, from: string, to: string) {
  if (from && to) return `${from} to ${to}`;
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  return `Last ${days} days`;
}

// ---------------------------------------------------------------------------
// Trend display
// ---------------------------------------------------------------------------

function trendPct(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((current - prev) / prev) * 100);
}

function TrendBadge({ current, prev }: { current: number; prev: number }) {
  const pct = trendPct(current, prev);
  if (pct === null) return <span className="text-xs text-gray-400">—</span>;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? "text-green-600" : "text-red-500"}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}{pct}%
    </span>
  );
}

// ---------------------------------------------------------------------------
// Overview cards
// ---------------------------------------------------------------------------

function OverviewCard({
  icon: Icon,
  label,
  value,
  prev,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  prev: number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 flex items-start gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value.toLocaleString()}</p>
        <div className="mt-1">
          <TrendBadge current={value} prev={prev} />
          <span className="text-xs text-gray-400 ml-1">vs prev period</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSS bar chart for signup trend
// ---------------------------------------------------------------------------

function SignupChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">User Signups Over Time</h3>
        <p className="text-sm text-gray-400 text-center py-8">No signup data for this period.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">User Signups Over Time</h3>
      <div className="flex items-end gap-1 h-40 overflow-x-auto pb-6 relative">
        {data.map((point) => {
          const heightPct = Math.round((point.count / max) * 100);
          const shortDate = point.date.slice(5); // MM-DD
          return (
            <div
              key={point.date}
              className="flex flex-col items-center flex-shrink-0"
              style={{ minWidth: Math.max(20, Math.floor(560 / data.length)) }}
              title={`${point.date}: ${point.count} signups`}
            >
              <span className="text-xs text-gray-500 mb-1">{point.count > 0 ? point.count : ""}</span>
              <div
                className="w-full bg-blue-500 rounded-t"
                style={{ height: `${Math.max(heightPct, point.count > 0 ? 4 : 0)}%` }}
              />
              <span
                className="text-xs text-gray-400 mt-1 truncate w-full text-center"
                style={{ fontSize: "10px" }}
              >
                {shortDate}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic table section
// ---------------------------------------------------------------------------

function TableSection({
  title,
  rows,
  columns,
  emptyText = "No data for this period.",
}: {
  title: string;
  rows: Record<string, unknown>[];
  columns: { label: string; key: string; render?: (row: Record<string, unknown>) => React.ReactNode }[];
  emptyText?: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8 px-5">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-2.5 text-gray-700">
                      {col.render ? col.render(row) : String(row[col.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content submissions
// ---------------------------------------------------------------------------

function ContentSubmissions({ data }: { data: AnalyticsData["contentSubmissions"] }) {
  const rows = [
    { label: "Businesses", count: data.businesses },
    { label: "Events", count: data.events },
    { label: "Blog Posts", count: data.blogPosts },
    { label: "Classifieds", count: data.classifieds },
    { label: "Shiurim", count: data.shiurim },
    { label: "Shiva Notices", count: data.shiva },
    { label: "Simchas", count: data.simchas },
    { label: "Tehillim Requests", count: data.tehillim },
    { label: "Ask the Rabbi", count: data.askTheRabbi },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">Content Submissions</h3>
      </div>
      <div className="divide-y divide-gray-100">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-gray-700">{r.label}</span>
            <span className="text-sm font-semibold text-gray-900">{r.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Time range selector
// ---------------------------------------------------------------------------

const PRESETS = [
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
];

function TimeRangeSelector({
  range,
  from,
  to,
  onChange,
}: {
  range: string;
  from: string;
  to: string;
  onChange: (range: string, from: string, to: string) => void;
}) {
  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);
  const isCustom = !!from && !!to;

  function applyCustom() {
    if (localFrom && localTo) {
      onChange("custom", localFrom, localTo);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-md border border-gray-200 overflow-hidden">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => onChange(p.value, "", "")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              !isCustom && range === p.value
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={localFrom}
          onChange={(e) => setLocalFrom(e.target.value)}
          className="text-sm border border-gray-200 rounded px-2 py-1.5 text-gray-700"
        />
        <span className="text-gray-400 text-sm">to</span>
        <input
          type="date"
          value={localTo}
          onChange={(e) => setLocalTo(e.target.value)}
          className="text-sm border border-gray-200 rounded px-2 py-1.5 text-gray-700"
        />
        <button
          onClick={applyCustom}
          disabled={!localFrom || !localTo}
          className="px-3 py-1.5 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-200 disabled:opacity-40"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const [range, setRange] = useState("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (r: string, f: string, t: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = resolveApiParams(r, f, t);
      const res = await fetch(`/api/admin/analytics?${qs}`);
      if (!res.ok) throw new Error("Failed to load analytics");
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError("Could not load analytics data.");
      console.error("[Analytics]", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(range, from, to);
  }, [fetchData, range, from, to]);

  function handleRangeChange(newRange: string, newFrom: string, newTo: string) {
    setRange(newRange);
    setFrom(newFrom);
    setTo(newTo);
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <BarChart2 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            <p className="text-sm text-gray-500">{rangeLabel(range, from, to)}</p>
          </div>
        </div>
        <TimeRangeSelector range={range} from={from} to={to} onChange={handleRangeChange} />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-5 h-28 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && data && (
        <>
          {/* Overview cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <OverviewCard
              icon={Eye}
              label="Total Page Views"
              value={data.overview.totalViews}
              prev={data.overview.prevTotalViews}
              color="bg-blue-500"
            />
            <OverviewCard
              icon={Users}
              label="Unique Visitors"
              value={data.overview.uniqueVisitors}
              prev={data.overview.prevUniqueVisitors}
              color="bg-indigo-500"
            />
            <OverviewCard
              icon={UserPlus}
              label="New Signups"
              value={data.overview.newSignups}
              prev={data.overview.prevNewSignups}
              color="bg-green-500"
            />
            <OverviewCard
              icon={FileText}
              label="Content Submitted"
              value={Object.values(data.contentSubmissions).reduce((a, b) => a + b, 0)}
              prev={0}
              color="bg-amber-500"
            />
          </div>

          {/* Signup trend chart */}
          <SignupChart data={data.signupTrend} />

          {/* Top Pages */}
          <TableSection
            title="Top Pages"
            rows={data.topPages as unknown as Record<string, unknown>[]}
            columns={[
              { label: "URL", key: "url", render: (r) => <span className="font-mono text-xs text-gray-600 break-all">{String(r.url)}</span> },
              { label: "Views", key: "views", render: (r) => <span className="font-semibold">{Number(r.views).toLocaleString()}</span> },
              { label: "Unique Views", key: "uniqueViews", render: (r) => Number(r.uniqueViews).toLocaleString() },
            ]}
          />

          {/* Top Businesses & Blog Posts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TableSection
              title="Top Businesses"
              rows={data.topBusinesses as unknown as Record<string, unknown>[]}
              columns={[
                {
                  label: "Business",
                  key: "name",
                  render: (r) => (
                    <Link
                      href={`/admin/businesses`}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {String(r.name)}
                    </Link>
                  ),
                },
                { label: "Views", key: "views", render: (r) => <span className="font-semibold">{Number(r.views).toLocaleString()}</span> },
              ]}
            />

            <TableSection
              title="Top Blog Posts"
              rows={data.topBlogPosts as unknown as Record<string, unknown>[]}
              columns={[
                {
                  label: "Post",
                  key: "title",
                  render: (r) => (
                    <Link
                      href={`/blog/${String(r.slug)}`}
                      className="text-blue-600 hover:underline font-medium"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {String(r.title)}
                    </Link>
                  ),
                },
                { label: "Views", key: "views", render: (r) => <span className="font-semibold">{Number(r.views).toLocaleString()}</span> },
              ]}
            />
          </div>

          {/* Top Events */}
          <TableSection
            title="Top Events"
            rows={data.topEvents as unknown as Record<string, unknown>[]}
            columns={[
              { label: "Event", key: "title", render: (r) => <span className="font-medium">{String(r.title)}</span> },
              { label: "Views", key: "views", render: (r) => <span className="font-semibold">{Number(r.views).toLocaleString()}</span> },
            ]}
          />

          {/* Search queries & Content submissions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TableSection
              title="Top Search Queries"
              rows={data.topSearchQueries as unknown as Record<string, unknown>[]}
              columns={[
                { label: "Query", key: "query", render: (r) => <span className="font-medium">{String(r.query)}</span> },
                {
                  label: "Type",
                  key: "searchType",
                  render: (r) => (
                    <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                      {String(r.searchType)}
                    </span>
                  ),
                },
                { label: "Count", key: "count", render: (r) => <span className="font-semibold">{Number(r.count).toLocaleString()}</span> },
              ]}
            />

            <ContentSubmissions data={data.contentSubmissions} />
          </div>
        </>
      )}
    </div>
  );
}
