"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { NewsletterForm } from "@/components/admin/NewsletterForm";
import type { Newsletter } from "@/types/newsletter";

export default function EditNewsletterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNewsletter = async () => {
      try {
        const res = await fetch(`/api/admin/newsletters/${id}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("Newsletter not found");
          } else {
            throw new Error("Failed to fetch");
          }
          return;
        }
        const data = await res.json();
        setNewsletter(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load newsletter");
      } finally {
        setIsLoading(false);
      }
    };

    fetchNewsletter();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Loading newsletter...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <p className="text-red-500">{error}</p>
        <button
          onClick={() => router.push("/admin/newsletters")}
          className="text-blue-600 hover:underline"
        >
          Back to newsletters
        </button>
      </div>
    );
  }

  if (!newsletter) {
    return null;
  }

  return <NewsletterForm newsletter={newsletter} />;
}
