# Firestore Collections Reference

This file documents project-owned Firestore collections used by `apps/api`.

## `users`
- Purpose: global user profile store.
- Document ID: `userId`.
- Fields: `email`, `name`, `createdAt`, `updatedAt`.

## `permission_catalog`
- Purpose: tenant-role permission definitions.
- Document ID: permission key (example `activity.create`).
- Fields: `key`, `name`, `description`, `module`, `configurable`, timestamps.

## `field_catalog`
- Purpose: master task-field type definitions for form builders.
- Document ID: field key.
- Supported keys:
  - `text`
  - `textarea`
  - `number`
  - `date`
  - `select`
  - `radio`
  - `checkbox`
- Fields: `supportsOptions`, `supportsNumericRange`, `order`, timestamps.

## `tenants`
- Purpose: tenant boundary and ownership.
- Document ID: UUID.
- Fields: `name`, `ownerIds`, `deletedAt`, `deletedBy`, timestamps.

## `tenant_memberships`
- Purpose: user membership context per tenant.
- Document ID: `${tenantId}:${userId}`.
- Fields: `tenantId`, `userId`, `status`, `roleIds`, `homeDepartmentId`, timestamps.

## `tenant_roles`
- Purpose: tenant role definitions.
- Document ID: UUID.
- Fields: `tenantId`, `name`, optional `key`, optional `isSystem`, `permissionKeys`, timestamps.

## `tenant_invites`
- Purpose: invite records before membership activation.
- Document ID: UUID.
- Fields:
  - identity: `userId`, `email`, `name`
  - assignment intent: `homeDepartmentId`, `roleIds`
  - lifecycle: `status` (`pending | accepted | revoked`), `acceptedAt`
  - audit: `invitedBy`, timestamps

## `departments`
- Purpose: tenant department records.
- Document ID: UUID.
- Fields: `tenantId`, `name`, optional `description`, `createdBy`, timestamps.

## `department_memberships`
- Purpose: explicit user-to-department mapping.
- Document ID: `${tenantId}:${departmentId}:${userId}`.
- Fields: `tenantId`, `departmentId`, `userId`, timestamps.

## `department_hods`
- Purpose: department head assignments.
- Document ID: `${tenantId}:${departmentId}:${userId}`.
- Fields: `tenantId`, `departmentId`, `userId`, `assignedBy`, timestamps.

## `task_templates`
- Purpose: reusable task definitions with dynamic fields.
- Document ID: UUID.
- Fields: `tenantId`, `name`, optional `description`, `version`, `fields`, `createdBy`, `isActive`, timestamps.

## `department_tasks`
- Purpose: department-to-task assignment mapping.
- Document ID: UUID.
- Fields: `tenantId`, `departmentId`, `taskTemplateId`, `assignedBy`, timestamps.

## `activity_entries`
- Purpose: user activity logs.
- Document ID: UUID.
- Fields:
  - actor and scope: `tenantId`, `userId`, `homeDepartmentId`, `workDepartmentId`
  - task snapshot: `taskTemplateId`, `taskTemplateName`, `taskTemplateVersion`, `taskSchemaSnapshot`
  - timing: `activityDate`, `startTime`, `endTime`
  - content: `payload`
  - lifecycle: `status`, `submittedAt`, `reviewedAt`, `reviewedBy`, `rejectionReason`
  - timestamps

## `activity_approvals`
- Purpose: immutable review action history.
- Document ID: UUID.
- Fields: `tenantId`, `activityId`, `action` (`approve | reject`), `actionBy`, `reason`, timestamps.

## `audit_logs`
- Purpose: tenant-level audit trail.
- Document ID: UUID.
- Fields: `tenantId`, `actorUserId`, `action`, `resourceType`, `resourceId`, `metadata`, timestamps.

## Notes
- Tenant-scoped queries should include `tenantId` filter.
- Membership/HOD deterministic IDs enforce uniqueness naturally.
- Soft-deleted tenants remain auditable (`deletedAt`, `deletedBy`).
