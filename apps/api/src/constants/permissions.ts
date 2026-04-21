export const PERMISSIONS = {
  tenantManage: "tenant.manage",
  departmentManage: "department.manage",
  memberManage: "member.manage",
  roleManage: "role.manage",
  taskTemplateManage: "task_template.manage",
  taskAssign: "task.assign",
  activityCreate: "activity.create",
  activityApprove: "activity.approve",
  reportView: "report.view"
} as const;

export const ALL_PERMISSION_KEYS = Object.values(PERMISSIONS);

