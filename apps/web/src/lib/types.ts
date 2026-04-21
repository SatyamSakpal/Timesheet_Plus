export interface ApiEnvelope<T> {
  data: T;
}

export interface ApiErrorBody {
  error?: {
    message?: string;
    statusCode?: number;
    details?: unknown;
  };
}

export interface AuthUserSnapshot {
  id: string;
  email: string;
  name: string;
}

export interface TenantMembership {
  id: string;
  tenantId: string;
  tenantName: string | null;
  userId: string;
  status: "active" | "invited" | "suspended";
  isOwner: boolean;
  roleIds: string[];
  homeDepartmentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CurrentUserProfile {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface MeResponse {
  user: CurrentUserProfile;
  memberships: TenantMembership[];
  pendingInvites: PendingInvite[];
}

export interface PermissionCatalogItem {
  id: string;
  key: string;
  name: string;
  description: string;
  module: string;
  configurable: boolean;
}

export interface FieldCatalogItem {
  id: string;
  key: "text" | "number" | "date" | "select" | "checkbox" | "textarea";
  name: string;
  description: string;
  supportsOptions: boolean;
  supportsNumericRange: boolean;
  configurable: boolean;
  order: number;
}

export interface TenantRole {
  id: string;
  tenantId: string;
  key?: string;
  name: string;
  isSystem?: boolean;
  permissionKeys: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentEntity {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskFieldSchema {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "checkbox" | "textarea";
  required: boolean;
  options?: string[];
  min?: number;
  max?: number;
}

export interface TaskTemplate {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  version: number;
  fields: TaskFieldSchema[];
  createdBy: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ActivityStatus = "draft" | "submitted" | "approved" | "rejected" | "resubmitted";

export interface ActivityEntry {
  id: string;
  tenantId: string;
  userId: string;
  homeDepartmentId: string | null;
  workDepartmentId: string;
  taskTemplateId: string;
  taskTemplateName: string;
  taskTemplateVersion: number;
  taskSchemaSnapshot: TaskFieldSchema[];
  payload: Record<string, unknown>;
  status: ActivityStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InviteResult {
  invite: {
    id: string;
    tenantId: string;
    userId: string | null;
    email: string;
    name: string;
    homeDepartmentId: string | null;
    roleIds: string[];
    invitedBy: string;
    status: "pending" | "accepted" | "revoked";
    acceptedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

export interface TenantInviteListItem {
  id: string;
  tenantId: string;
  userId: string | null;
  email: string;
  name: string;
  homeDepartmentId: string | null;
  roleIds: string[];
  roleNames: string[];
  invitedBy: string;
  invitedByName: string | null;
  status: "pending" | "accepted" | "revoked";
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PendingInvite {
  id: string;
  tenantId: string;
  tenantName: string;
  email: string;
  name: string;
  roleIds: string[];
  roleNames: string[];
  homeDepartmentId: string | null;
  invitedBy: string;
  invitedByName: string | null;
  status: "pending";
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentPersonCompact {
  id: string;
  email: string;
  name: string;
}

export interface DepartmentContributorCompact extends DepartmentPersonCompact {
  entryCount: number;
  latestEntryAt: string | null;
}

export interface TenantMemberListItem {
  id: string;
  tenantId: string;
  userId: string;
  email: string;
  name: string;
  status: "active" | "invited" | "suspended";
  roleIds: string[];
  roleNames: string[];
  homeDepartmentId: string | null;
  isOwner: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TenantUsersDirectoryItem {
  userId: string;
  name: string;
  email: string;
  status: "active" | "invited" | "suspended";
  roleIds: string[];
  roleNames: string[];
  homeDepartmentId: string | null;
  isOwner: boolean;
  departmentIds: string[];
  visibility: "tenant" | "member" | "contributor" | "member+contributor";
}

export interface TenantUsersDirectoryResponse {
  scope: "owner" | "hod";
  managedDepartmentIds: string[];
  users: TenantUsersDirectoryItem[];
}
