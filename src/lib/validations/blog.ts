import { z } from "zod";

export const blogPostSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  content: z.string().min(1, "Content is required"),
  contentJson: z.any().optional().nullable(),
  coverImageUrl: z.string().max(500).optional().nullable().or(z.literal("")),
  excerpt: z.string().max(500).optional().nullable().or(z.literal("")),
  categoryId: z.number().optional().nullable(),
  customCategory: z.string().max(100).optional().nullable().or(z.literal("")),
  commentModeration: z.enum(["open", "approved"]).optional().nullable(),
});

export type BlogPostFormData = z.infer<typeof blogPostSchema>;

export const blogCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(2000),
  parentId: z.number().optional().nullable(),
});

export type BlogCommentFormData = z.infer<typeof blogCommentSchema>;

export const blogCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  displayOrder: z.number().optional(),
});

export type BlogCategoryFormData = z.infer<typeof blogCategorySchema>;
