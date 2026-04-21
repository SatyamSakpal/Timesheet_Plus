# TimesheetPlus Frontend Implementation Plan (Next.js + TypeScript)

This document is the implementation blueprint for the frontend phase.
It is decision-complete enough to start coding in the next session.

## 1) Objective
- Build a Next.js TypeScript frontend for TimesheetPlus that supports:
  - Multi-tenant user context
  - Role-aware UI behavior
  - Department-driven activity logging with dynamic task forms
  - HOD review and approval workflows
  - Tenant admin management (roles, invites, departments, tasks)

## 2) Frontend Architecture

### Framework and runtime
- Next.js (App Router) + TypeScript.
- React Server Components for layout shells, Client Components for interactive modules/forms.
- Styling: Tailwind CSS + UI component primitives (project local components).

### Auth + session model
- Firebase client auth in frontend (Email/Google).
- On successful sign-in:
  - Get Firebase ID token.
  - Send token to backend in `Authorization: Bearer <token>`.
- Keep current `activeTenantId` in client state + persisted storage (localStorage).
- Backend remains source of truth for authorization (`tenantContext` + permissions).

### API integration model
- Frontend only uses backend REST APIs; no direct Firestore reads/writes for domain data.
- Create typed API client module:
  - `apiClient.get/post/patch/delete`
  - inject auth token; tenant context is path-based (`/tenants/:tenantId/...`)
  - central error normalization for UI

### State strategy
- React Query (TanStack Query) for server state and caching.
- Lightweight client store (Zustand or Context) for:
  - auth user snapshot
  - active tenant
  - UI layout state

## 3) Information Architecture (Pages + Capabilities)

### Public routes
- `/login`
  - Firebase login (email/password + Google)
  - redirect to tenant selection/dashboard

### Authenticated routes
- `/app`
  - tenant-aware shell + navigation
- `/app/tenants`
  - list user memberships
  - tenant switch
  - create tenant
- `/app/tenants/[tenantId]`
  - tenant entry landing
- `/app/tenants/[tenantId]/owner`
  - owner dashboard
- `/app/tenants/[tenantId]/users`
  - owner/HOD tenant user directory

### Staff workflows
- `/app/tenants/[tenantId]/activity/new`
  - Step 1: select department
  - Step 2: select task template
  - Step 3: render dynamic task fields from task schema
  - Step 4: save draft or submit
- `/app/tenants/[tenantId]/activity/my`
  - list own activity entries
  - status chips: draft/submitted/rejected/approved/resubmitted
  - resubmit rejected entries with corrections

### HOD workflows
- `/app/tenants/[tenantId]/hod/review`
  - pending entries for departments headed by current user
  - filters: department, user, task, date, status
  - approve/reject actions (reject requires reason)
- `/app/tenants/[tenantId]/hod/departments/[departmentId]/members`
  - basic member list
  - contributor list (worked but not assigned)

### Tenant admin workflows
- `/app/tenants/[tenantId]/admin/roles`
  - list roles
  - create/edit custom roles using permission catalog
- `/app/tenants/[tenantId]/admin/invites`
  - create invite
  - assign role and optional home department during invite
  - lifecycle table (`pending`, `accepted`, `revoked`)
- `/app/tenants/[tenantId]/admin/departments`
  - create departments
  - assign HODs and optional members
- `/app/tenants/[tenantId]/admin/tasks`
  - task template form builder using field catalog
  - assign templates to departments

## 4) UI Modules and Components

### Core shell
- `AppShell`: left navigation (`Dashboard`, `Created`, `Joined`) + top utility bar + route guards.
- `PermissionGate`: wrapper to conditionally render actions by permission.
- `TenantSwitcher`: optional enhancement for explicit membership dropdown and active tenant change.

### Auth
- `LoginForm`, `GoogleSignInButton`, `AuthGuard`.

### Activity form system
- `DepartmentSelect`
- `TaskTemplateSelect`
- `DynamicFieldRenderer`
  - maps field types (`text`, `textarea`, `number`, `date`, `select`, `checkbox`)
- `ActivitySubmitBar` (Save Draft / Submit)
- `ValidationSummary`

### HOD review
- `ReviewTable`
- `ActivityDetailDrawer`
- `ApproveRejectActions`

### Admin modules
- `RoleEditor` (permission checkboxes sourced from `/v1/catalog/permissions`)
- `InviteForm` (email + role + optional department, plus lifecycle table)
- `DepartmentManager`
- `TaskTemplateBuilder` (field catalog sourced from `/v1/catalog/fields`)
- `DepartmentTaskAssignment`

## 5) API Usage Mapping

### Tenant and session
- `GET /v1/me`
- `POST /v1/tenants`
- `DELETE /v1/tenants/:tenantId`

`GET /v1/me` response includes:
- active memberships
- `pendingInvites` (matched by authenticated email)

### Catalogs
- `GET /v1/catalog/permissions`
- `GET /v1/catalog/fields`

### Roles + invites
- `GET /v1/tenants/:tenantId/roles`
- `POST /v1/tenants/:tenantId/roles`
- `POST /v1/tenants/:tenantId/invites`
- `GET /v1/tenants/:tenantId/invites`
- `POST /v1/tenants/:tenantId/invites/:inviteId/accept`

### Departments
- `POST /v1/tenants/:tenantId/departments`
- `POST /v1/tenants/:tenantId/departments/:departmentId/hods`
- `POST /v1/tenants/:tenantId/departments/:departmentId/members`
- `GET /v1/tenants/:tenantId/departments/:departmentId/members`
- `GET /v1/tenants/:tenantId/departments/:departmentId/contributors`

### Tasks
- `POST /v1/tenants/:tenantId/task-templates`
- `POST /v1/tenants/:tenantId/departments/:departmentId/tasks/:taskTemplateId`
- `GET /v1/tenants/:tenantId/departments/:departmentId/tasks`

### Activities
- `POST /v1/tenants/:tenantId/activities`
- `GET /v1/tenants/:tenantId/departments/:departmentId/activities`
- `POST /v1/tenants/:tenantId/activities/:activityId/approve`
- `POST /v1/tenants/:tenantId/activities/:activityId/reject`
- `POST /v1/tenants/:tenantId/activities/:activityId/resubmit`

## 6) Delivery Phases (Frontend)

### F1: Foundation
- Create `apps/web` Next.js TypeScript app.
- Setup Tailwind, linting, absolute imports, env management.
- Implement auth bootstrap, API client, query client, app shell scaffold.

### F2: Tenant Context + Navigation
- Build `/login`, `/app/tenants`, and membership-aware shell navigation.
- Hook `GET /v1/me` and membership-driven navigation.

### F3: Staff Activity Logging
- Build department/task selection and dynamic field renderer.
- Implement create draft and submit flows.
- Implement "My Activity" list + resubmit flow.

### F4: HOD Review Experience
- Implement pending review queue with filters.
- Implement approve/reject with validation and optimistic updates.
- Implement member/contributor department views.

### F5: Tenant Admin Experience
- Implement roles management with permission catalog.
- Implement invite-first flow with role assignment and lifecycle view.
- Implement department/HOD management UI.
- Implement task template builder + assignment UI.

### F6: Quality and Release Readiness
- Add loading/skeleton/error empty states across pages.
- Accessibility pass (keyboard + labels + aria basics).
- Add smoke E2E path tests and critical unit tests.
- Add production build/deployment docs.

## 7) Testing Plan (Frontend)

### Unit/component tests
- Dynamic field renderer correctness for each field type.
- PermissionGate and navigation visibility by permission.
- Invite form validation (`roleId` xor `roleIds`) behavior.

### Integration tests
- Activity creation end-to-end (department -> task -> submit).
- Rejected entry resubmit journey.
- HOD approve/reject paths with error handling.

### E2E smoke scenarios
- Tenant owner: create role, invite user with role.
- Staff: submit activity in non-home department.
- HOD: see pending entries for own departments only and approve.

## 8) Non-Functional Requirements
- Responsive UI for desktop + mobile.
- Consistent API error surface and toast/error-banner handling.
- No direct Firestore access for business data from frontend.
- Clear permission-denied states instead of hidden failures.

## 9) Frontend Definition of Done
- All F1â€“F5 user journeys are functional with real backend APIs.
- Core role-based flows (`Owner`, `Head of Department`, `Staff`) verified.
- Dynamic task forms support all catalog field types.
- Project docs updated with run steps and architecture notes.
- Baseline tests passing in CI.
