import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { paginationItems } from "@/lib/pagination-items";

interface PaginationLinksProps {
  /** Path without query string, e.g. "/simchas". */
  basePath: string;
  currentPage: number;
  totalPages: number;
  /**
   * Query params to carry across page links (filters etc). The `page` key is
   * managed here and any value passed for it is ignored.
   */
  preserveParams?: Record<string, string | undefined>;
}

/**
 * Link-based pagination for server components.
 *
 * The equivalent control in BlogListing.tsx is client-side (useState + fetch),
 * which suits a page that already streams results over an API. A server-rendered
 * list wants links instead: each page gets a real shareable URL, it works with
 * JavaScript disabled, and the page stays a server component with no hydration.
 */
export function PaginationLinks({
  basePath,
  currentPage,
  totalPages,
  preserveParams = {},
}: PaginationLinksProps) {
  if (totalPages <= 1) return null;

  const href = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(preserveParams)) {
      if (key !== "page" && value) params.set(key, value);
    }
    // Page 1 is the canonical bare URL — avoids two URLs for identical content.
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const items = paginationItems(currentPage, totalPages);

  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <nav
      className="flex items-center justify-center gap-2 mt-10"
      aria-label="Pagination"
    >
      {hasPrev ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={href(currentPage - 1)} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}

      {items.map((item, idx) =>
        item === "ellipsis" ? (
          <span key={`ellipsis-${idx}`} className="px-2 text-gray-400" aria-hidden="true">
            ...
          </span>
        ) : (
          <Button
            key={item}
            variant={item === currentPage ? "default" : "outline"}
            size="sm"
            className="min-w-[36px]"
            asChild
          >
            <Link
              href={href(item)}
              aria-label={`Page ${item}`}
              aria-current={item === currentPage ? "page" : undefined}
            >
              {item}
            </Link>
          </Button>
        )
      )}

      {hasNext ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={href(currentPage + 1)} aria-label="Next page">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </nav>
  );
}
