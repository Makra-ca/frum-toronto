"use client";

import { useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PenLine, Loader2, Upload, X, ImageIcon, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface SubmitQuestionModalProps {
  trigger?: React.ReactNode;
}

export function SubmitQuestionModal({ trigger }: SubmitQuestionModalProps) {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [question, setQuestion] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pre-fill name and email from session when dialog opens
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && session?.user) {
      setName(session.user.name || "");
      setEmail(session.user.email || "");
    }
    if (!open) {
      // Reset form on close
      resetForm();
    }
  };

  const resetForm = () => {
    setName(session?.user?.name || "");
    setEmail(session?.user?.email || "");
    setQuestion("");
    setImageUrl(null);
    setImagePreview(null);
    setIsSuccess(false);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to Vercel Blob
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      const data = await res.json();
      setImageUrl(data.url);
      toast.success("Image uploaded");
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
      setImagePreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = () => {
    setImageUrl(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (!email.trim()) {
      toast.error("Please enter your email");
      return;
    }
    if (!question.trim() || question.trim().length < 10) {
      toast.error("Please enter your question (at least 10 characters)");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/ask-the-rabbi/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          question: question.trim(),
          imageUrl,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit question");
      }

      setIsSuccess(true);
      toast.success("Question submitted successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit question");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Not logged in state
  if (status === "unauthenticated") {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <Button className="bg-purple-600 hover:bg-purple-700">
              <PenLine className="h-4 w-4 mr-2" />
              Submit a Question
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Login Required</DialogTitle>
            <DialogDescription>
              You need to be logged in to submit a question to the Rabbi.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 text-center">
            <p className="text-gray-600 mb-4">
              Create an account to submit questions and receive answers via email.
            </p>
            <div className="flex gap-3 justify-center">
              <Button asChild variant="outline">
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild className="bg-purple-600 hover:bg-purple-700">
                <Link href="/register">Create Account</Link>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-purple-600 hover:bg-purple-700">
            <PenLine className="h-4 w-4 mr-2" />
            Submit a Question
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {isSuccess ? (
          // Success state
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-6 w-6" />
                Question Submitted!
              </DialogTitle>
            </DialogHeader>
            <div className="py-6 text-center">
              <p className="text-gray-600 mb-4">
                Your question has been submitted successfully. You will receive a response via email at <strong>{email}</strong>.
              </p>
              <p className="text-sm text-gray-500">
                Please note that responses may take some time depending on the complexity of your question.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => setIsOpen(false)}>Close</Button>
              <Button
                variant="outline"
                onClick={resetForm}
              >
                Submit Another Question
              </Button>
            </DialogFooter>
          </>
        ) : (
          // Form state
          <>
            <DialogHeader>
              <DialogTitle>Submit a Question</DialogTitle>
              <DialogDescription>
                Submit your halachic question to Hagaon Rav Shlomo Miller Shlit&apos;a. You will receive a response via email.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="question">Your Question *</Label>
                <Textarea
                  id="question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Please describe your halachic question in detail..."
                  rows={6}
                  className="resize-none"
                />
                <p className="text-xs text-gray-500">
                  {question.length}/5000 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label>Attach Image (Optional)</Label>
                {imagePreview ? (
                  <div className="relative inline-block">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-h-32 rounded-lg border"
                    />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    {isUploading && (
                      <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-white" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors"
                  >
                    <ImageIcon className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">
                      Click to upload an image
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      JPG, PNG up to 5MB
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || isUploading}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <PenLine className="h-4 w-4 mr-2" />
                    Submit Question
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
