# TimesheetPlus Web (`apps/web`)

Next.js + TypeScript frontend for the TimesheetPlus backend.

## Local Run
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env template:
   ```bash
   cp .env.example .env.local
   ```
3. Start dev server:
   ```bash
   npm run dev
   ```

## Environment
- `NEXT_PUBLIC_API_BASE_URL`: backend API base URL (example: `http://localhost:4000`).
- `NEXT_PUBLIC_MOCK_AUTH`: `true` to use local mock auth (`x-user-*` headers).
- Firebase env vars are required only when mock auth is disabled.

## Route Surface

### Public
- `/`
- `/login`

### Authenticated root
- `/app`
- `/app/tenants`
- `/app/tenants/[tenantId]`

### Tenant scoped
- `/app/tenants/[tenantId]/owner`
- `/app/tenants/[tenantId]/users`
- `/app/tenants/[tenantId]/users/[userId]`
- `/app/tenants/[tenantId]/activities`
- `/app/tenants/[tenantId]/activities/new`
- `/app/tenants/[tenantId]/activities/[taskTemplateId]`
- `/app/tenants/[tenantId]/activity`
- `/app/tenants/[tenantId]/activity/new`
- `/app/tenants/[tenantId]/activity/my`
- `/app/tenants/[tenantId]/hod`
- `/app/tenants/[tenantId]/hod/review`
- `/app/tenants/[tenantId]/hod/departments/[departmentId]/members`
- `/app/tenants/[tenantId]/admin`
- `/app/tenants/[tenantId]/admin/roles`
- `/app/tenants/[tenantId]/admin/invites`
- `/app/tenants/[tenantId]/admin/departments`
- `/app/tenants/[tenantId]/admin/departments/[departmentId]`
- `/app/tenants/[tenantId]/admin/tasks`

## Current UX and Permission Behavior
- Sidebar tenant links render conditionally based on effective tenant permissions.
- Tenant title is shown in the top header (left side) for tenant-scoped pages.
- `Enter Portal` resolves destination by role/permissions:
  - owner -> owner dashboard
  - HOD/report-capable member -> owner dashboard route
  - other members -> My Activity page
- Pending invites are shown on `/app` and support both:
  - `Accept`
  - `Reject`
- Users page supports tenant-member removal (permission-gated) with custom confirmation modal.

## Notes
- Frontend integrates through backend REST APIs only.
- React Query handles server-state caching and invalidation.
- Active tenant and lightweight UI state are persisted in local storage.
