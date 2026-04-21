import { z } from "zod";

export const createDepartmentSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional()
});

export const assignDepartmentMemberSchema = z.object({
  userId: z.string().min(1)
});

export const assignHodSchema = z.object({
  userId: z.string().min(1)
});

