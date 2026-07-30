"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ROLES = [
  { value: "all", label: "All roles" },
  { value: "admin", label: "Admin" },
  { value: "shul", label: "Shul" },
  { value: "business", label: "Business" },
  { value: "content_contributor", label: "Content contributor" },
  { value: "member", label: "Member" },
];

const DEBOUNCE_MS = 300; // matches UniversalSearch

/**
 * Search + role filter for /admin/users.
 *
 * Both are driven through the URL rather than local state so the server
 * component does the filtering in Postgres. With ~3,150 users, client-side
 * filtering would mean shipping the whole table to the browser — which is what
 * this page used to do.
 */
export function UserFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const urlSearch = searchParams.get("search") ?? "";
  const urlRole = searchParams.get("role") ?? "all";

  const [search, setSearch] = useState(urlSearch);

  /**
   * The last value this component pushed into the URL.
   *
   * Without it, characters vanish while typing. The debounce pushes "ab", the
   * user types "c" so local state is "abc", then the navigation commits and
   * `urlSearch` becomes "ab" — and a naive `setSearch(urlSearch)` sync would
   * overwrite "abc" with the older "ab", eating the "c".
   *
   * Comparing against what we pushed distinguishes our own navigation (ignore,
   * the input is already ahead) from a genuine external one such as back/forward
   * or the "Clear filters" link (adopt it).
   */
  const lastPushedSearch = useRef(urlSearch);

  useEffect(() => {
    if (urlSearch === lastPushedSearch.current) return;
    lastPushedSearch.current = urlSearch;
    setSearch(urlSearch);
  }, [urlSearch]);

  const pushParams = (next: { search?: string; role?: string }) => {
    const params = new URLSearchParams(searchParams.toString());

    if (next.search !== undefined) {
      // Record it before navigating so the sync effect recognises the resulting
      // URL change as ours and leaves the input alone.
      lastPushedSearch.current = next.search;
      if (next.search) params.set("search", next.search);
      else params.delete("search");
    }
    if (next.role !== undefined) {
      if (next.role && next.role !== "all") params.set("role", next.role);
      else params.delete("role");
    }

    // Any change to the filters invalidates the current page number.
    params.delete("page");

    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `/admin/users?${qs}` : "/admin/users", { scroll: false });
    });
  };

  // Debounce the text input; a keystroke-per-query would hammer the database.
  useEffect(() => {
    if (search === urlSearch) return;
    const t = setTimeout(() => pushParams({ search }), DEBOUNCE_MS);
    return () => clearTimeout(t);
    // pushParams is recreated each render but closes only over searchParams,
    // which is already covered by urlSearch/urlRole changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, urlSearch]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          // Not type="search": Chromium renders its own clear button for that
          // type, which appeared alongside the styled one below as a second X.
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="pl-9 pr-9"
          aria-label="Search users by name or email"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Select value={urlRole} onValueChange={(role) => pushParams({ role })}>
        <SelectTrigger className="sm:w-56" aria-label="Filter by role">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLES.map((r) => (
            <SelectItem key={r.value} value={r.value}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isPending && (
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" aria-label="Loading" />
      )}
    </div>
  );
}
