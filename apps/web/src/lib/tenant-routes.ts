export const tenantRoutes = {
  root: (tenantId: string) => `/app/tenants/${tenantId}`,
  ownerDashboard: (tenantId: string) => `/app/tenants/${tenantId}/owner`,
  users: (tenantId: string) => `/app/tenants/${tenantId}/users`,
  activityNew: (tenantId: string) => `/app/tenants/${tenantId}/activity/new`,
  activityMine: (tenantId: string) => `/app/tenants/${tenantId}/activity/my`,
  hodReview: (tenantId: string) => `/app/tenants/${tenantId}/hod/review`,
  hodDepartmentMembers: (tenantId: string, departmentId: string) =>
    `/app/tenants/${tenantId}/hod/departments/${departmentId}/members`,
  adminRoot: (tenantId: string) => `/app/tenants/${tenantId}/admin`,
  adminRoles: (tenantId: string) => `/app/tenants/${tenantId}/admin/roles`,
  adminDepartments: (tenantId: string) => `/app/tenants/${tenantId}/admin/departments`,
  adminInvites: (tenantId: string) => `/app/tenants/${tenantId}/admin/invites`,
  adminTasks: (tenantId: string) => `/app/tenants/${tenantId}/admin/tasks`
} as const;
