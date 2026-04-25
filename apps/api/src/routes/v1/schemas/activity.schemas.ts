import { z } from "zod";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export const createActivitySchema = z.object({
  workDepartmentId: z.string().min(1),
  taskTemplateId: z.string().min(1),
  activityDate: z.string().regex(datePattern, "activityDate must be YYYY-MM-DD"),
  startTime: z.string().regex(timePattern, "startTime must be HH:mm"),
  endTime: z.string().regex(timePattern, "endTime must be HH:mm"),
  payload: z.record(z.string(), z.unknown()),
  status: z.enum(["draft", "submitted"]).optional().default("submitted")
}).refine((input) => input.endTime > input.startTime, {
  path: ["endTime"],
  message: "endTime must be later than startTime"
});

export const rejectActivitySchema = z.object({
  reason: z.string().min(3).max(500)
});

export const resubmitActivitySchema = z.object({
  payload: z.record(z.string(), z.unknown()).optional()
});
