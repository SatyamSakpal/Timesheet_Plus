import { z } from "zod";

const fieldTypeSchema = z.enum(["text", "number", "date", "select", "radio", "checkbox", "textarea"]);

export const taskFieldSchema = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
    type: fieldTypeSchema,
    required: z.boolean(),
    options: z.array(z.string()).optional(),
    min: z.number().optional(),
    max: z.number().optional()
  })
  .superRefine((field, ctx) => {
    if ((field.type === "select" || field.type === "radio") && (!field.options || field.options.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${field.type} field must include options`,
        path: ["options"]
      });
    }
  });

export const createTaskTemplateSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  fields: z.array(taskFieldSchema).min(1)
});

export const updateTaskTemplateSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  fields: z.array(taskFieldSchema).min(1),
  isActive: z.boolean().optional()
});
