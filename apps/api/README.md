# TimesheetPlus API

## Setup
1. Copy `.env.example` to `.env`.
2. Install dependencies:
   - `npm.cmd install`
3. Start development server:
   - `npm.cmd run dev`

## Environment
- `PORT`: API port (default `4000`)
- `DATA_PROVIDER`: `memory` or `firestore`
- `MOCK_AUTH_ENABLED`: `true` for local/testing with headers
- `FIREBASE_PROJECT_ID`: required when using Firestore/Firebase Auth in cloud setup

Notes:
- The API loads env values from:
  - current working directory `.env`
  - `apps/api/.env`
- Existing shell environment variables take precedence over file values.

## Local Mock Auth
When `MOCK_AUTH_ENABLED=true`, pass these headers:
- `x-user-id`
- `x-user-email`
- `x-user-name`

## Scripts
- `npm.cmd run dev` - run API in watch mode
- `npm.cmd run build` - compile TypeScript to `dist`
- `npm.cmd run test` - run integration tests

## Roles and Invites
- Every new tenant is seeded with system roles:
  - `Owner`
  - `Head of Department`
  - `Staff`
- Master permission catalog is available at:
  - `GET /v1/catalog/permissions`
- Invite-first lifecycle:
  - `POST /v1/tenants/:tenantId/invites` creates a pending invite record (no membership is created yet).
  - `GET /v1/tenants/:tenantId/invites` returns invite lifecycle rows (`pending`, `accepted`, `revoked`).
  - `POST /v1/tenants/:tenantId/invites/:inviteId/accept` creates/activates membership for the authenticated invitee.
  - `GET /v1/me` includes `pendingInvites` matched by logged-in user email.
- Master field catalog for task form builders is available at:
  - `GET /v1/catalog/fields`
- Backward-compatible direct member add still exists:
  - `POST /v1/tenants/:tenantId/members`

## Tenant Lifecycle
- Create tenant:
  - `POST /v1/tenants`
- Soft-delete tenant (owner only):
  - `DELETE /v1/tenants/:tenantId`

Soft-delete behavior:
- Tenant document is marked with `deletedAt` and `deletedBy`.
- Deleted tenants are excluded from `GET /v1/me` memberships.
- Tenant-scoped endpoints treat deleted tenants as `404 Not Found`.
