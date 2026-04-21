# TimesheetPlus Folder Structure Guide

This document explains the current repository layout and where each kind of code belongs.

Snapshot date: 2026-04-21

## 1) Repository Tree (Current)

```text
timesheet_plus/
|-- apps/
|   |-- api/
|   |   |-- package.json
|   |   |-- package-lock.json
|   |   |-- tsconfig.json
|   |   |-- README.md
|   |   |-- src/
|   |   |   |-- app.ts
|   |   |   |-- server.ts
|   |   |   |-- config/
|   |   |   |   |-- env.ts
|   |   |   |   `-- firebase.ts
|   |   |   |-- constants/
|   |   |   |   |-- default-roles.ts
|   |   |   |   |-- master-catalog.ts
|   |   |   |   `-- permissions.ts
|   |   |   |-- errors/
|   |   |   |   `-- app-error.ts
|   |   |   |-- middlewares/
|   |   |   |   |-- async-handler.ts
|   |   |   |   |-- auth.ts
|   |   |   |   |-- error-handler.ts
|   |   |   |   |-- request-logger.ts
|   |   |   |   `-- tenant-context.ts
|   |   |   |-- repositories/
|   |   |   |   |-- data-store.ts
|   |   |   |   `-- index.ts
|   |   |   |-- routes/
|   |   |   |   `-- v1/
|   |   |   |       |-- activity.routes.ts
|   |   |   |       |-- catalog.routes.ts
|   |   |   |       |-- department.routes.ts
|   |   |   |       |-- helpers.ts
|   |   |   |       |-- index.ts
|   |   |   |       |-- me.routes.ts
|   |   |   |       |-- task.routes.ts
|   |   |   |       |-- tenant.routes.ts
|   |   |   |       `-- schemas/
|   |   |   |           |-- activity.schemas.ts
|   |   |   |           |-- department.schemas.ts
|   |   |   |           |-- task.schemas.ts
|   |   |   |           `-- tenant.schemas.ts
|   |   |   |-- services/
|   |   |   |   |-- index.ts
|   |   |   |   `-- platform/
|   |   |   |       |-- activity.service.ts
|   |   |   |       |-- core.service.ts
|   |   |   |       |-- department.service.ts
|   |   |   |       |-- ids.ts
|   |   |   |       |-- index.ts
|   |   |   |       |-- task.service.ts
|   |   |   |       `-- tenant-role.service.ts
|   |   |   |-- types/
|   |   |   |   |-- domain.ts
|   |   |   |   `-- express.d.ts
|   |   |   `-- utils/
|   |   |       |-- entity.ts
|   |   |       `-- task-payload-validator.ts
|   |   `-- tests/
|   |       `-- api.integration.test.ts
|   `-- web/
|       |-- package.json
|       |-- package-lock.json
|       |-- tsconfig.json
|       |-- next.config.mjs
|       |-- tailwind.config.ts
|       |-- postcss.config.mjs
|       |-- README.md
|       |-- app/
|       |   |-- layout.tsx
|       |   |-- page.tsx
|       |   |-- globals.css
|       |   |-- login/
|       |   |   `-- page.tsx
|       |   `-- app/
|       |       |-- layout.tsx
|       |       |-- page.tsx
|       |       `-- tenants/
|       |           |-- page.tsx
|       |           `-- [tenantId]/
|       |               |-- layout.tsx
|       |               |-- page.tsx
|       |               |-- owner/
|       |               |   `-- page.tsx
|       |               |-- users/
|       |               |   `-- page.tsx
|       |               |-- activity/
|       |               |   |-- page.tsx
|       |               |   |-- my/
|       |               |   |   `-- page.tsx
|       |               |   `-- new/
|       |               |       `-- page.tsx
|       |               |-- hod/
|       |               |   |-- page.tsx
|       |               |   |-- review/
|       |               |   |   `-- page.tsx
|       |               |   `-- departments/
|       |               |       `-- [departmentId]/
|       |               |           `-- members/
|       |               |               `-- page.tsx
|       |               `-- admin/
|       |                   |-- page.tsx
|       |                   |-- roles/
|       |                   |   `-- page.tsx
|       |                   |-- invites/
|       |                   |   `-- page.tsx
|       |                   |-- departments/
|       |                   |   `-- page.tsx
|       |                   `-- tasks/
|       |                       `-- page.tsx
|       `-- src/
|           |-- components/
|           |   |-- activity/
|           |   |-- admin/
|           |   |-- auth/
|           |   |-- hod/
|           |   |-- layout/
|           |   `-- ui/
|           |-- hooks/
|           |-- lib/
|           |-- providers/
|           |-- store/
|           `-- views/
|-- docs/
|   |-- README.md
|   |-- development-plan.md
|   |-- folder-structure.md
|   |-- firestore-collections.md
|   |-- frontend-implementation-plan.md
|   `-- project-overview-status.md
`-- .gitignore
```

## 2) Top-Level Folders

### `apps/`
Contains executable applications in this monorepo-style layout.

- `apps/api`: backend Express + TypeScript API (implemented).
- `apps/web`: Next.js frontend application.

### `docs/`
Project-level documentation. This folder tracks product status, architecture intent, implementation plans, and data model references.

## 3) Backend App Structure (`apps/api`)

### Root of `apps/api`

- `package.json`: scripts and dependency manifest for the API app.
- `package-lock.json`: pinned npm dependency graph.
- `tsconfig.json`: TypeScript compile settings (`src` -> `dist`).
- `README.md`: API setup/run reference.
- `tests/`: integration tests that validate core end-to-end backend workflows.
- `src/`: runtime source code.

### `src` entry points

- `server.ts`: bootstrap file. Initializes Firebase when needed and starts HTTP server.
- `app.ts`: Express app assembly (security middleware, JSON parser, route registration, error handlers).

## 4) `src` Layer-by-Layer Breakdown

### `config/`
Environment and infrastructure initialization.

- `env.ts`: local `.env` file loading + zod-based environment parsing/defaults (`PORT`, `DATA_PROVIDER`, `MOCK_AUTH_ENABLED`, etc.).
- `firebase.ts`: singleton-style Firebase Admin initialization, plus getters for Auth and Firestore clients.

### `constants/`
Centralized static domain configuration.

- `permissions.ts`: canonical RBAC permission keys.
- `default-roles.ts`: system role seeds (`Owner`, `Head of Department`, `Staff`) and permission presets.
- `master-catalog.ts`: seed definitions for permission catalog and field catalog entries.

### `errors/`
Application error primitives.

- `app-error.ts`: typed `AppError` and helper throwers (`badRequest`, `unauthorized`, `forbidden`, `notFound`).

### `middlewares/`
Express middleware components used across routes.

- `auth.ts`: mock-auth (local/testing) or Firebase bearer-token authentication.
- `tenant-context.ts`: resolves tenant membership + effective permissions and attaches `req.tenantContext`.
- `async-handler.ts`: wraps async route handlers so thrown errors are forwarded correctly.
- `request-logger.ts`: HTTP logging using morgan.
- `error-handler.ts`: standardized error serialization for zod errors, app errors, and unhandled failures.

### `repositories/`
Persistence abstraction layer.

- `data-store.ts`: `IDataStore` interface and two implementations:
  - `InMemoryDataStore` for local/test flows.
  - `FirestoreDataStore` for cloud persistence.
- `index.ts`: store factory/singleton selection based on `DATA_PROVIDER`.

This layer isolates storage concerns so service logic does not depend directly on Firestore APIs.

### `services/`
Business logic layer.

- `services/index.ts`: exposes a singleton `PlatformService` and reset helper for tests.
- `services/platform/`: domain services composed via inheritance.

Service stack order:

1. `core.service.ts`
   - Shared entity lookup helpers, audit logging, catalog seeding, and cross-domain assertions.
2. `tenant-role.service.ts`
   - Tenant lifecycle, tenant membership lifecycle, invites, role management, tenant RBAC context resolution.
3. `department.service.ts`
   - Department creation, department member/HOD assignment, member and contributor visibility queries.
4. `task.service.ts`
   - Task template creation and template-to-department assignment.
5. `activity.service.ts`
   - Activity create/list/approve/reject/resubmit lifecycle.
6. `platform/index.ts`
   - `PlatformService` facade class exported to routes.
7. `platform/ids.ts`
   - deterministic ID helpers for membership-like documents.

### `routes/`
HTTP transport layer (v1 API).

- `routes/v1/index.ts`: aggregates all v1 domain routers.
- `routes/v1/helpers.ts`: shared route helper for safe path parameter extraction.

Domain routers:

- `tenant.routes.ts`: tenant create/delete, roles, invite create/list/accept, users directory, and membership role assignment.
- `department.routes.ts`: department create, member/HOD assignment, department member and contributor views.
- `task.routes.ts`: task template create, department task assignment/listing.
- `activity.routes.ts`: activity create/list/approve/reject/resubmit.
- `catalog.routes.ts`: permission catalog and field catalog read APIs.
- `me.routes.ts`: authenticated user profile + memberships endpoint (filters deleted tenants) and pending invites for authenticated email.

`routes/v1/schemas/` contains zod schemas for request payload validation per domain:

- `tenant.schemas.ts`
- `department.schemas.ts`
- `task.schemas.ts`
- `activity.schemas.ts`

### `types/`
Type contracts.

- `domain.ts`: canonical domain entities, collection names, enums, and request-scoped types.
- `express.d.ts`: Express request augmentation (`req.user`, `req.tenantContext`).

### `utils/`
Small reusable helpers.

- `entity.ts`: timestamp and ID generation helpers.
- `task-payload-validator.ts`: runtime validation for dynamic task payloads against schema.

## 5) Test Folder (`apps/api/tests`)

- `api.integration.test.ts` validates cross-domain behavior using in-memory storage and mock auth.
- The tests exercise realistic flows: tenant setup, role seed behavior, invite-first lifecycle, department visibility, activity lifecycle, approvals, catalog endpoints, and tenant soft-delete behavior.

## 6) Frontend App Structure (`apps/web`)

### Root of `apps/web`

- `package.json`: scripts for Next.js dev/build/lint/test.
- `next.config.mjs`: Next.js runtime configuration.
- `tailwind.config.ts`, `postcss.config.mjs`: styling pipeline configuration.
- `.env.example` / `.env.local`: frontend runtime env values.
- `app/`: Next.js App Router pages and layouts.
- `src/`: frontend domain code (components, hooks, providers, utilities, views).

### `app/` (Next.js App Router)

- `layout.tsx`: root HTML shell.
- `globals.css`: global styles and design tokens.
- `page.tsx`: root route.
- `login/page.tsx`: authentication entry page.
- `app/layout.tsx`: authenticated shell layout.
- `app/page.tsx`: dashboard landing page.
- `app/tenants/page.tsx`: tenant list/switch page.
- `app/tenants/[tenantId]/...`: tenant-scoped route tree.
  - `owner/page.tsx`
  - `users/page.tsx`
  - `activity/new/page.tsx`
  - `activity/my/page.tsx`
  - `hod/review/page.tsx`
  - `hod/departments/[departmentId]/members/page.tsx`
  - `admin/roles/page.tsx`
  - `admin/invites/page.tsx`
  - `admin/departments/page.tsx`
  - `admin/tasks/page.tsx`

### `src/` layer-by-layer

- `providers/`
  - App-level providers (`auth-provider`, `query-provider`, `app-providers`) wired into layouts.
- `hooks/`
  - API/auth/tenant hooks (`use-api-client`, `use-me`, `use-active-tenant`, `use-tenant-permissions`, etc.).
- `lib/`
  - Shared frontend utilities and contracts:
    - typed API client and environment parsing
    - route helpers and query keys
    - frontend type definitions
    - formatting and validation helpers
- `store/`
  - lightweight client state (`app-store`) for active-tenant and persisted UI context.
- `components/`
  - reusable UI and feature components grouped by domain:
    - `auth/`
    - `layout/`
    - `activity/`
    - `hod/`
    - `admin/`
    - `ui/`
- `views/`
  - page-level composition containers by domain:
    - `activity/`
    - `hod/`
    - `admin/`

### Frontend testing

- Component/unit tests are colocated under `src/` (for example `permission-gate.test.tsx`, `dynamic-field-renderer.test.tsx`).
- `vitest.config.ts` + `vitest.setup.ts` define frontend test runtime.

## 7) Documentation Folder (`docs`)

- `README.md`: entry index for all docs.
- `folder-structure.md`: this folder ownership and layering guide.
- `project-overview-status.md`: scope and implementation status.
- `development-plan.md`: backend/frontend phase tracking checklist.
- `frontend-implementation-plan.md`: frontend architecture and delivery blueprint.
- `firestore-collections.md`: collection-by-collection data dictionary.

## 8) Feature Placement Rules (Recommended)

When adding a new backend feature, follow this path:

1. Add or update request schema in `routes/v1/schemas`.
2. Add endpoint wiring in the relevant `routes/v1/*.routes.ts` file.
3. Implement business logic in the correct `services/platform/*.service.ts` layer.
4. Reuse `repositories/IDataStore` from services for all data access.
5. Add shared types in `types/domain.ts` if a new entity or enum is introduced.
6. Add tests in `tests/api.integration.test.ts` (or split into new files when test volume grows).

This keeps routing, domain logic, and persistence concerns separated and predictable.

When adding a new frontend feature, follow this path:

1. Add route file(s) in `apps/web/app/...` if a new page/URL is required.
2. Build page composition in `src/views/...` and keep route files thin.
3. Add reusable UI pieces in `src/components/...` under the relevant domain folder.
4. Add API/query wiring in `src/hooks` + `src/lib/api-client.ts` + `src/lib/query-keys.ts`.
5. Extend shared contracts in `src/lib/types.ts` and route helpers in `src/lib/tenant-routes.ts` when needed.
6. Add/adjust tests under `src/**/**.test.ts(x)` for new behavior.

This keeps routing, state, UI, and API integration concerns separated and predictable on the frontend as well.
