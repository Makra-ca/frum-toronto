import { Metadata } from "next";
import { BlogListing } from "@/components/blog/BlogListing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog | FrumToronto",
  description:
    "Articles, Torah thoughts, and community news from the Toronto Orthodox community",
};

export default function BlogPage() {
  return <BlogListing />;
}
