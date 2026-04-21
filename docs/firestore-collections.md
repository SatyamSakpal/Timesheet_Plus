# Firestore Collections Reference

This file documents all Firestore collections used by TimesheetPlus backend (`apps/api`).

## `users`
- Purpose: Global user profile store shared across tenants.
- Document ID: `userId` (Firebase Auth UID when available).
- Key fields:
  - `email`: User email.
  - `name`: Display name.
  - `createdAt`, `updatedAt`: Audit timestamps.

## `permission_catalog`
- Purpose: Master permission definitions that can be assigned to tenant roles.
- Document ID: permission key (for example `activity.create`).
- Key fields:
  - `key`: Permission key used by RBAC checks.
  - `name`: Human-readable name for admin UI.
  - `description`: Permission purpose.
  - `module`: Functional area (`tenant`, `member`, `task`, `activity`, etc.).
  - `configurable`: Whether this permission can be configured in custom roles.
  - `createdAt`, `updatedAt`.

## `field_catalog`
- Purpose: Master field-type definitions used by task form builders.
- Document ID: field key (`text`, `number`, `date`, `select`, `checkbox`, `textarea`).
- Key fields:
  - `key`: Field type key.
  - `name`: Display name.
  - `description`: Field behavior summary.
  - `supportsOptions`: Whether options array is supported (example: `select`).
  - `supportsNumericRange`: Whether min/max config is supported.
  - `configurable`: Whether type is available for task form schema builder.
  - `order`: Sort order for UI.
  - `createdAt`, `updatedAt`.

## `tenants`
- Purpose: Top-level organization record (multi-tenant boundary).
- Document ID: generated UUID.
- Key fields:
  - `name`: Organization name.
  - `ownerIds`: Array of user IDs treated as tenant owners.
  - `deletedAt`: Soft-delete timestamp (`null` when active).
  - `deletedBy`: User ID of actor who deleted tenant (`null` when active).
  - `createdAt`, `updatedAt`.

## `tenant_memberships`
- Purpose: Maps users to tenants and stores tenant-level access context.
- Document ID: `${tenantId}:${userId}`.
- Key fields:
  - `tenantId`, `userId`.
  - `status`: `active | suspended` (legacy data may contain `invited` from older flow versions).
  - `roleIds`: Tenant role IDs assigned to this member.
  - `homeDepartmentId`: Parent/home department for the user in this tenant.
  - `createdAt`, `updatedAt`.

## `tenant_roles`
- Purpose: Tenant-defined RBAC roles.
- Document ID: generated UUID.
- Key fields:
  - `tenantId`.
  - `name`: Role name (for example `Owner`, `Head of Department`, `Staff`).
  - `key`: Optional system key for seeded roles.
  - `isSystem`: Whether this is a default seeded role.
  - `permissionKeys`: Allowed actions for this role.
  - `createdAt`, `updatedAt`.

## `tenant_invites`
- Purpose: Invite workflow records before membership is created/activated.
- Document ID: generated UUID.
- Key fields:
  - `tenantId`.
  - `userId`, `email`, `name`: Invited identity (`userId` can be `null` until accepted).
  - `homeDepartmentId`: Home department to assign on acceptance.
  - `roleIds`: Roles to apply when invite is accepted.
  - `invitedBy`: Actor user ID.
  - `status`: `pending | accepted | revoked`.
  - `acceptedAt`: Timestamp when invite was accepted.
  - `createdAt`, `updatedAt`.

## `departments`
- Purpose: Departments inside a tenant.
- Document ID: generated UUID.
- Key fields:
  - `tenantId`.
  - `name`, `description`.
  - `createdBy`: User who created the department.
  - `createdAt`, `updatedAt`.

## `department_memberships`
- Purpose: Optional explicit user-to-department assignments (beyond home department).
- Document ID: `${tenantId}:${departmentId}:${userId}`.
- Key fields:
  - `tenantId`, `departmentId`, `userId`.
  - `createdAt`, `updatedAt`.

## `department_hods`
- Purpose: Maps department heads/admins to departments they govern.
- Document ID: `${tenantId}:${departmentId}:${userId}`.
- Key fields:
  - `tenantId`, `departmentId`, `userId`.
  - `assignedBy`: Actor user ID.
  - `createdAt`, `updatedAt`.

## `task_templates`
- Purpose: Reusable tenant task definitions with dynamic form schema.
- Document ID: generated UUID.
- Key fields:
  - `tenantId`.
  - `name`, `description`.
  - `version`: Template version.
  - `fields`: Dynamic form schema array (text/number/date/select/checkbox/textarea).
  - `createdBy`.
  - `isActive`.
  - `createdAt`, `updatedAt`.

## `department_tasks`
- Purpose: Assignment mapping between departments and task templates.
- Document ID: generated UUID.
- Key fields:
  - `tenantId`, `departmentId`, `taskTemplateId`.
  - `assignedBy`.
  - `createdAt`, `updatedAt`.

## `activity_entries`
- Purpose: User-submitted work/activity logs.
- Document ID: generated UUID.
- Key fields:
  - `tenantId`, `userId`.
  - `homeDepartmentId`: User's parent department at time of entry.
  - `workDepartmentId`: Department where work was logged.
  - `taskTemplateId`, `taskTemplateName`, `taskTemplateVersion`.
  - `taskSchemaSnapshot`: Stored schema snapshot for audit consistency.
  - `payload`: Submitted form data.
  - `status`: `draft | submitted | approved | rejected | resubmitted`.
  - `submittedAt`, `reviewedAt`, `reviewedBy`, `rejectionReason`.
  - `createdAt`, `updatedAt`.

## `activity_approvals`
- Purpose: Immutable approval/rejection action trail for activity entries.
- Document ID: generated UUID.
- Key fields:
  - `tenantId`, `activityId`.
  - `action`: `approve | reject`.
  - `actionBy`: Actor user ID.
  - `reason`: Rejection reason when applicable.
  - `createdAt`, `updatedAt`.

## `audit_logs`
- Purpose: Tenant-level audit history for sensitive operations.
- Document ID: generated UUID.
- Key fields:
  - `tenantId`.
  - `actorUserId`.
  - `action`: Event key (for example `role.create`, `activity.approve`).
  - `resourceType`, `resourceId`.
  - `metadata`: JSON metadata for traceability.
  - `createdAt`, `updatedAt`.

## Notes
- All tenant-scoped queries should always include `tenantId` filter.
- Tenant deletion is soft-delete based (`deletedAt`/`deletedBy`) so documents remain auditable.
- ID patterns for membership/HOD docs are intentional to enforce uniqueness.
- Consider adding explicit Firestore indexes for frequent filtered queries:
  - `activity_entries` by `tenantId + workDepartmentId + status`
  - `department_tasks` by `tenantId + departmentId`
  - `tenant_roles` by `tenantId`
