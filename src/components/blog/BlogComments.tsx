import { CommentThread } from "@/components/shared/CommentThread";

interface BlogCommentsProps {
  postSlug: string;
  moderationNotice?: boolean;
}

export function BlogComments({
  postSlug,
  moderationNotice = false,
}: BlogCommentsProps) {
  return (
    <CommentThread
      apiBase={`/api/blog/${postSlug}/comments`}
      moderationNotice={moderationNotice}
    />
  );
}
