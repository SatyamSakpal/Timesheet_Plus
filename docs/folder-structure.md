# TimesheetPlus Folder Structure Guide

Snapshot date: 2026-04-25

This guide explains where code should live in the repository.

## 1) Top Level

```text
timesheet_plus/
|-- apps/
|   |-- api/
|   `-- web/
|-- docs/
|-- package-lock.json
`-- .gitignore
```

## 2) Backend (`apps/api`)

### Primary folders
- `src/config/` - env and Firebase bootstrap
- `src/constants/` - permission keys, default roles, catalog seeds
- `src/errors/` - shared app error primitives
- `src/middlewares/` - auth, tenant context, error handling, async wrapper
- `src/repositories/` - datastore abstraction (memory/firestore)
- `src/routes/v1/` - HTTP transport layer and zod schemas
- `src/services/platform/` - business logic layers
- `src/types/` - domain and Express typing
- `src/utils/` - utility helpers
- `tests/` - API integration tests

### Service layering
- `core.service.ts` -> shared primitives
- `tenant-role.service.ts` -> tenants, invites, roles, members
- `department.service.ts` -> department/hod/member/contributor scope
- `task.service.ts` -> templates and assignments
- `activity.service.ts` -> activity lifecycle

## 3) Frontend (`apps/web`)

### App Router surface
- `app/` holds route entry files (`page.tsx`, `layout.tsx`)
- tenant routes are under `app/app/tenants/[tenantId]/...`

### Source layers (`src/`)
- `components/` - reusable UI and feature components
- `views/` - page-level feature compositions
- `hooks/` - API/auth/tenant hooks
- `lib/` - constants, API client, route helpers, types, formatters
- `providers/` - app providers
- `store/` - lightweight client state

## 4) Documentation (`docs/`)
- `README.md` - documentation index
- `project-overview-status.md` - current status
- `development-plan.md` - milestone tracker
- `frontend-implementation-plan.md` - frontend architecture reference
- `firestore-collections.md` - data dictionary
- `design.md` - design baseline

## 5) Placement Rules

### Backend changes
1. Define or update request schema in `routes/v1/schemas`.
2. Wire endpoint in `routes/v1/*.routes.ts`.
3. Add business logic in the correct `services/platform/*` layer.
4. Reuse `IDataStore` abstraction from services.
5. Add/adjust integration tests in `tests/api.integration.test.ts`.

### Frontend changes
1. Add route entry under `app/` only when URL surface changes.
2. Keep route files thin; compose logic in `src/views/`.
3. Put reusable UI in `src/components/`.
4. Put API and query wiring in `src/hooks` + `src/lib`.
5. Update shared frontend types in `src/lib/types.ts`.
