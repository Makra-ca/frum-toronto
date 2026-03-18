export type SearchType =
  | "businesses"
  | "classifieds"
  | "shuls"
  | "shiurim"
  | "events"
  | "ask-the-rabbi"
  | "all";

export interface SearchSuggestion {
  id: string;
  title: string;
  subtitle?: string;
  url: string;
  type: SearchType;
  relevanceScore: number;
}

export interface SuggestionsResponse {
  suggestions: SearchSuggestion[];
}
