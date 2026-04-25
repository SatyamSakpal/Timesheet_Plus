export const queryKeys = {
  me: ["me"] as const,
  roles: (tenantId: string) => ["roles", tenantId] as const,
  tenantMembers: (tenantId: string) => ["tenant-members", tenantId] as const,
  tenantUsersDirectory: (tenantId: string) => ["tenant-users-directory", tenantId] as const,
  tenantUserDetail: (tenantId: string, userId: string) =>
    ["tenant-user-detail", tenantId, userId] as const,
  tenantDepartments: (tenantId: string) => ["tenant-departments", tenantId] as const,
  tenantTaskTemplates: (tenantId: string) => ["tenant-task-templates", tenantId] as const,
  tenantInvites: (tenantId: string) => ["tenant-invites", tenantId] as const,
  permissionsCatalog: ["catalog", "permissions"] as const,
  fieldsCatalog: ["catalog", "fields"] as const,
  departmentTasks: (tenantId: string, departmentId: string) =>
    ["department-tasks", tenantId, departmentId] as const,
  departmentActivities: (tenantId: string, departmentId: string, filters: string) =>
    ["department-activities", tenantId, departmentId, filters] as const,
  myActivities: (tenantId: string) => ["my-activities", tenantId] as const,
  departmentMembers: (tenantId: string, departmentId: string) =>
    ["department-members", tenantId, departmentId] as const,
  departmentHods: (tenantId: string, departmentId: string) =>
    ["department-hods", tenantId, departmentId] as const,
  departmentContributors: (tenantId: string, departmentId: string) =>
    ["department-contributors", tenantId, departmentId] as const
};
