"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Download,
  ChevronDown,
  ChevronRight,
  Loader2,
  ScrollText,
  Filter,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AuditEntry {
  id: number;
  actorId: number | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: number | null;
  entityTitle: string | null;
  changes: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}

const ACTION_TYPES = [
  { value: "all", label: "All Actions" },
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
  { value: "approve", label: "Approve" },
  { value: "reject", label: "Reject" },
  { value: "login", label: "Login" },
];

const ENTITY_TYPES = [
  { value: "all", label: "All Entities" },
  { value: "business", label: "Business" },
  { value: "shul", label: "Shul" },
  { value: "event", label: "Event" },
  { value: "shiur", label: "Shiur" },
  { value: "blog_post", label: "Blog Post" },
  { value: "classified", label: "Classified" },
  { value: "user", label: "User" },
  { value: "newsletter", label: "Newsletter" },
  { value: "kosher_alert", label: "Kosher Alert" },
  { value: "simcha", label: "Simcha" },
  { value: "shiva", label: "Shiva" },
];

function actionBadgeVariant(action: string): string {
  switch (action) {
    case "create":
      return "bg-green-100 text-green-700 border-green-200";
    case "update":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "delete":
      return "bg-red-100 text-red-700 border-red-200";
    case "approve":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "reject":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "login":
      return "bg-purple-100 text-purple-700 border-purple-200";
    default:
      return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function exportToCsv(entries: AuditEntry[]) {
  const headers = ["ID", "Time", "Actor", "Action", "Entity Type", "Entity ID", "Entity Title", "IP Address"];
  const rows = entries.map((e) => [
    e.id,
    formatDateTime(e.createdAt),
    e.actorEmail || "(unknown)",
    e.action,
    e.entityType,
    e.entityId ?? "",
    e.entityTitle ?? "",
    e.ipAddress ?? "",
  ]);

  const csv = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function MetadataViewer({ changes }: { changes: Record<string, unknown> | null }) {
  if (!changes || Object.keys(changes).length === 0) {
    return <span className="text-gray-400 text-sm">No details</span>;
  }
  return (
    <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-3 overflow-auto max-h-60 whitespace-pre-wrap break-all text-gray-700">
      {JSON.stringify(changes, null, 2)}
    </pre>
  );
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [action, setAction] = useState("all");
  const [entityType, setEntityType] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 on filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, action, entityType, dateFrom, dateTo]);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "50");
      if (action && action !== "all") params.set("action", action);
      if (entityType && entityType !== "all") params.set("entityType", entityType);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/admin/audit-log?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = await res.json();

      let data: AuditEntry[] = json.data ?? [];

      // Client-side filter by search (action or entityType text)
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.trim().toLowerCase();
        data = data.filter(
          (e) =>
            e.action.toLowerCase().includes(q) ||
            e.entityType.toLowerCase().includes(q) ||
            (e.actorEmail?.toLowerCase().includes(q) ?? false) ||
            (e.entityTitle?.toLowerCase().includes(q) ?? false)
        );
      }

      setEntries(data);
      setPagination(json.pagination);
    } catch {
      // Silently ignore
    } finally {
      setLoading(false);
    }
  }, [page, action, entityType, dateFrom, dateTo, debouncedSearch]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hasFilters = action !== "all" || entityType !== "all" || dateFrom || dateTo || search;

  const clearFilters = () => {
    setSearch("");
    setAction("all");
    setEntityType("all");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ScrollText className="h-6 w-6 text-gray-600" />
            Audit Log
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track all admin actions across the platform.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => exportToCsv(entries)}
          disabled={entries.length === 0}
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow mb-4 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filters</span>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
            >
              <X className="h-3 w-3" />
              Clear all
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Search action, entity, user…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>

          {/* Action */}
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              {ACTION_TYPES.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Entity Type */}
          <Select value={entityType} onValueChange={setEntityType}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Entity Type" />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_TYPES.map((e) => (
                <SelectItem key={e.value} value={e.value}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date From */}
          <div>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-sm"
              placeholder="From date"
            />
          </div>

          {/* Date To */}
          <div>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-sm"
              placeholder="To date"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <ScrollText className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">No audit log entries found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left font-semibold w-8" />
                    <th className="px-4 py-3 text-left font-semibold">Time</th>
                    <th className="px-4 py-3 text-left font-semibold">User</th>
                    <th className="px-4 py-3 text-left font-semibold">Action</th>
                    <th className="px-4 py-3 text-left font-semibold">Entity Type</th>
                    <th className="px-4 py-3 text-left font-semibold">Entity</th>
                    <th className="px-4 py-3 text-left font-semibold">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {entries.map((entry) => {
                    const isExpanded = expandedRows.has(entry.id);
                    const hasDetails =
                      entry.changes && Object.keys(entry.changes).length > 0;

                    return (
                      <>
                        <tr
                          key={entry.id}
                          className={cn(
                            "transition-colors",
                            hasDetails ? "cursor-pointer hover:bg-gray-50" : ""
                          )}
                          onClick={() => hasDetails && toggleRow(entry.id)}
                        >
                          <td className="px-4 py-3">
                            {hasDetails ? (
                              isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-gray-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-400" />
                              )
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                            {formatDateTime(entry.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate">
                            {entry.actorEmail ?? (
                              <span className="text-gray-400 italic">System</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
                                actionBadgeVariant(entry.action)
                              )}
                            >
                              {entry.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 capitalize">
                            {entry.entityType.replace(/_/g, " ")}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            <span className="flex items-center gap-1.5">
                              {entry.entityTitle && (
                                <span className="font-medium truncate max-w-[160px]">
                                  {entry.entityTitle}
                                </span>
                              )}
                              {entry.entityId && (
                                <span className="text-gray-400 text-xs">
                                  #{entry.entityId}
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                            {entry.ipAddress ?? "—"}
                          </td>
                        </tr>
                        {isExpanded && hasDetails && (
                          <tr key={`${entry.id}-details`} className="bg-gray-50">
                            <td />
                            <td colSpan={6} className="px-4 pb-4 pt-1">
                              <div className="border-l-2 border-blue-200 pl-3">
                                <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                                  Change Details
                                </p>
                                <MetadataViewer changes={entry.changes} />
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="px-4 py-4 border-t bg-gray-50 flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  {pagination.totalCount.toLocaleString()} total entries
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-gray-600 px-2">
                    Page {page} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
