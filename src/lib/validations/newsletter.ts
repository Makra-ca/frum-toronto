import { z } from "zod";

// Newsletter status options
export const NEWSLETTER_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "sending", label: "Sending" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
] as const;

// Newsletter schema for create/edit
export const newsletterSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title is too long"),
  subject: z.string().min(1, "Subject line is required").max(255, "Subject is too long"),
  previewText: z.string().max(200, "Preview text is too long").optional().nullable(),
  content: z.string().min(1, "Content is required"),
  contentJson: z.any().optional().nullable(),
  status: z.enum(["draft", "scheduled", "sending", "sent", "failed"]),
  scheduledAt: z.string().datetime().optional().nullable(),
});

export type NewsletterFormData = z.infer<typeof newsletterSchema>;

// Segment filter criteria schema
export const filterCriteriaSchema = z.object({
  kosherAlerts: z.boolean().optional(),
  eruvStatus: z.boolean().optional(),
  simchas: z.boolean().optional(),
  shiva: z.boolean().optional(),
  newsletter: z.boolean().optional(),
  tehillim: z.boolean().optional(),
  communityEvents: z.boolean().optional(),
});

// Segment schema
export const segmentSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  description: z.string().max(500, "Description is too long").optional().nullable(),
  filterCriteria: filterCriteriaSchema.optional().nullable(),
  isDefault: z.boolean().default(false),
});

export type SegmentFormData = z.infer<typeof segmentSchema>;

// Subscriber schema for manual add
export const subscriberSchema = z.object({
  email: z.string().email("Invalid email address").max(255),
  firstName: z.string().max(50).optional().nullable(),
  lastName: z.string().max(50).optional().nullable(),
  kosherAlerts: z.boolean().default(false),
  eruvStatus: z.boolean().default(false),
  simchas: z.boolean().default(false),
  shiva: z.boolean().default(false),
  newsletter: z.boolean().default(true),
  tehillim: z.boolean().default(false),
  communityEvents: z.boolean().default(false),
});

export type SubscriberFormData = z.infer<typeof subscriberSchema>;

// CSV import row schema
export const subscriberImportRowSchema = z.object({
  email: z.string().email(),
  firstName: z.string().max(50).optional(),
  lastName: z.string().max(50).optional(),
});

// Send newsletter schema
export const sendNewsletterSchema = z.object({
  newsletterId: z.number().int().positive(),
  segmentId: z.number().int().positive().optional().nullable(),
  scheduleAt: z.string().datetime().optional().nullable(), // If provided, schedule for later
});

export type SendNewsletterData = z.infer<typeof sendNewsletterSchema>;

// Segment filter options for UI
export const SEGMENT_FILTER_OPTIONS = [
  { key: "newsletter", label: "Newsletter", description: "Subscribed to general newsletters" },
  { key: "kosherAlerts", label: "Kosher Alerts", description: "Subscribed to kosher alerts" },
  { key: "eruvStatus", label: "Eruv Status", description: "Subscribed to eruv status updates" },
  { key: "simchas", label: "Simchas", description: "Subscribed to simcha announcements" },
  { key: "shiva", label: "Shiva", description: "Subscribed to shiva notifications" },
  { key: "tehillim", label: "Tehillim", description: "Subscribed to tehillim updates" },
  { key: "communityEvents", label: "Community Events", description: "Subscribed to community event notifications" },
] as const;
