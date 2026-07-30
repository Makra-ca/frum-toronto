"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Loader2, Check } from "lucide-react";
import { Input } from "@/components/ui/input";

export interface PickableUser {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role?: string;
}

interface UserPickerProps {
  /** Currently selected user, or null. */
  value: PickableUser | null;
  onChange: (user: PickableUser | null) => void;
  placeholder?: string;
  id?: string;
  maxSuggestions?: number;
}

const DEBOUNCE_MS = 300; // matches UniversalSearch

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  shul: "bg-amber-100 text-amber-700",
  business: "bg-blue-100 text-blue-700",
  content_contributor: "bg-teal-100 text-teal-700",
  member: "bg-gray-100 text-gray-600",
};

export function displayUser(u: PickableUser): string {
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  return name ? `${name} (${u.email})` : u.email;
}

/**
 * Type-to-search user picker, built on the same pattern as the public
 * UniversalSearch: debounced query, AbortController so a slow earlier response
 * cannot overwrite a newer one, an overlay dropdown, keyboard navigation,
 * click-outside dismissal and match highlighting.
 *
 * It exists because `users` went from 44 rows to ~3,150 in the legacy import,
 * which made the previous "render every user as a <SelectItem>" dropdown
 * unusable — and /api/admin/users is now paginated, so that approach would only
 * ever have listed the first page anyway.
 *
 * The query state is deliberately local and never synced from anywhere else.
 * Feeding an external value back into a controlled input mid-typing is what
 * makes characters disappear.
 */
export function UserPicker({
  value,
  onChange,
  placeholder = "Search by name or email…",
  id,
  maxSuggestions = 8,
}: UserPickerProps) {
  const [query, setQuery] = useState(value ? displayUser(value) : "");
  const [results, setResults] = useState<PickableUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const listboxId = `${id ?? "user-picker"}-listbox`;

  const fetchUsers = useCallback(
    async (search: string) => {
      // Cancel the previous request so a slow earlier response cannot land after
      // a newer one and show results for a query the user has moved past.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      try {
        const params = new URLSearchParams({ limit: String(maxSuggestions) });
        if (search.trim()) params.set("search", search.trim());

        const res = await fetch(`/api/admin/users?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);

        const payload = await res.json();
        const rows: PickableUser[] = payload.data ?? [];
        setResults(rows);
        setIsOpen(true);
        setSelectedIndex(-1);
      } catch (error: unknown) {
        if (error instanceof Error && error.name !== "AbortError") {
          console.error("Error loading users:", error);
          setResults([]);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [maxSuggestions]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setQuery(next);

    // Editing the text invalidates the selection. Without this the caller could
    // submit a stale user id while the field displays something else entirely.
    if (value) onChange(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchUsers(next), DEBOUNCE_MS);
  };

  const handleSelect = (user: PickableUser) => {
    onChange(user);
    setQuery(displayUser(user));
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" && !isOpen) {
      e.preventDefault();
      fetchUsers(query);
      return;
    }
    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((p) => (p < results.length - 1 ? p + 1 : p));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((p) => (p > 0 ? p - 1 : -1));
        break;
      case "Enter":
        // Only intercept Enter when a row is highlighted, so it never blocks the
        // dialog's own submit.
        if (selectedIndex >= 0 && results[selectedIndex]) {
          e.preventDefault();
          handleSelect(results[selectedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    onChange(null);
    inputRef.current?.focus();
  };

  // Click outside closes the dropdown.
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const highlight = (text: string, q: string) => {
    const words = q
      .trim()
      .split(/\s+/)
      .filter((w) => w.length >= 2)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (words.length === 0) return text;

    const regex = new RegExp(`(${words.join("|")})`, "gi");
    return text.split(regex).map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 text-gray-900 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 z-10 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
        <Input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
            else if (!value) fetchUsers(query);
          }}
          placeholder={placeholder}
          className="pl-9 pr-16"
          autoComplete="off"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
          {value && !isLoading && <Check className="h-4 w-4 text-green-600" />}
          {query && !isLoading && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50">
          {results.length > 0 ? (
            <ul id={listboxId} role="listbox" className="max-h-64 overflow-y-auto py-1">
              {results.map((user, index) => {
                const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
                const isActive = selectedIndex === index;
                return (
                  <li key={user.id} role="option" aria-selected={isActive}>
                    <button
                      type="button"
                      onClick={() => handleSelect(user)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full px-4 py-2.5 text-left transition-colors ${
                        isActive ? "bg-blue-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 text-sm leading-snug truncate">
                            {name ? highlight(name, query) : <span className="text-gray-500">No name</span>}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {highlight(user.email, query)}
                          </div>
                        </div>
                        {user.role && (
                          <span
                            className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded ${
                              ROLE_COLORS[user.role] ?? "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {user.role.replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            !isLoading && (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-gray-500">No users found</p>
              </div>
            )
          )}

          {results.length >= maxSuggestions && (
            <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
              Showing the first {maxSuggestions} matches &mdash; keep typing to narrow it down.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
