export const COLLECTIONS = {
  users: "users",
  tenants: "tenants",
  permissionCatalog: "permission_catalog",
  fieldCatalog: "field_catalog",
  presetDepartmentsCatalog: "preset_departments_catalog",
  presetTaskTemplatesCatalog: "preset_task_templates_catalog",
  tenantMemberships: "tenant_memberships",
  tenantRoles: "tenant_roles",
  tenantInvites: "tenant_invites",
  departments: "departments",
  departmentMemberships: "department_memberships",
  departmentHods: "department_hods",
  taskTemplates: "task_templates",
  departmentTasks: "department_tasks",
  activityEntries: "activity_entries",
  activityApprovals: "activity_approvals",
  auditLogs: "audit_logs"
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

export type ActivityStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "resubmitted";

export type MembershipStatus = "active" | "invited" | "suspended";

export type FieldType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "radio"
  | "checkbox"
  | "textarea";

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserEntity extends BaseEntity {
  email: string;
  name: string;
}

export interface PermissionCatalogEntity extends BaseEntity {
  key: string;
  name: string;
  description: string;
  module: string;
  configurable: boolean;
}

export interface FieldCatalogEntity extends BaseEntity {
  key: FieldType;
  name: string;
  description: string;
  supportsOptions: boolean;
  supportsNumericRange: boolean;
  configurable: boolean;
  order: number;
}

export interface PresetDepartmentCatalogEntity extends BaseEntity {
  key: string;
  name: string;
  description?: string;
  order: number;
  isActive: boolean;
}

export interface PresetTaskTemplateCatalogEntity extends BaseEntity {
  key: string;
  name: string;
  description?: string;
  order: number;
  isActive: boolean;
  assignedDepartmentKeys: string[];
  fields: TaskFieldSchema[];
}

export interface TenantEntity extends BaseEntity {
  name: string;
  ownerIds: string[];
  deletedAt: string | null;
  deletedBy: string | null;
}

export interface TenantMembershipEntity extends BaseEntity {
  tenantId: string;
  userId: string;
  status: MembershipStatus;
  roleIds: string[];
  homeDepartmentId: string | null;
}

export interface TenantRoleEntity extends BaseEntity {
  tenantId: string;
  name: string;
  key?: string;
  isSystem?: boolean;
  permissionKeys: string[];
}

export type InviteStatus = "pending" | "accepted" | "revoked";

export interface TenantInviteEntity extends BaseEntity {
  tenantId: string;
  userId: string | null;
  email: string;
  name: string;
  homeDepartmentId: string | null;
  roleIds: string[];
  invitedBy: string;
  status: InviteStatus;
  acceptedAt: string | null;
}

export interface DepartmentEntity extends BaseEntity {
  tenantId: string;
  name: string;
  description?: string;
  createdBy: string;
}

export interface DepartmentMembershipEntity extends BaseEntity {
  tenantId: string;
  departmentId: string;
  userId: string;
}

export interface DepartmentHodEntity extends BaseEntity {
  tenantId: string;
  departmentId: string;
  userId: string;
  assignedBy: string;
}

export interface TaskFieldSchema {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  min?: number;
  max?: number;
}

export interface TaskTemplateEntity extends BaseEntity {
  tenantId: string;
  key?: string;
  name: string;
  description?: string;
  version: number;
  fields: TaskFieldSchema[];
  createdBy: string;
  isActive: boolean;
}

export interface DepartmentTaskEntity extends BaseEntity {
  tenantId: string;
  departmentId: string;
  taskTemplateId: string;
  assignedBy: string;
}

export interface ActivityEntryEntity extends BaseEntity {
  tenantId: string;
  userId: string;
  homeDepartmentId: string | null;
  workDepartmentId: string;
  taskTemplateId: string;
  taskTemplateName: string;
  taskTemplateVersion: number;
  activityDate: string;
  startTime: string;
  endTime: string;
  taskSchemaSnapshot: TaskFieldSchema[];
  payload: Record<string, unknown>;
  status: ActivityStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
}

export interface ActivityApprovalEntity extends BaseEntity {
  tenantId: string;
  activityId: string;
  action: "approve" | "reject";
  actionBy: string;
  reason: string | null;
}

export interface AuditLogEntity extends BaseEntity {
  tenantId: string;
  actorUserId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown>;
}

export interface AuthenticatedUser {
  uid: string;
  email: string;
  name: string;
}

export interface TenantContext {
  tenantId: string;
  membership: TenantMembershipEntity;
  isOwner: boolean;
  permissions: Set<string>;
}
