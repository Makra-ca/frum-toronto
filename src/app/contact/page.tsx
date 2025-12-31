"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, RefreshCw } from "lucide-react";

const CONTACT_CATEGORIES = [
  "General Inquiries",
  "Comments",
  "Questions",
  "Calendar Events",
  "Shiurim",
  "On-Line Shopping",
  "Simchas",
  "Yom Tov Needs",
  "Website",
  "Advertising",
];

function generateCaptcha(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let captcha = "";
  for (let i = 0; i < 6; i++) {
    captcha += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return captcha;
}

export default function ContactPage() {
  const [formData, setFormData] = useState({
    sendTo: "",
    from: "",
    email: "",
    subject: "",
    message: "",
    captchaInput: "",
  });
  const [captcha, setCaptcha] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    setCaptcha(generateCaptcha());
  }, []);

  const refreshCaptcha = () => {
    setCaptcha(generateCaptcha());
    setFormData((prev) => ({ ...prev, captchaInput: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitStatus(null);

    // Validate captcha
    if (formData.captchaInput.toUpperCase() !== captcha) {
      setSubmitStatus({
        type: "error",
        message: "CAPTCHA verification failed. Please try again.",
      });
      refreshCaptcha();
      return;
    }

    // Validate required fields
    if (
      !formData.sendTo ||
      !formData.from ||
      !formData.email ||
      !formData.subject ||
      !formData.message
    ) {
      setSubmitStatus({
        type: "error",
        message: "Please fill in all required fields.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: formData.sendTo,
          name: formData.from,
          email: formData.email,
          subject: formData.subject,
          message: formData.message,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send message");
      }

      setSubmitStatus({
        type: "success",
        message: "Thank you for your message! We will get back to you soon.",
      });
      setFormData({
        sendTo: "",
        from: "",
        email: "",
        subject: "",
        message: "",
        captchaInput: "",
      });
      refreshCaptcha();
    } catch (error) {
      setSubmitStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to send message. Please try again later.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-blue-100 p-3 rounded-full">
                <Mail className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Contact Us</CardTitle>
            <p className="text-muted-foreground mt-2">
              Have a question or comment? We&apos;d love to hear from you.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Send To Dropdown */}
              <div className="space-y-2">
                <Label htmlFor="sendTo">
                  Send to <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.sendTo}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, sendTo: value }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Name Field */}
              <div className="space-y-2">
                <Label htmlFor="from">
                  Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="from"
                  type="text"
                  placeholder="Your name"
                  value={formData.from}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, from: e.target.value }))
                  }
                  required
                />
              </div>

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email">
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  required
                />
              </div>

              {/* Subject Field */}
              <div className="space-y-2">
                <Label htmlFor="subject">
                  Subject <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="subject"
                  type="text"
                  placeholder="Message subject"
                  value={formData.subject}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      subject: e.target.value,
                    }))
                  }
                  required
                />
              </div>

              {/* Message Field */}
              <div className="space-y-2">
                <Label htmlFor="message">
                  Message <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="message"
                  placeholder="Type your message here..."
                  rows={6}
                  value={formData.message}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      message: e.target.value,
                    }))
                  }
                  required
                />
              </div>

              {/* CAPTCHA Field */}
              <div className="space-y-2">
                <Label htmlFor="captcha">
                  Security Verification <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-center gap-3">
                  <div className="bg-gray-200 px-4 py-2 rounded select-none font-mono text-lg tracking-widest font-bold text-gray-700 border border-gray-300">
                    <span
                      style={{
                        letterSpacing: "0.3em",
                        textDecoration: "line-through",
                        textDecorationColor: "rgba(0,0,0,0.2)",
                      }}
                    >
                      {captcha}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={refreshCaptcha}
                    title="Refresh CAPTCHA"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  id="captcha"
                  type="text"
                  placeholder="Enter the characters above"
                  value={formData.captchaInput}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      captchaInput: e.target.value,
                    }))
                  }
                  className="mt-2"
                  required
                />
              </div>

              {/* Submit Status */}
              {submitStatus && (
                <div
                  className={`p-4 rounded-md ${
                    submitStatus.type === "success"
                      ? "bg-green-50 text-green-800 border border-green-200"
                      : "bg-red-50 text-red-800 border border-red-200"
                  }`}
                >
                  {submitStatus.message}
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Sending..." : "Submit"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
