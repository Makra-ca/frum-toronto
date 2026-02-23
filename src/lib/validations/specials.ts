import { z } from "zod";

export const ALLOWED_FILE_TYPES = [
  { value: "pdf", label: "PDF", mimeTypes: ["application/pdf"] },
  { value: "png", label: "PNG Image", mimeTypes: ["image/png"] },
  { value: "jpg", label: "JPG Image", mimeTypes: ["image/jpeg", "image/jpg"] },
  { value: "jpeg", label: "JPEG Image", mimeTypes: ["image/jpeg"] },
];

// Base schema without refinement (for extending)
const baseSpecialSchema = z.object({
  businessId: z.number().int().positive("Business is required"),
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(1000).optional().nullable(),
  fileUrl: z.string().url("Valid file URL is required"),
  fileType: z.enum(["pdf", "png", "jpg", "jpeg"], {
    message: "File type is required",
  }),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});

// Date validation refinement
const dateRefinement = (data: { startDate: string; endDate: string }) => {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  return end >= start;
};

const dateRefinementMessage = {
  message: "End date must be after or equal to start date",
  path: ["endDate"],
};

// Public schema with refinement
export const specialSchema = baseSpecialSchema.refine(dateRefinement, dateRefinementMessage);

export type SpecialFormData = z.infer<typeof specialSchema>;

// Admin schema with additional fields
export const adminSpecialSchema = baseSpecialSchema.extend({
  approvalStatus: z.enum(["pending", "approved", "rejected"]).optional(),
  isActive: z.boolean().optional(),
}).refine(dateRefinement, dateRefinementMessage);

export type AdminSpecialFormData = z.infer<typeof adminSpecialSchema>;
