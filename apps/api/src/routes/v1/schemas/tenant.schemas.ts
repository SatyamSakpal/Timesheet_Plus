import { z } from "zod";

const optionalDepartmentIdSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional().nullable()
);

export const createTenantSchema = z.object({
  name: z.string().min(2).max(120)
});

export const addMemberSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  homeDepartmentId: z.string().min(1),
  roleId: z.string().min(1).optional(),
  roleIds: z.array(z.string().min(1)).optional().default([])
}).superRefine((input, ctx) => {
  if (input.roleId && input.roleIds.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["roleIds"],
      message: "Provide either roleId or roleIds, not both"
    });
  }
});

export const inviteMemberSchema = z.object({
  userId: z.string().min(1).optional(),
  email: z.string().email(),
  name: z.string().min(1).optional(),
  homeDepartmentId: optionalDepartmentIdSchema,
  roleId: z.string().min(1).optional(),
  roleIds: z.array(z.string().min(1)).optional().default([])
}).superRefine((input, ctx) => {
  if (input.roleId && input.roleIds.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["roleIds"],
      message: "Provide either roleId or roleIds, not both"
    });
  }
});

export const createRoleSchema = z.object({
  name: z.string().min(2).max(120),
  permissionKeys: z.array(z.string().min(1)).min(1)
});

export const assignRoleSchema = z.object({
  roleIds: z.array(z.string().min(1)).min(1)
});
