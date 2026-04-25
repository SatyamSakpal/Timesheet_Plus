# TimesheetPlus Project Overview and Current Status

Snapshot date: 2026-04-25

## 1) Project Summary
- TimesheetPlus is a multi-tenant activity logging and review platform.
- A tenant represents an organization.
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
- Master catalogs for permissions and form field types.
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
  - create departments
  - assign members/HODs
  - view members/HODs/contributors
- Task management:
  - create/update templates
  - assign/unassign templates to departments
- Activity lifecycle:
  - create draft/submit
  - approve/reject
  - resubmit rejected entries
  - delete own pending entries
  - overlap validation for time ranges on same user/date
- Tenant user directory and user detail APIs for owner/HOD scope.

### Frontend
- Auth flow with tenant-aware app shell.
- Permission-gated tenant navigation.
- Tenant portal routing by role/permission on Enter Portal.
- Dashboard pending invite cards with accept/reject actions.
- Owner and HOD dashboards and review workflows.
- My Activity logging, filtering, detail modal, and delete actions.
- Users directory and user detail views.
- Tenant member removal from Users page with custom confirmation modal.
- Admin modules for roles, invites, departments, and tasks.

## 4) Current Gaps / Pending Work
- OpenAPI or machine-readable API reference generation.
- Expanded production runbook (staging/prod ops, backup, incident SOP).
- Broader E2E and accessibility coverage.
- Firestore index tuning based on production traffic patterns.

## 5) Suggested Next Documentation Maintenance Rule
Whenever backend routes or tenant UX changes, update these three files in the same PR:
1. `apps/api/README.md`
2. `apps/web/README.md`
3. `docs/project-overview-status.md`
