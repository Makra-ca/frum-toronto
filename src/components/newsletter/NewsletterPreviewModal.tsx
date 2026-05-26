"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertTriangle,
  Send,
  Mail,
  Loader2,
  RefreshCw,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

interface NewsletterPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newsletterId: number;
  previewHtml: string | null;
  previewGeneratedAt: string | null;
  blocksIncluded: string[];
  blocksSkipped: string[];
  onRegeneratePreview: () => Promise<void>;
  onSendToAll: () => Promise<void>;
  recipientCount: number;
}

const BLOCK_LABELS: Record<string, string> = {
  omer: "Sefirat HaOmer",
  shoutout: "Business Shoutout",
  atr: "Ask the Rabbi",
  events: "Upcoming Events",
  simchas: "Recent Simchas",
  blogs: "Latest Blog Posts",
  tehillim: "Tehillim List",
};

function getMinutesRemaining(generatedAt: string | null): number {
  if (!generatedAt) return 0;
  const expiry = new Date(generatedAt).getTime() + 30 * 60 * 1000;
  const remaining = Math.floor((expiry - Date.now()) / 60000);
  return Math.max(0, remaining);
}

export function NewsletterPreviewModal({
  open,
  onOpenChange,
  newsletterId,
  previewHtml,
  previewGeneratedAt,
  blocksIncluded,
  blocksSkipped,
  onRegeneratePreview,
  onSendToAll,
  recipientCount,
}: NewsletterPreviewModalProps) {
  const [testEmail, setTestEmail] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSendingAll, setIsSendingAll] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [minutesRemaining, setMinutesRemaining] = useState(() =>
    getMinutesRemaining(previewGeneratedAt)
  );

  // Update countdown every 30s
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      setMinutesRemaining(getMinutesRemaining(previewGeneratedAt));
    }, 30_000);
    return () => clearInterval(interval);
  }, [open, previewGeneratedAt]);

  // Recalculate immediately when previewGeneratedAt changes
  useEffect(() => {
    setMinutesRemaining(getMinutesRemaining(previewGeneratedAt));
  }, [previewGeneratedAt]);

  const isExpired = minutesRemaining === 0 && previewGeneratedAt !== null;

  const handleSendTest = async () => {
    if (!testEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    setIsSendingTest(true);
    try {
      const res = await fetch(`/api/admin/newsletters/${newsletterId}/test-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmail.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send test");
      }

      toast.success(`Test email sent to ${testEmail}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send test email");
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      await onRegeneratePreview();
      toast.success("Preview regenerated");
    } catch {
      toast.error("Failed to regenerate preview");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSendToAll = async () => {
    if (isExpired) {
      toast.error("Preview expired. Regenerate before sending.");
      return;
    }

    setIsSendingAll(true);
    try {
      await onSendToAll();
      onOpenChange(false);
    } catch {
      // Error handled by parent
    } finally {
      setIsSendingAll(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <DialogTitle className="text-base">Email Preview</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: iframe preview */}
          <div className="flex-1 overflow-hidden bg-gray-100 flex items-stretch">
            {previewHtml ? (
              <iframe
                srcDoc={previewHtml}
                sandbox="allow-same-origin"
                className="w-full h-full border-0"
                title="Newsletter preview"
              />
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 text-gray-400 gap-2">
                <Mail className="h-10 w-10 opacity-30" />
                <p className="text-sm">No preview generated yet</p>
              </div>
            )}
          </div>

          {/* Right: action panel */}
          <div className="w-72 border-l flex flex-col overflow-y-auto bg-white flex-shrink-0">
            {/* Blocks included */}
            <div className="p-4 border-b space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">Blocks in this email</h4>

              {blocksIncluded.length > 0 ? (
                <div className="space-y-1.5">
                  {blocksIncluded.map((b) => (
                    <div key={b} className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                      <span className="text-xs text-gray-700">
                        {BLOCK_LABELS[b] ?? b}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No auto-content blocks enabled</p>
              )}

              {blocksSkipped.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-400 font-medium">Skipped (no data):</p>
                  {blocksSkipped.map((b) => (
                    <div key={b} className="flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                      <span className="text-xs text-gray-400">
                        {BLOCK_LABELS[b] ?? b}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Preview expiry */}
            {previewGeneratedAt && (
              <div className="p-4 border-b">
                <div className="flex items-center gap-1.5 mb-2">
                  <Clock className="h-3.5 w-3.5 text-gray-400" />
                  {isExpired ? (
                    <span className="text-xs text-red-600 font-medium">Preview expired</span>
                  ) : (
                    <span className="text-xs text-gray-500">
                      Expires in {minutesRemaining} min
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                >
                  {isRegenerating ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Regenerate Preview
                </Button>
              </div>
            )}

            {/* Test send */}
            <div className="p-4 border-b space-y-2">
              <h4 className="text-sm font-semibold text-gray-700">Send Test Email</h4>
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="text-sm h-8"
                  disabled={!previewHtml || isExpired}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleSendTest}
                  disabled={isSendingTest || !previewHtml || !testEmail.trim() || isExpired}
                >
                  {isSendingTest ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Mail className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Send Test
                </Button>
              </div>
            </div>

            {/* Send to all */}
            <div className="p-4 mt-auto space-y-3">
              <div className="rounded-md bg-blue-50 border border-blue-200 p-3 space-y-1">
                <p className="text-xs font-medium text-blue-800">Ready to send?</p>
                <p className="text-xs text-blue-600">
                  ~{recipientCount.toLocaleString()} recipients
                </p>
                {isExpired && (
                  <p className="text-xs text-red-600 mt-1">
                    Preview expired — regenerate before sending.
                  </p>
                )}
              </div>
              <Button
                type="button"
                className="w-full"
                onClick={handleSendToAll}
                disabled={isSendingAll || !previewHtml || isExpired}
              >
                {isSendingAll ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send to All
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
