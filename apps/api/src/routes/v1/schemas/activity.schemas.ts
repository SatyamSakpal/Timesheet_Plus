import { z } from "zod";

export const createActivitySchema = z.object({
  workDepartmentId: z.string().min(1),
  taskTemplateId: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  status: z.enum(["draft", "submitted"]).optional().default("submitted")
});

export const rejectActivitySchema = z.object({
  reason: z.string().min(3).max(500)
});

export const resubmitActivitySchema = z.object({
  payload: z.record(z.string(), z.unknown()).optional()
});

