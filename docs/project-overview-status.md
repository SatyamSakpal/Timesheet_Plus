# TimesheetPlus Project Overview and Current Status

## 1) Project Summary
- TimesheetPlus is a multi-tenant employee activity management platform.
- A tenant represents an organization.
- A user can belong to multiple tenants and can own multiple tenants.
- Each user has one home department in a tenant but can log activity in other departments.
- HOD users can govern multiple departments and approve activities only for departments they head.

## 2) Backend + Frontend Stack
- Backend: Express + TypeScript (`apps/api`)
- Data/Auth: Firebase (Auth + Firestore)
- Frontend: Next.js + TypeScript (`apps/web`)

## 3) Current Implementation State

### Implemented (backend complete for core v1)
- Tenant, member, role, and invite flows.
- Invite-first lifecycle:
  - creating invite does not create membership
  - membership is created/activated only on invite acceptance
  - `/v1/me` returns `pendingInvites` for logged-in email
- Tenant soft-delete flow (`DELETE /v1/tenants/:tenantId`) with deleted-tenant filtering in `/v1/me`.
- Default seeded roles (`Owner`, `Head of Department`, `Staff`).
- Master catalogs:
  - `permission_catalog`
  - `field_catalog`
- Department and HOD assignment flows.
- Task template + department assignment flows.
- Activity lifecycle:
  - create draft/submit
  - approve/reject
  - resubmit rejected entries
- Department visibility APIs:
  - members
  - contributors
- Audit logging for sensitive operations.
- Test suite for core backend behavior.

### Pending (backend)
- OpenAPI generation and published API reference.
- Deployment pipeline hardening and environment docs for production.
- Additional edge-case and tenant-isolation test coverage.
- Firestore index guidance based on production query patterns.

### Implemented (frontend foundation + workflows)
- Next.js App Router app scaffold under `apps/web`.
- Auth bootstrap with Firebase mode and local mock-auth mode.
- Typed API client + React Query server-state integration.
- Tenant context shell with dashboard scopes (`Dashboard`, `Created`, `Joined`).
- Tenant-scoped route structure under `/app/tenants/[tenantId]/...`.
- Staff workflow pages:
  - activity create (draft/submit)
  - activity list by department scope
  - rejected entry resubmit
- HOD workflow pages:
  - review queue with filters
  - approve/reject actions
  - department members/contributors view
- Tenant admin workflow pages:
  - roles management
  - invite creation + lifecycle table
  - department + HOD/member assignment
  - task template builder + department assignment
- Joined dashboard shows pending invite cards with in-dashboard accept action.

## 4) What Is Done vs Pending

### Done now
- Backend domain model and APIs are available for frontend integration.
- Documentation exists for:
  - repository folder structure and ownership guide
  - backend development tracking
  - Firestore collections
  - frontend implementation blueprint

### Pending next
- Complete F6 hardening tasks (E2E, richer accessibility pass, release docs).
- Validate full user journeys with backend.
- Add final project runbook (local + staging + production).

## 5) Suggested Next Session Start Checklist
1. Complete quality hardening pass (F6 tests/accessibility/release checks).
2. Validate end-to-end journeys against staging backend data.
3. Publish API and runbook documentation for staging/production operations.
