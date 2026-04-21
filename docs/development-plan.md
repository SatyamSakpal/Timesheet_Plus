# TimesheetPlus Development Tracking

## Backend Status (Current)
- [x] B1 Foundation
- [x] B2 Tenant + Department Management
- [x] B3 Task Template System (Dynamic Forms)
- [x] B4 Activity Submission Flow
- [x] B5 Department Approval Flow
- [x] B6 Department-Centric Visibility APIs
- [x] B7 Security + RBAC
- [ ] B8 Stabilization (OpenAPI docs, deployment pipeline hardening, broader test coverage, index guidance)

## Implemented Backend Capabilities
- Express + TypeScript API scaffolded under `apps/api`.
- Firebase Admin initialization with `DATA_PROVIDER` support (`memory` or `firestore`).
- Auth middleware supports Firebase token verification and mock auth for local/emulator tests.
- Multi-tenant hierarchy implemented:
  - `Tenant -> Departments -> Task Templates -> Department Task Assignments -> Activity Entries`
- User membership model:
  - one `homeDepartmentId` in tenant membership
  - optional explicit `department_memberships`
  - users can submit entries in departments other than home department
- HOD model:
  - `department_hods` mapping supports one HOD across multiple departments
  - HOD approval restricted to activity entries for headed departments
- Dynamic task forms:
  - field schema types: `text`, `number`, `date`, `select`, `checkbox`, `textarea`
  - payload validation on submit/resubmit
- Department visibility rules:
  - members endpoint returns users assigned to/home in department
  - contributors endpoint returns users who worked in department but are not members
- RBAC:
  - tenant roles with permission keys
  - system default roles auto-seeded on tenant creation (`Owner`, `Head of Department`, `Staff`)
  - master permission catalog collection (`permission_catalog`) for configurable permission definitions
  - member role assignment
  - invite-time role assignment
  - invite-first flow (membership created only on accept)
  - route-level permission checks plus department-specific HOD checks
- Form builder metadata:
  - master field catalog collection (`field_catalog`) for supported task field types
- Audit logs:
  - written for tenant/department/role/task/activity lifecycle actions
- Tenant lifecycle:
  - owner-only soft-delete endpoint (`DELETE /v1/tenants/:tenantId`)
  - deleted tenants are excluded from `/v1/me` memberships
  - `/v1/me` includes `pendingInvites` for logged-in email

## Frontend Status (Detailed Plan Ready)
- [x] F1 Foundation (Next.js app scaffold, auth bootstrap, API/query client)
- [x] F2 Tenant Context + Navigation (membership-aware shell)
- [x] F3 Staff Activity Logging (dynamic forms, draft/submit/resubmit)
- [x] F4 HOD Review Experience (pending queue, approve/reject, contributor visibility)
- [x] F5 Tenant Admin Experience (roles, invites, departments, task templates)
- [ ] F6 Quality and Release Readiness (tests, accessibility, deployment docs)

## Current API Surface
- `GET /v1/me`
- `POST /v1/tenants`
- `DELETE /v1/tenants/:tenantId`
- `GET /v1/catalog/permissions`
- `GET /v1/catalog/fields`
- `POST /v1/tenants/:tenantId/roles`
- `GET /v1/tenants/:tenantId/roles`
- `POST /v1/tenants/:tenantId/invites`
- `GET /v1/tenants/:tenantId/invites`
- `POST /v1/tenants/:tenantId/invites/:inviteId/accept`
- `POST /v1/tenants/:tenantId/members`
- `GET /v1/tenants/:tenantId/members`
- `POST /v1/tenants/:tenantId/members/:memberUserId/roles`
- `GET /v1/tenants/:tenantId/users`
- `POST /v1/tenants/:tenantId/departments`
- `GET /v1/tenants/:tenantId/departments`
- `POST /v1/tenants/:tenantId/departments/:departmentId/members`
- `POST /v1/tenants/:tenantId/departments/:departmentId/hods`
- `POST /v1/tenants/:tenantId/task-templates`
- `POST /v1/tenants/:tenantId/departments/:departmentId/tasks/:taskTemplateId`
- `GET /v1/tenants/:tenantId/departments/:departmentId/tasks`
- `POST /v1/tenants/:tenantId/activities`
- `GET /v1/tenants/:tenantId/departments/:departmentId/activities`
- `POST /v1/tenants/:tenantId/activities/:activityId/approve`
- `POST /v1/tenants/:tenantId/activities/:activityId/reject`
- `POST /v1/tenants/:tenantId/activities/:activityId/resubmit`
- `GET /v1/tenants/:tenantId/departments/:departmentId/members`
- `GET /v1/tenants/:tenantId/departments/:departmentId/contributors`

## Next Backend Tasks
1. Add OpenAPI generation for all v1 endpoints and publish route docs.
2. Add deployment manifests and CI pipeline for Railway/Render.
3. Expand automated tests for rejection/resubmission lifecycle and tenant-isolation edge cases.
4. Add Firestore index documentation for production query patterns.

## Frontend Plan Reference
- Detailed implementation blueprint:
  - `docs/frontend-implementation-plan.md`
- Project state and scope summary:
  - `docs/project-overview-status.md`
