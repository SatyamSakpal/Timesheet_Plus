# TimesheetPlus Web (`apps/web`)

Next.js + TypeScript frontend for TimesheetPlus v1 backend APIs.

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

- `NEXT_PUBLIC_API_BASE_URL`: backend API base URL (for example `http://localhost:4000`).
- `NEXT_PUBLIC_MOCK_AUTH`: set to `true` to use local mock auth and pass `x-user-*` headers.
- Firebase vars are required only when mock auth is disabled.

## Implemented Route Surface

- `/login`
- `/app`
- `/app/tenants`
- `/app/tenants/[tenantId]`
- `/app/tenants/[tenantId]/owner`
- `/app/tenants/[tenantId]/users`
- `/app/tenants/[tenantId]/activity/new`
- `/app/tenants/[tenantId]/activity/my`
- `/app/tenants/[tenantId]/hod/review`
- `/app/tenants/[tenantId]/hod/departments/[departmentId]/members`
- `/app/tenants/[tenantId]/admin/roles`
- `/app/tenants/[tenantId]/admin/invites`
- `/app/tenants/[tenantId]/admin/departments`
- `/app/tenants/[tenantId]/admin/tasks`

## Notes

- Frontend integrates only through backend REST endpoints.
- Tenant routes are tenant-scoped in URL path (`/app/tenants/[tenantId]/...`).
- Dashboard sidebar exposes tenant-specific navigation; module visibility can be permission-gated.
- Owner cards on `/app` support tenant deletion through a 3-dot menu, backed by `DELETE /v1/tenants/:tenantId` soft-delete behavior.
- Joined Organizations on `/app` also renders pending invite cards from `/v1/me.pendingInvites`, and accepts invites from the dashboard.
- Admin invites page shows invite lifecycle (`pending`/`accepted`/`revoked`).
- App shell state uses persisted local storage (`timesheetplus-web-state`) for active tenant and known department hints.
