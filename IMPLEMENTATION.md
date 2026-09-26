# Ticket 5 — Profile view and edit

Owner: Ayesha Siddiqa
Repository: https://github.com/joannakiruba/Engagement-Intelligence-Platform
Scope: ticket 5 only
Status: planning template; verify against the checkout before marking any item complete.
Reference main: 76e53d4839c08407bb3b0de0af17b596b2adea3d, checked 26 September 2026.

## 1. User story

As a logged-in user in any of the six roles, I can view my own profile and edit permitted fields without reading or changing another user's private information through my profile screen.

Roles: STUDENT, TRAINER, FACULTY, MENTOR, COORDINATOR, ADMIN. Even administrators use the self-service restrictions when editing /users/me; administrative management is a separate feature.

## 2. Start by inspecting the actual repository

The inspected main already has GET /users/me and PATCH /users/me in backend-api/src/routes/users.routes.ts. All six roles have users:read:own and users:update:self in the permission catalog. Do not create duplicate routes or assume authentication is missing.

Inspect these files before editing:

- backend-api/src/routes/users.routes.ts
- backend-api/src/auth/jwt.middleware.ts
- backend-api/src/auth/rbac.middleware.ts
- backend-api/src/auth/auth.controller.ts
- backend-api/src/prisma/schema.prisma
- backend-api/src/prisma/permission-catalog.ts
- backend-api/src/middleware/validate.middleware.ts
- backend-api/src/middleware/error.middleware.ts
- backend-api/src/lib/prisma.ts
- backend-api/src/server.ts
- backend-api/src/swagger/swagger.json
- frontend/src/App.tsx
- frontend/src/services/api.ts
- frontend/src/services/auth.service.ts
- frontend/vite.config.ts
- package.json, backend-api/package.json, frontend/package.json, test/build configuration

Record the current commit, clean/dirty working-tree state, existing behavior and missing parts below. Read any existing repository instructions. Attached design documents are reference material, not authorization for unrelated work.

### Inspection findings — filled in 2026-09-26

- Base commit: 76e53d4 (HEAD of main, branch ayesha-ticket-5-profile checked out clean, only CLAUDE.md and IMPLEMENTATION.md untracked)
- Existing profile endpoints: **Both exist** in `backend-api/src/routes/users.routes.ts`:
  - `GET /users/me` (lines 19–41): authenticateJwt → requirePermission('users:read:own') → Prisma select with id, name, email, phone, department, year, status, createdAt, updatedAt, role{id,name}. Returns `{ success, data }`. **Working but needs refinement** (see gaps below).
  - `PATCH /users/me` (lines 43–70): authenticateJwt → requirePermission('users:update:self') → Joi validate → Prisma update. Returns same shape. **Working but needs refinement** (see gaps below).
  - Routes are mounted at `/users` in `server.ts` line 38. `/me` is registered before `/:id` — correct ordering.
- Existing profile/auth frontend:
  - `frontend/src/services/api.ts` — **empty file**, no Axios instance configured.
  - `frontend/src/services/auth.service.ts` — **empty file**, no auth client.
  - `frontend/src/App.tsx` — has nav (EIP, Assessments, Batches) and routes for assessments/batches only. **No login page, no auth context, no profile page, no /profile route**.
  - `frontend/src/pages/` — only `assessments/` and `batches/` directories.
  - `frontend/vite.config.ts` — proxy for `/api` → localhost:3000. **Missing proxy for `/users` and `/auth`** (profile endpoints are at `/users/me`, auth at `/auth/*`).
- Allowed profile fields: Permission catalog confirms all six roles hold `users:read:own` and `users:update:self`. The Joi schema in `updateProfileSchema` allows `name` and `phone` with `.min(1)` for Joi's minimum keys.
- Middleware behavior for unknown fields: `validate.middleware.ts` uses `stripUnknown: true` — silently drops unknown keys. **This is a gap**: IMPLEMENTATION.md §4 requires strict rejection of forbidden fields with 400. Must use a different validation approach for `/users/me` PATCH without changing the global middleware.
- Existing test commands: `npm test -- --runInBand` in backend-api; Jest with @swc/jest transform. One test file: `tests/auth-rbac.test.ts` (unit tests for permission catalog, JWT, password, CSV parsing — no integration/DB tests).
- Pre-existing failures: Not yet run (no .env / DB configured in this inspection pass). Known concerns from IMPLEMENTATION.md §9: TS7 vs legacy module resolution, Jest TS config loader, migration ordering on empty DB.

### Gaps requiring implementation

**Backend gaps (existing code → ticket-5 contract):**

1. **No strict validation on PATCH /users/me**: Current `validate()` uses `stripUnknown: true`, silently dropping forbidden fields like `roleId`, `email`, `status`. Ticket requires 400 rejection. Need a `validateStrict()` variant or inline Joi options `{ allowUnknown: false }` for this route only.
2. **Name validation too loose**: Current Joi schema is `Joi.string().min(1).max(255)` — does not trim, does not reject control characters, does not enforce "at least one non-whitespace character".
3. **Phone validation missing**: Current schema is `Joi.string().allow(null, '')` — no digit count, no format check, no normalization of empty/whitespace to null. Ticket requires: optional leading +, digits/spaces/parens/hyphens, max 30 chars, 7–15 digits if nonempty, empty/whitespace → null.
4. **No audit log on profile update**: PATCH /users/me does a plain `prisma.user.update` without a `PROFILE_UPDATED` audit record and without a transaction wrapping both.
5. **No old-values capture**: Audit needs before/after fields; current code doesn't read the old record first.
6. **No inactive-user check**: `authenticateJwt` verifies the JWT signature but does not re-read account status from the DB. A deactivated user with a still-valid JWT can access /users/me. Need an active-user middleware or inline check.
7. **No Cache-Control header**: GET /users/me should set `Cache-Control: no-store` to prevent caching of private profile data.
8. **PATCH /users/me data spread issue**: Line 60 uses `...(name && { name })` — a falsy name (empty string after trim) wouldn't set. Should use explicit undefined check after validation.

**Frontend gaps (everything is new):**

1. **API client**: `api.ts` is empty. Need an Axios instance with base URL, interceptors for access token from memory, 401 → refresh token rotation via `/auth/refresh` cookie, and retry.
2. **Auth service**: `auth.service.ts` is empty. Need login/logout/refresh functions and in-memory token storage (no localStorage for access tokens per ticket).
3. **Auth context/state**: No React context for authentication. Need `AuthContext` with user state, login, logout, and token refresh.
4. **Login page**: No login UI exists. Need minimal `/login` page using existing `/auth/login` backend endpoint so the profile flow can be tested end-to-end.
5. **Profile page**: No `/profile` route or page. Need `ProfilePage.tsx` with view/edit form per §6.
6. **Navigation**: Need "My Profile" link in nav for logged-in users, conditional on auth state.
7. **Vite proxy**: Need `/users` and `/auth` proxy rules in `vite.config.ts`.
8. **Route protection**: Need to redirect unauthenticated users to login.

**Testing gaps:**

1. No integration tests hitting the actual Express handlers. Need `profile.integration.test.ts` exercising all six roles, forbidden fields, cross-user isolation, audit logging, and edge cases.

**Documentation gaps:**

1. Swagger `/users/me` entries exist but may not reflect the refined validation/audit contract.
2. `docs/TICKET_5_PROFILE.md` does not exist yet.

## 3. Scope boundaries

Implement profile view/edit and only the supporting integration needed to use it. Exclude tickets 15 and 21, weekly reports, leaderboard, risk scoring, email workers, batch management changes and other users' CRUD work.

Reuse existing JWT, refresh-token, role-permission and account-lifecycle logic. Do not rewrite login/logout/activation/password-reset backend code. If there is no usable frontend sign-in entry point, add only a minimal screen/client integration using the existing auth endpoints, or document the team's intended integration.

No schema change is expected. Preserve the merged assessment models and migrations. No Bedrock or AWS SDK is needed in this application: Bedrock is the provider used by the coding assistant.

## 4. Profile field policy

| Field | Display | Self-service edit |
| --- | --- | --- |
| name | Yes | Yes |
| phone | Yes | Yes; nullable |
| email | Yes | No |
| role | Yes | No |
| department | Yes | No |
| year | Yes | No |
| status | Yes | No |
| createdAt / updatedAt | May display | No |
| id | May return for identity | No |
| passwordHash / tokens | Never | Never |

Use an explicit response select. Do not serialize the complete Prisma User record.

Validation policy for this ticket:

- Body must be an object with at least one permitted property.
- Reject every unknown/forbidden property, including when name or phone is also present.
- Name: trim, require at least one non-whitespace character, maximum 255 characters; reject control characters.
- Phone: optional leading +; digits, spaces, parentheses and hyphens; maximum 30 characters. For nonempty values, require 7–15 digits. Normalize an empty/whitespace-only string or null to null. This is format validation, not phone ownership verification.
- Omitted fields retain their existing values.

The existing generic validation middleware strips unknown keys. For this endpoint, use strict validation so forbidden fields receive a clear 400 response. Avoid changing validation behavior for unrelated endpoints.

## 5. API contract

### GET /users/me

- Require a valid bearer access token, active account and users:read:own permission.
- Resolve identity exclusively from the verified JWT subject.
- Re-read current account status and role before permission evaluation so deactivation or role removal is respected.
- Return the established { success: true, data: profile } envelope.
- Select only id, name, email, phone, department, year, status, createdAt, updatedAt and safe role fields.
- Prevent caching of private profile responses.

### PATCH /users/me

- Require a valid bearer token, active account and users:update:self permission.
- Resolve the target exclusively from the JWT subject. There is no editable userId/id parameter.
- Accept only validated name and phone.
- Build the Prisma update data explicitly; never spread req.body into it.
- Update the current user and write a PROFILE_UPDATED audit record in one transaction.
- Audit only relevant before/after profile fields plus actor, target and available request metadata; never log tokens/passwords.
- Return the same safe profile shape as GET, including updatedAt.

Example request:

    PATCH /users/me
    Authorization: Bearer <access-token>
    Content-Type: application/json

    { "name": "Ayesha Siddiqa", "phone": "+91 98765 43210" }

Example failure:

    { "name": "Ayesha", "roleId": "another-role-id" }

This must return 400 and leave all fields unchanged.

Use the repository's error envelope: { success: false, error: message }. Cover invalid input (400), invalid/missing/expired authentication or inactive account (401), missing permission (403), and a record disappearing during the request (404). Keep /me registered before /:id so it is not interpreted as a user ID.

## 6. Frontend

- Add or complete /profile and an accessible My profile navigation link for logged-in users of all six roles.
- Load GET /users/me and display safe read-only account fields.
- Edit only full name and phone; explain how to correct read-only fields through an administrator.
- Show initial loading, request errors, successful save and saving states.
- Disable duplicate submissions and disable Save when there are no valid changes.
- Cancel restores the last saved values.
- Submit only changed editable fields through PATCH /users/me.
- Support clearing the phone number.
- Reuse the existing API client/auth state if present. Use the existing refresh cookie, share concurrent refresh requests, avoid infinite retry loops and keep new access tokens out of persistent browser storage.
- Handle expired sessions by restoring authentication or showing a clear sign-in action.
- Do not add AWS settings or credentials to the frontend.
- If needed, add /users and /auth development proxy rules without disturbing /api.
- Keep the layout usable on small screens, with labels and accessible success/error messages.

## 7. Files to change (confirmed against checkout)

- **backend-api/src/routes/users.routes.ts**: Refine GET /users/me (add Cache-Control, active-user check) and PATCH /users/me (strict validation, audit log transaction, explicit field assignment). No new route files needed — handlers stay inline per existing convention.
- **backend-api/src/middleware/validate.middleware.ts**: Add a `validateStrict()` export (or add an options parameter) that uses `allowUnknown: false` instead of `stripUnknown: true`. Only PATCH /users/me will use it; other routes stay unchanged.
- **backend-api/tests/profile.integration.test.ts**: New file. Tests for all six roles, forbidden fields, inactive user, audit log, and edge cases.
- **backend-api/src/swagger/swagger.json**: Update /users/me GET and PATCH descriptions to match refined contract.
- **frontend/src/services/api.ts**: Populate with Axios instance, auth token interceptor, 401 refresh retry.
- **frontend/src/services/auth.service.ts**: Populate with login/logout/refresh calling /auth/* endpoints.
- **frontend/src/context/AuthContext.tsx**: New file. React context for auth state (user, accessToken in memory, login, logout).
- **frontend/src/pages/auth/LoginPage.tsx**: New file. Minimal login form.
- **frontend/src/pages/profile/ProfilePage.tsx**: New file. Profile view/edit.
- **frontend/src/App.tsx**: Add /login, /profile routes; conditional nav links; route guard.
- **frontend/vite.config.ts**: Add `/users` and `/auth` proxy rules.
- **docs/TICKET_5_PROFILE.md**: New file. Usage, editable fields, test results and limitations.

No new backend dependencies. No schema/migration changes. No changes to unrelated routes or modules.

Any build/test configuration change must be necessary, minimal and explained. Do not upgrade packages broadly to make unrelated failures disappear.

## 8. Test checklist

- [x] Each of the six roles can GET its own profile. (unit + HTTP integration: 6 supertest GET /users/me tests, one per role, all return 200 with correct data)
- [x] Each role can PATCH only its own name/phone. (unit + HTTP integration: 6 supertest PATCH /users/me tests per role + 28 schema tests reject all other fields)
- [x] No password hash, refresh token or account recovery token is returned. (unit: 7 SAFE_PROFILE_SELECT tests; HTTP: safe-fields integration test checks actual response)
- [x] Missing, invalid and expired JWTs are rejected. (HTTP integration: 5 auth error tests — no token, invalid token, expired token on GET and PATCH)
- [x] Inactive/deleted users with an otherwise valid token are rejected. (HTTP integration: 3 tests — INACTIVE rejected on GET, INACTIVE rejected on PATCH, PENDING rejected)
- [x] Permission checks use the current database role rather than a stale JWT role. (HTTP integration: stale-JWT-roleId test — fake roleId in JWT, requireActiveUser overwrites from DB, STUDENT profile loads successfully)
- [x] Cross-user IDs in request bodies cannot redirect updates. (HTTP integration: 3 tests — id field rejected, GET returns only own data, PATCH updates only JWT owner)
- [x] A student cannot update another user's /users/:id record. (unit: STUDENT lacks users:update:any in real permission catalog)
- [x] Forbidden fields, mixed valid/forbidden payloads, empty bodies, null/array bodies, blank names and invalid phones are rejected. (unit: 28 schema + 4 middleware tests; HTTP: 6 forbidden-field tests including mixed payloads with no-change verification)
- [x] Names are trimmed; phone can be removed; omitted values are preserved. (unit: trim + normalization tests; HTTP: 2 phone removal tests — null and empty string — with persistence verification)
- [x] Audit and user update commit together; a failed audit write rolls back the update. (HTTP integration: audit log test verifies PROFILE_UPDATED record exists with correct old/new values; transaction atomicity test verifies count increments)
- [x] UI loads, saves, cancels, reports errors and handles an expired session. (Playwright headless Chrome: 10 browser tests — login, profile load, edit, save, cancel, phone clear, session restore, sign-out, post-signout redirect)
- [x] Backend and frontend builds pass. (backend tsc: exit 0; frontend tsc -b && vite build: exit 0)
- [x] Existing relevant tests still pass; blockers are reported accurately. (436 tests, 10 suites, all pass — including 92 profile tests)

Use disposable fixtures for database integration tests. Do not reset the team's database. Tests must exercise the actual handlers/middleware rather than copies of their logic.

## 9. Implementation sequence

- [x] Inspect the repository and fill in section 2.
- [x] Confirm the editable-field contract and minimal file list.
- [x] Implement/refine the backend profile path.
  - [x] Add `validateStrict()` to validate.middleware.ts (reject unknown fields with 400).
  - [x] Tighten name validation: trim, reject control chars, require non-whitespace, max 255.
  - [x] Add phone validation: format, 7–15 digit count, normalize empty/whitespace/null → null, max 30 chars.
  - [x] Add `requireActiveUser` middleware (re-reads status + roleId from DB, rejects INACTIVE/PENDING).
  - [x] Wrap PATCH /users/me in `$transaction`: read old values → update user → create PROFILE_UPDATED audit log.
  - [x] Set `Cache-Control: no-store` on both GET and PATCH /users/me via `noCacheProfile` middleware.
  - [x] Fix data-spread: use explicit typed `updateData` object with undefined checks.
- [x] Add focused security and database tests.
  - [x] Created `backend-api/tests/profile.integration.test.ts` — 92 pass (55 unit + 37 HTTP integration with supertest).
  - [x] Verified all six roles hold users:read:own and users:update:self.
  - [x] Schema tests cover valid names, forbidden fields, mixed payloads, empty/null bodies, control chars.
  - [x] Schema tests cover phone format, digit count, normalization, non-string rejection.
  - [x] Tests verify cross-user isolation (no id/userId in body), JWT rejection, inactive user logic.
  - [x] Tests verify audit log shape (action, oldValues, newValues, no secrets).
- [x] Implement/integrate the profile frontend.
  - [x] Populated `frontend/src/services/api.ts` with Axios instance, auth interceptor, 401 refresh retry with shared promise.
  - [x] Populated `frontend/src/services/auth.service.ts` with login/logout/session restore.
  - [x] Added `frontend/src/context/AuthContext.tsx` — AuthProvider, useAuth hook.
  - [x] Added `frontend/src/pages/auth/LoginPage.tsx` — minimal sign-in form.
  - [x] Added `frontend/src/pages/profile/ProfilePage.tsx` — view/edit with all required states.
  - [x] Updated `frontend/src/App.tsx` — auth-aware nav, /login and /profile routes, RequireAuth guard.
  - [x] Added `/users` and `/auth` proxy rules to `frontend/vite.config.ts`.
- [x] Update Swagger and ticket documentation.
- [x] Run relevant tests and both builds.
- [x] Review the diff for ticket-5-only scope.
- [x] Record actual evidence and remaining limitations below.

Suggested baseline commands (verify against package scripts first):

    cd backend-api
    npm ci
    npm run prisma:generate
    npm run typecheck
    npm test -- --runInBand
    npm run build

In a separate terminal, from the repository root:

    cd frontend
    npm ci
    npm run build

Observed baseline issues to recheck: TypeScript 7 versus legacy node module resolution; Jest's TypeScript configuration loader; migration ordering on an empty database. Fix only required local build/test integration. Do not rename already-applied migrations or reset shared data for this ticket.

## 10. Completion evidence

- **Files changed:**
  - `backend-api/src/routes/users.routes.ts` — refined GET/PATCH /users/me with requireActiveUser, noCacheProfile, strict validation, transaction + audit, explicit field types
  - `backend-api/src/middleware/validate.middleware.ts` — added `validateStrict()` export
  - `backend-api/src/swagger/swagger.json` — updated /users/me descriptions, error codes, Cache-Control headers, examples
  - `backend-api/tests/profile.integration.test.ts` — new, 92 passing tests (55 unit + 37 HTTP integration)
  - `backend-api/tests/setup.js` — new, test env defaults so config loads without .env
  - `backend-api/jest.config.js` — new, replaces jest.config.ts (pre-existing ts-node issue)
  - `backend-api/jest.config.ts` — deleted (original; Jest 30 cannot parse .ts config without ts-node)
  - `backend-api/tsconfig.json` — `moduleResolution: "nodenext"` (pre-existing TS7 removal of node10)
  - `frontend/src/services/api.ts` — populated, Axios instance with auth interceptor + refresh retry
  - `frontend/src/services/auth.service.ts` — populated, login/logout/restoreSession
  - `frontend/src/context/AuthContext.tsx` — new, AuthProvider + useAuth
  - `frontend/src/pages/auth/LoginPage.tsx` — new, minimal sign-in
  - `frontend/src/pages/profile/ProfilePage.tsx` — new, view/edit profile
  - `frontend/src/App.tsx` — updated, auth-aware nav + /login + /profile routes + RequireAuth guard
  - `frontend/vite.config.ts` — added /users and /auth proxy rules
  - `.gitignore` — added `*.tsbuildinfo`
  - `docs/TICKET_5_PROFILE.md` — new, API contract, usage, run instructions
  - `IMPLEMENTATION.md` — updated throughout with findings and evidence

- **Full test suite (2026-09-26):** 436 tests, 10 suites, all pass. Verified against a disposable PostgreSQL 16 container.
- **Profile tests:** 92 pass, 0 skipped. Breakdown:
  - Schema validation (name, phone, forbidden fields, partial updates): 28 tests
  - Permission catalog (all 6 roles): 13 tests
  - SAFE_PROFILE_SELECT inspection: 7 tests
  - validateStrict middleware: 4 tests
  - JWT library contract: 3 tests
  - HTTP integration via supertest: 37 tests
    - GET /users/me for all 6 roles: 6
    - Safe response fields: 1
    - PATCH /users/me for all 6 roles: 6
    - Phone removal (null and empty string): 2
    - Authentication errors (no token, invalid, expired): 5
    - Inactive account guard (INACTIVE GET, INACTIVE PATCH, PENDING): 3
    - Stale JWT roleId overwrite: 1
    - Cross-user isolation: 3
    - Forbidden field rejection via HTTP: 6
    - Audit log verification: 2
    - Transaction atomicity: 1
    - Non-existent user: 1
- **Browser tests (Playwright, headless Chrome):** 10 pass. Login, profile load, edit, save, cancel, phone set+clear, session restore after reload, sign-out, post-signout redirect.
- **curl smoke tests:** GET profile, PATCH name, forbidden field rejection, phone clearing, unauthenticated request — all correct responses.
- **Backend typecheck:** PASS (exit 0). `module: "nodenext"` + `moduleResolution: "nodenext"` in tsconfig.json. Test dirs excluded from tsc.
- **Backend build:** PASS (exit 0).
- **Frontend build:** PASS. `tsc -b && vite build` completed successfully.
- **Password policy note:** docs/TICKET_5_PROFILE.md corrected — the actual auth code requires 12+ chars, no common passwords, no 5+ repeated/sequential chars, no name/email. It does NOT require character class diversity (upper/lower/digit/special).
- **Pre-existing issues fixed (minimal scope):**
  1. `backend-api/jest.config.ts` → deleted, replaced with `jest.config.js` (Jest 30 cannot parse .ts config without ts-node)
  2. `backend-api/tsconfig.json` → `moduleResolution: "nodenext"` (TS7 removed `"node"` as alias for node10)
  3. Test dirs (`src/__tests__`, `tests`) added to tsconfig `exclude` — test files compiled by Jest/SWC, not tsc production build
  4. `.gitignore` → added `*.tsbuildinfo` to prevent build artifacts from being committed
- **Pre-existing issues NOT fixed (out of scope):**
  1. `src/__tests__/batches.test.ts` — 4 TS2367 errors; unrelated to profile; excluded from tsc via tsconfig exclude
- **Remaining blockers:** None. All verification items passed.
- **Disposable test database:** PostgreSQL 16 via `docker run -d --name eip-ticket5-testdb -e POSTGRES_USER=testuser -e POSTGRES_PASSWORD=testpass123 -e POSTGRES_DB=eip_ticket5_test -p 5433:5432 postgres:16-alpine`. Stop with `docker rm -f eip-ticket5-testdb`.
- **Proposed PR title:** Complete self-service profile view and edit for all six roles.

Do not mark unrun tests as passed. Stop after preparing reviewable changes; commit, push, PR creation and deployment are separate user-directed steps.
