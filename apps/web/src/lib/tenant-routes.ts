export const tenantRoutes = {
  root: (tenantId: string) => `/app/tenants/${tenantId}`,
  ownerDashboard: (tenantId: string) => `/app/tenants/${tenantId}/owner`,
  users: (tenantId: string) => `/app/tenants/${tenantId}/users`,
  userDetail: (tenantId: string, userId: string) => `/app/tenants/${tenantId}/users/${userId}`,
  activities: (tenantId: string) => `/app/tenants/${tenantId}/activities`,
  activitiesNew: (tenantId: string) => `/app/tenants/${tenantId}/activities/new`,
  activitiesDetail: (tenantId: string, taskTemplateId: string) =>
    `/app/tenants/${tenantId}/activities/${taskTemplateId}`,
  activityNew: (tenantId: string) => `/app/tenants/${tenantId}/activity/new`,
  activityMine: (tenantId: string) => `/app/tenants/${tenantId}/activity/my`,
  hodReview: (tenantId: string) => `/app/tenants/${tenantId}/hod/review`,
  hodDepartmentMembers: (tenantId: string, departmentId: string) =>
    `/app/tenants/${tenantId}/hod/departments/${departmentId}/members`,
  adminRoot: (tenantId: string) => `/app/tenants/${tenantId}/admin`,
  adminRoles: (tenantId: string) => `/app/tenants/${tenantId}/admin/roles`,
  adminDepartments: (tenantId: string) => `/app/tenants/${tenantId}/admin/departments`,
  adminDepartment: (tenantId: string, departmentId: string) =>
    `/app/tenants/${tenantId}/admin/departments/${departmentId}`,
  adminInvites: (tenantId: string) => `/app/tenants/${tenantId}/admin/invites`,
  adminTasks: (tenantId: string) => `/app/tenants/${tenantId}/admin/tasks`
} as const;
