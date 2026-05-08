# TimesheetPlus API

Backend service for multi-tenant activity logging, review, and administration.

## Setup
1. Copy `.env.example` to `.env`.
2. Install dependencies:
   - `npm.cmd install`
3. Start development server:
   - `npm.cmd run dev`

## Environment
- `PORT`: API port (default `4000`)
- `DATA_PROVIDER`: `memory` or `firestore`
- `MOCK_AUTH_ENABLED`: `true` for local/testing with request headers
- `FIREBASE_PROJECT_ID`: required when using Firebase Auth/Firestore
- `GOOGLE_APPLICATION_CREDENTIALS`: optional explicit path to Firebase service account JSON
- `FIREBASE_SERVICE_ACCOUNT_JSON`: optional full service-account JSON string (recommended for hosting)
- `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64`: optional base64-encoded service-account JSON

Notes:
- Env values are loaded from shell env first, then local `.env` files.
- If `GOOGLE_APPLICATION_CREDENTIALS` is not set, API auto-detects `service-account.json` in the current folder, `apps/api`, or repo root.
- If `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` is provided, API uses it directly for `firebase-admin` credentials.
- API supports in-memory persistence for local tests and Firestore for persistent environments.

## Render Deployment (Firestore)
Set these environment variables in Render:
- `DATA_PROVIDER=firestore`
- `FIREBASE_PROJECT_ID=<your-project-id>`
- `FIREBASE_SERVICE_ACCOUNT_JSON=<full service-account json>` (preferred) OR `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64=<base64-json>`

Do not upload `service-account.json` to Render and do not commit credentials into git.

## Local Mock Auth
When `MOCK_AUTH_ENABLED=true`, pass:
- `x-user-id`
- `x-user-email`
- `x-user-name`

## Scripts
- `npm.cmd run dev` - watch mode
- `npm.cmd run build` - compile TS to `dist`
- `npm.cmd run test` - integration tests

## Core Behavior
- Tenant creation seeds system roles: `Owner`, `Head of Department`, `Staff`.
- Master preset catalogs are used to bootstrap tenant domain data:
  - preset departments
  - preset activity templates and field schemas
  - preset department-to-activity assignments.
- Default `Other` activity is supported as a description-only activity and is maintained across departments as configured by platform services.
- Invite-first membership lifecycle:
  - Invite creation does not create tenant membership.
  - Membership is created/activated only on invite acceptance.
  - Invitee can reject invite before acceptance.
- Tenant member management includes removal with safeguards:
  - owner cannot be removed
  - self-removal is blocked
  - department member/HOD mappings are cleaned up on removal
- Department deletion safeguards:
  - delete blocked if users are still assigned
  - blocking users are returned in error details.
- Activity-template safeguards:
  - template names are unique per tenant
  - delete blocked if still assigned to departments
  - blocking departments are returned in error details.
- Tenant soft delete (`DELETE /tenants/:tenantId`) excludes deleted tenant from `/v1/me` memberships.
- Activity creation enforces time-range overlap validation per user/date.
- Activity editing supports creator-owned updates for `submitted` and `rejected` entries.

## API Surface

### Session and catalogs
- `GET /v1/me`
- `GET /v1/catalog/permissions`
- `GET /v1/catalog/fields`

### Tenant lifecycle
- `POST /v1/tenants`
- `DELETE /v1/tenants/:tenantId`

### Invites
- `POST /v1/tenants/:tenantId/invites`
- `GET /v1/tenants/:tenantId/invites`
- `POST /v1/tenants/:tenantId/invites/:inviteId/accept`
- `POST /v1/tenants/:tenantId/invites/:inviteId/reject`

### Roles and members
- `POST /v1/tenants/:tenantId/roles`
- `GET /v1/tenants/:tenantId/roles`
- `DELETE /v1/tenants/:tenantId/roles/:roleId`
- `GET /v1/tenants/:tenantId/members`
- `POST /v1/tenants/:tenantId/members`
- `DELETE /v1/tenants/:tenantId/members/:memberUserId`
- `POST /v1/tenants/:tenantId/members/:memberUserId/roles`
- `GET /v1/tenants/:tenantId/users`
- `GET /v1/tenants/:tenantId/users/:userId`
- `PATCH /v1/tenants/:tenantId/users/:userId/home-department`

### Departments
- `POST /v1/tenants/:tenantId/departments`
- `GET /v1/tenants/:tenantId/departments`
- `DELETE /v1/tenants/:tenantId/departments/:departmentId`
- `POST /v1/tenants/:tenantId/departments/:departmentId/members`
- `POST /v1/tenants/:tenantId/departments/:departmentId/hods`
- `GET /v1/tenants/:tenantId/departments/:departmentId/members`
- `GET /v1/tenants/:tenantId/departments/:departmentId/hods`
- `GET /v1/tenants/:tenantId/departments/:departmentId/contributors`

### Activity templates
- `POST /v1/tenants/:tenantId/task-templates`
- `GET /v1/tenants/:tenantId/task-templates`
- `PATCH /v1/tenants/:tenantId/task-templates/:taskTemplateId`
- `DELETE /v1/tenants/:tenantId/task-templates/:taskTemplateId`
- `POST /v1/tenants/:tenantId/departments/:departmentId/tasks/:taskTemplateId`
- `DELETE /v1/tenants/:tenantId/departments/:departmentId/tasks/:taskTemplateId`
- `GET /v1/tenants/:tenantId/departments/:departmentId/tasks`

### Activities
- `POST /v1/tenants/:tenantId/activities`
- `GET /v1/tenants/:tenantId/activities/my`
- `GET /v1/tenants/:tenantId/departments/:departmentId/activities`
- `POST /v1/tenants/:tenantId/activities/:activityId/approve`
- `POST /v1/tenants/:tenantId/activities/:activityId/reject`
- `POST /v1/tenants/:tenantId/activities/:activityId/resubmit`
- `PATCH /v1/tenants/:tenantId/activities/:activityId`
- `DELETE /v1/tenants/:tenantId/activities/:activityId`
