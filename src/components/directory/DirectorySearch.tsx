"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

interface DirectorySearchProps {
  defaultValue?: string;
  placeholder?: string;
  size?: "default" | "large";
  showButton?: boolean;
  className?: string;
  autoFocus?: boolean;
}

export function DirectorySearch({
  defaultValue = "",
  placeholder = "Search businesses...",
  size = "default",
  showButton = true,
  className = "",
  autoFocus = false,
}: DirectorySearchProps) {
  const [query, setQuery] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/directory/search?q=${encodeURIComponent(query.trim())}`);
    } else {
      router.push("/directory/search");
    }
  };

  const handleClear = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  const inputHeight = size === "large" ? "h-14" : "h-10";
  const buttonHeight = size === "large" ? "h-14" : "h-10";
  const iconSize = size === "large" ? "h-5 w-5" : "h-4 w-4";

  return (
    <form onSubmit={handleSubmit} className={`flex gap-2 ${className}`}>
      <div className="relative flex-1">
        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${iconSize} text-gray-400`} />
        <Input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={`pl-12 ${inputHeight} bg-white text-gray-900 border-gray-200 text-base rounded-xl pr-10`}
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {showButton && (
        <Button
          type="submit"
          size="lg"
          className={`${buttonHeight} px-6 rounded-xl bg-blue-600 hover:bg-blue-700`}
        >
          Search
        </Button>
      )}
    </form>
  );
}

// Compact search for header/navbar
export function CompactDirectorySearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/directory/search?q=${encodeURIComponent(query.trim())}`);
      setIsOpen(false);
      setQuery("");
    }
  };

  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="text-gray-600 hover:text-gray-900"
      >
        <Search className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div className="relative">
        <Input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          className="h-9 w-48 pl-3 pr-8 text-sm rounded-lg"
          onBlur={() => {
            if (!query) {
              setIsOpen(false);
            }
          }}
        />
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setIsOpen(false);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
