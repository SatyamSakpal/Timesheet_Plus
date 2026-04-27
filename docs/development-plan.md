# TimesheetPlus Development Tracking

Snapshot date: 2026-04-27

## Backend Milestones
- [x] B1 Foundation
- [x] B2 Tenant and Department Management
- [x] B3 Activity Template System (Dynamic Forms)
- [x] B4 Activity Submission Flow
- [x] B5 Department Review and Approval Flow
- [x] B6 Department-Centric Visibility APIs
- [x] B7 Security and RBAC
- [ ] B8 Stabilization (OpenAPI docs, deployment hardening, broader edge-case coverage)

## Frontend Milestones
- [x] F1 Foundation (Next.js app, auth bootstrap, typed API client)
- [x] F2 Tenant Context and Navigation
- [x] F3 Staff Activity Logging
- [x] F4 HOD Review Experience
- [x] F5 Tenant Admin Experience
- [ ] F6 Quality and Release Readiness (E2E, accessibility, release runbooks)

## Implemented Highlights
- Invite-first onboarding with dashboard accept/reject actions.
- Tenant member removal with permission checks and safety guards.
- Preset tenant bootstrap for education domain departments and activities.
- Default `Other` activity support across departments.
- Activity-template name uniqueness per tenant.
- Department/activity delete guards with detailed blocking entities in API error details.
- Searchable dropdowns for key selection inputs.
- Consistent modal overlay + scroll behavior fixes across the web app.
- HOD review:
  - aggregate all-departments filtering
  - contributor-only people panel in all-departments mode
  - row selection mode and bulk approve/reject.

## Current API Surface

### Session and catalogs
- `GET /v1/me`
- `GET /v1/catalog/permissions`
- `GET /v1/catalog/fields`

### Tenants, invites, roles, members, users
- `POST /v1/tenants`
- `DELETE /v1/tenants/:tenantId`
- `POST /v1/tenants/:tenantId/invites`
- `GET /v1/tenants/:tenantId/invites`
- `POST /v1/tenants/:tenantId/invites/:inviteId/accept`
- `POST /v1/tenants/:tenantId/invites/:inviteId/reject`
- `POST /v1/tenants/:tenantId/roles`
- `GET /v1/tenants/:tenantId/roles`
- `DELETE /v1/tenants/:tenantId/roles/:roleId`
- `GET /v1/tenants/:tenantId/members`
- `POST /v1/tenants/:tenantId/members`
- `DELETE /v1/tenants/:tenantId/members/:memberUserId`
- `POST /v1/tenants/:tenantId/members/:memberUserId/roles`
- `GET /v1/tenants/:tenantId/users`
- `GET /v1/tenants/:tenantId/users/:userId`
- `PATCH /v1/tenants/:tenantId/users/:userId/home-department`

### Departments
- `POST /v1/tenants/:tenantId/departments`
- `GET /v1/tenants/:tenantId/departments`
- `DELETE /v1/tenants/:tenantId/departments/:departmentId`
- `POST /v1/tenants/:tenantId/departments/:departmentId/members`
- `POST /v1/tenants/:tenantId/departments/:departmentId/hods`
- `GET /v1/tenants/:tenantId/departments/:departmentId/members`
- `GET /v1/tenants/:tenantId/departments/:departmentId/hods`
- `GET /v1/tenants/:tenantId/departments/:departmentId/contributors`

### Activity Templates
- `POST /v1/tenants/:tenantId/task-templates`
- `GET /v1/tenants/:tenantId/task-templates`
- `PATCH /v1/tenants/:tenantId/task-templates/:taskTemplateId`
- `DELETE /v1/tenants/:tenantId/task-templates/:taskTemplateId`
- `POST /v1/tenants/:tenantId/departments/:departmentId/tasks/:taskTemplateId`
- `DELETE /v1/tenants/:tenantId/departments/:departmentId/tasks/:taskTemplateId`
- `GET /v1/tenants/:tenantId/departments/:departmentId/tasks`

### Activities
- `POST /v1/tenants/:tenantId/activities`
- `GET /v1/tenants/:tenantId/activities/my`
- `GET /v1/tenants/:tenantId/departments/:departmentId/activities`
- `POST /v1/tenants/:tenantId/activities/:activityId/approve`
- `POST /v1/tenants/:tenantId/activities/:activityId/reject`
- `POST /v1/tenants/:tenantId/activities/:activityId/resubmit`
- `DELETE /v1/tenants/:tenantId/activities/:activityId`

## Active Backlog
1. Generate and publish OpenAPI docs for v1.
2. Add production deployment and operations runbooks.
3. Expand tenant isolation and authorization edge-case tests.
4. Add richer frontend E2E and accessibility checks.
