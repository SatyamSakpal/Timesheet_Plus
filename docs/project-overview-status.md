# TimesheetPlus Project Overview and Current Status

Snapshot date: 2026-04-28

## 1) Project Summary
- TimesheetPlus is a multi-tenant activity logging and review platform for colleges and education organizations.
- A tenant represents one organization.
- A user can belong to multiple tenants and can own one or more tenants.
- Each user has one home department per tenant and can log work in other departments.
- HOD users can manage multiple departments and review only scoped activities.

## 2) Stack
- Backend: Express + TypeScript (`apps/api`)
- Frontend: Next.js App Router + TypeScript (`apps/web`)
- Data/Auth: Firebase Auth + Firestore (or in-memory for local tests)

## 3) Implemented Capabilities

### Backend
- Tenant lifecycle with soft delete.
- Role-based access control with system-seeded roles (`Owner`, `Head of Department`, `Staff`).
- Master catalogs:
  - permissions catalog
  - field-type catalog
  - preset department catalog
  - preset activity template catalog
- Tenant bootstrap seeding:
  - preset departments for education domain
  - preset activities with field schemas
  - default department-to-activity assignments
  - default `Other` activity assignment (description-only), including future activity additions.
- Invite-first user onboarding:
  - create invite
  - accept invite
  - reject invite
  - list invite lifecycle states (`pending`, `accepted`, `revoked`)
- Member management:
  - list/add/remove members
  - assign roles
  - update home department
  - owner-protected safeguards on member removal
- Department management:
  - create/delete departments
  - assign members/HODs
  - view members/HODs/contributors
  - delete guard if users are still assigned (blocking users returned in API error details)
- Activity template management:
  - create/update/delete templates
  - assign/unassign templates to departments
  - tenant-level unique activity-name validation
  - delete guard if template is still assigned (blocking departments returned in API error details)
- Activity lifecycle:
  - create draft/submit
  - approve/reject
  - resubmit rejected entries
  - edit own `submitted` and `rejected` entries
  - delete own pending entries
  - overlap validation for time ranges on same user/date
- Tenant user directory and user detail APIs for owner/HOD scope.

### Frontend
- Auth flow with tenant-aware app shell.
- Sidebar UX updates:
  - collapsible sidebar with smooth animation
  - collapsed-mode icon alignment and overflow fixes
  - updated item order and distinct icons
  - bottom shortcut to `/app` as `My Organization`
- Permission-gated tenant navigation.
- Dashboard pending invite cards with accept/reject actions.
- Owner and HOD dashboards and review workflows.
- HOD review page:
  - split logs and people summary cards
  - row-click activity detail modal
  - all-departments aggregate filter for multi-department HODs
  - contributor-only people panel in all-departments mode
  - row selection mode with bulk approve/reject (with reject-reason modal)
  - logs table department column
- My Activity:
  - log/create workflow
  - default current-week filter with date-window arrows on the date tag
  - previous-week copy preview modal with explicit confirm copy action
  - filtering and details modal
  - entries table view aligned with HOD-style table presentation
  - owner-only edit for `submitted` and `rejected` logs
  - delete actions for allowed entries
  - searchable dropdowns for activity/member/department selectors
- Users directory and user detail views.
- Tenant member removal from Users page with custom confirmation modal.
- Admin modules for roles, invites, departments, and activities.
- Modal system hardening:
  - viewport-centered behavior on scrollable pages
  - consistent rounded-corner + scroll handling using clipped shell + inner scroll container.

## 4) Current Gaps / Pending Work
- OpenAPI or machine-readable API reference generation.
- Expanded production runbook (staging/prod ops, backup, incident SOP).
- Broader E2E and accessibility coverage.
- Firestore index tuning based on production traffic patterns.

## 5) Documentation Maintenance Rule
Whenever backend routes or tenant UX changes, update these three files in the same PR:
1. `apps/api/README.md`
2. `apps/web/README.md`
3. `docs/project-overview-status.md`
