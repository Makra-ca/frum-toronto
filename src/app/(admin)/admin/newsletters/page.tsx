"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Pencil, Trash2, Send, Copy, Users, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import type { Newsletter } from "@/types/newsletter";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  scheduled: "bg-blue-100 text-blue-800",
  sending: "bg-yellow-100 text-yellow-800",
  sent: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

export default function NewslettersPage() {
  const router = useRouter();
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    fetchNewsletters();
  }, []);

  const fetchNewsletters = async () => {
    try {
      const res = await fetch("/api/admin/newsletters");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setNewsletters(data.newsletters);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load newsletters");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const res = await fetch(`/api/admin/newsletters/${deleteId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }

      toast.success("Newsletter deleted");
      setNewsletters((prev) => prev.filter((n) => n.id !== deleteId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete newsletter");
    } finally {
      setDeleteId(null);
    }
  };

  const handleDuplicate = async (newsletter: Newsletter) => {
    try {
      const res = await fetch("/api/admin/newsletters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${newsletter.title} (Copy)`,
          subject: newsletter.subject,
          previewText: newsletter.previewText,
          content: newsletter.content,
          contentJson: newsletter.contentJson,
          status: "draft",
        }),
      });

      if (!res.ok) throw new Error("Failed to duplicate");

      const newNewsletter = await res.json();
      toast.success("Newsletter duplicated");
      router.push(`/admin/newsletters/${newNewsletter.id}`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to duplicate newsletter");
    }
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Newsletters</h1>
            <p className="text-gray-600 mt-1">Create and manage email newsletters</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Newsletters</h1>
          <p className="text-gray-600 mt-1">Create and manage email newsletters</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/newsletters/subscribers">
              <Users className="h-4 w-4 mr-2" />
              Subscribers
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/newsletters/segments">
              <BarChart3 className="h-4 w-4 mr-2" />
              Segments
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/newsletters/new">
              <Plus className="h-4 w-4 mr-2" />
              New Newsletter
            </Link>
          </Button>
        </div>
      </div>

      {/* Table */}
      {newsletters.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 mb-4">No newsletters yet</p>
          <Button asChild>
            <Link href="/admin/newsletters/new">
              <Plus className="h-4 w-4 mr-2" />
              Create your first newsletter
            </Link>
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead className="w-[70px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {newsletters.map((newsletter) => (
                <TableRow key={newsletter.id}>
                  <TableCell className="font-medium">{newsletter.title}</TableCell>
                  <TableCell className="text-gray-600">{newsletter.subject}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[newsletter.status] || "bg-gray-100"}>
                      {newsletter.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm">
                    {formatDate(newsletter.createdAt)}
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm">
                    {formatDate(newsletter.sentAt)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => router.push(`/admin/newsletters/${newsletter.id}`)}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(newsletter)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        {newsletter.status === "draft" && (
                          <DropdownMenuItem
                            onClick={() => router.push(`/admin/newsletters/${newsletter.id}?send=true`)}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Send
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => setDeleteId(newsletter.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Newsletter</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this newsletter? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
