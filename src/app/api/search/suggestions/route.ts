import { NextRequest, NextResponse } from "next/server";
import {
  searchBusinesses,
  searchClassifieds,
  searchShuls,
  searchShiurim,
  searchEvents,
  searchAskTheRabbi,
  searchBlog,
  searchAll,
} from "@/lib/search/fuzzy-search";
import type { SearchType, SearchSuggestion, SuggestionsResponse } from "@/lib/search/types";
import { recordSearchQuery } from "@/lib/analytics/queries";

export const dynamic = "force-dynamic";

const searchFunctions: Record<
  Exclude<SearchType, "all">,
  (query: string, limit: number) => Promise<SearchSuggestion[]>
> = {
  businesses: searchBusinesses,
  classifieds: searchClassifieds,
  shuls: searchShuls,
  shiurim: searchShiurim,
  events: searchEvents,
  "ask-the-rabbi": searchAskTheRabbi,
  blog: searchBlog,
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() || "";
  const type = searchParams.get("type") as SearchType | null;
  const limit = Math.min(parseInt(searchParams.get("limit") || "8"), 20);

  if (!type) {
    return NextResponse.json(
      { error: "type parameter is required" },
      { status: 400 }
    );
  }

  const minChars = type === "all" ? 3 : 2;
  if (query.length < minChars) {
    return NextResponse.json({ suggestions: [] } satisfies SuggestionsResponse);
  }

  try {
    let suggestions: SearchSuggestion[];

    if (type === "all") {
      suggestions = await searchAll(query, limit);
    } else {
      const searchFn = searchFunctions[type];
      if (!searchFn) {
        return NextResponse.json(
          { error: `Invalid search type: ${type}` },
          { status: 400 }
        );
      }
      suggestions = await searchFn(query, limit);
    }

    // Ensure sorted by relevance
    suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Log search query — fire-and-forget, must not block or break search
    if (query.length >= 2) {
      const sessionId = request.cookies.get("ft_session_id")?.value ?? "unknown";
      recordSearchQuery({
        query,
        searchType: type ?? "all",
        resultsCount: suggestions.length,
        sessionId,
      }).catch((err) => {
        console.error("[Analytics] Failed to log search query:", err);
      });
    }

    return NextResponse.json({ suggestions } satisfies SuggestionsResponse);
  } catch (error) {
    console.error(`[API] Search suggestions error (type=${type}):`, error);
    return NextResponse.json({ suggestions: [] } satisfies SuggestionsResponse);
  }
}
