# TimesheetPlus Frontend Implementation Reference

Snapshot date: 2026-04-27

This file captures the frontend architecture and current behavior baseline for `apps/web`.

## 1) Objective
Deliver a tenant-aware frontend with:
- role-sensitive navigation and access
- activity logging and review workflows
- tenant administration (users, roles, invites, departments, activities)

## 2) Architecture
- Framework: Next.js App Router + TypeScript
- Styling: Tailwind + local UI primitives
- State:
  - React Query for server state
  - lightweight client store for active tenant/session UI state
- API integration:
  - typed REST client
  - no direct Firestore reads for domain data

## 3) Auth and Tenant Context
- Supports Firebase auth and local mock-auth mode.
- Active tenant is persisted client-side and validated against `/v1/me` memberships.
- Enter Portal route is resolved by permissions:
  - owner -> owner dashboard
  - HOD/report-capable member -> owner dashboard route
  - other members -> My Activity page

## 4) Route Map

### Public
- `/`
- `/login`

### Authenticated
- `/app`
- `/app/tenants`
- `/app/tenants/[tenantId]`

### Tenant modules
- Owner/HOD dashboards
  - `/app/tenants/[tenantId]/owner`
  - `/app/tenants/[tenantId]/hod/review`
  - `/app/tenants/[tenantId]/hod/departments/[departmentId]/members`
- User management
  - `/app/tenants/[tenantId]/users`
  - `/app/tenants/[tenantId]/users/[userId]`
- Activity management
  - `/app/tenants/[tenantId]/activity/my`
  - `/app/tenants/[tenantId]/activity/new`
  - `/app/tenants/[tenantId]/activities`
  - `/app/tenants/[tenantId]/activities/new`
  - `/app/tenants/[tenantId]/activities/[taskTemplateId]`
- Admin
  - `/app/tenants/[tenantId]/admin/roles`
  - `/app/tenants/[tenantId]/admin/invites`
  - `/app/tenants/[tenantId]/admin/departments`
  - `/app/tenants/[tenantId]/admin/departments/[departmentId]`
  - `/app/tenants/[tenantId]/admin/tasks`

## 5) Key Implemented UX Rules
- Sidebar links render conditionally from effective tenant permissions.
- Sidebar is collapsible with animated transitions and icon-only mode support.
- Sidebar order is:
  - Dashboard
  - Users
  - HOD Review
  - My Activity
  - Department
  - Activities
  - Roles
  - Invites
- Sidebar includes `My Organization` at the bottom, linking to `/app`.
- Dropdowns on activity/member/department selectors use searchable selects.
- Modal pattern uses:
  - `ModalOverlay` for backdrop and viewport-centering
  - rounded outer shell with `overflow-hidden`
  - inner scroll container with stable scrollbar gutter
- HOD review:
  - logs and people summary in side-by-side cards
  - logs row click opens detail modal (normal mode)
  - selection mode supports row-based multi-select + bulk approve/reject
  - all-departments aggregate mode shows contributors only in people panel.

## 6) API Dependencies
Frontend depends on these backend capabilities:
- `/v1/me`, catalogs, tenant/invite/role/member/user APIs
- department, activity-template, and activity APIs
- invite accept/reject and member removal endpoints

## 7) Remaining Frontend Hardening
- Expand E2E coverage for complete role-based flows.
- Run deeper accessibility pass on modal and table interactions.
- Add release and monitoring documentation for production rollouts.
