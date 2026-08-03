/** Shared types for the Ask the Rabbi management screens. */

export interface Question {
  id: number;
  questionNumber: number | null;
  title: string;
  question: string;
  answer: string | null;
  answeredBy: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  viewCount: number | null;
  commentCount: number;
}

export interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}
