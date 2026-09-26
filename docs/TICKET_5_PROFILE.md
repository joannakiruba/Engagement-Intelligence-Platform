# Ticket 5 — Self-Service Profile View & Edit

## Overview

All six roles (STUDENT, TRAINER, FACULTY, MENTOR, COORDINATOR, ADMIN) can view their own profile and edit permitted fields via a self-service screen. Identity is resolved from the JWT subject — there is no way to read or modify another user's profile through this endpoint.

## API Endpoints

### GET /users/me

Returns the authenticated user's profile.

**Headers:** `Authorization: Bearer <access-token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Ayesha Siddiqa",
    "email": "ayesha@example.com",
    "phone": "+91 98765 43210",
    "department": "Computer Science",
    "year": 3,
    "status": "ACTIVE",
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-09-26T14:30:00.000Z",
    "role": { "id": "uuid", "name": "STUDENT" }
  }
}
```

**Security:**
- Requires valid JWT and `users:read:own` permission (all roles have it)
- Account status and role are re-read from the database — deactivated accounts are rejected even with a valid JWT
- Response includes `Cache-Control: no-store`
- Never returns passwordHash, tokens or other sensitive fields

### PATCH /users/me

Updates permitted self-service fields.

**Headers:** `Authorization: Bearer <access-token>`, `Content-Type: application/json`

**Editable fields:**

| Field | Rules |
|-------|-------|
| name  | Trimmed, 1–255 chars, no control characters |
| phone | Optional leading +, digits/spaces/parens/hyphens, 7–15 digits, max 30 chars. `null` or `""` clears the field |

**Example request:**
```json
{ "name": "Ayesha Siddiqa", "phone": "+91 98765 43210" }
```

**Example — clear phone:**
```json
{ "phone": null }
```

**Rejected — forbidden field:**
```json
{ "name": "Ayesha", "roleId": "another-role-id" }
// → 400: unknown field "roleId" is not allowed
```

**Security:**
- Strict validation: any field other than `name` or `phone` returns 400 (not silently stripped)
- Identity comes from JWT subject — no `userId` or `id` parameter
- Update and `PROFILE_UPDATED` audit record committed in one transaction
- Requires valid JWT and `users:update:self` permission

## Non-Editable Fields

Email, role, department, year and status are displayed but cannot be changed through this endpoint. Users should contact an administrator to correct these fields.

## Frontend

### Login
- Navigate to `/login` to sign in
- Uses existing `/auth/login` backend endpoint
- On success, redirects to `/profile`

### Profile Page
- Navigate to `/profile` or click "My Profile" in the navigation bar
- Shows all safe profile fields in read-only view
- Click "Edit profile" to modify name and phone
- "Save" sends only changed fields; "Cancel" restores last saved values
- Save button is disabled when there are no changes or the name is empty
- Success and error messages are shown inline
- Session expiry is handled with a sign-in prompt

### Session Management
- Access token stored in memory only (not localStorage)
- Refresh token in httpOnly cookie, handled automatically
- On page reload, session is restored via `/auth/refresh` + `GET /users/me`
- Concurrent refresh requests are coalesced to avoid race conditions

## Running Locally

### Prerequisites

A PostgreSQL database and Node.js 20+.

### Backend
```bash
cd backend-api
npm ci

# If you don't already have a .env, copy the example (located at backend-api/.env.example):
cp .env.example .env
# Then edit .env: set DATABASE_URL, JWT_SECRET and TOKEN_HASH_SECRET.
# SEED_TEST_PASSWORD must be at least 12 characters (the seed script enforces
# this minimum). The login-time password policy also rejects common passwords,
# 5+ repeated/sequential characters, and passwords containing the user's
# name or email. See .env.example for the variable name and format.

npx prisma generate

# On a fresh/local database only — do NOT run against a shared/production database:
npx prisma migrate deploy   # applies existing migrations without interactive prompts
npm run seed                 # creates roles, permissions and test users

npm run dev                  # starts on port 3000
```

**Known issue on a fresh database:** If migrations were merged out of chronological order
(e.g. assessment migrations reference the `User` table before it exists), `migrate deploy`
may fail. In that case, run `npx prisma migrate deploy` again after verifying the migration
files. Do not use `migrate reset` or `migrate dev --create-only` against a shared database.

### Frontend
```bash
cd frontend
npm ci
npm run dev                  # starts on port 5173, proxies /users and /auth to backend
```

### Running Tests
```bash
cd backend-api

# Unit/schema tests (no database required):
npm test -- --runInBand

# To run integration tests against a real DB, set DATABASE_URL in your
# shell to point at an isolated test database (not the shared dev DB).
# Tests that require a database are automatically skipped when DATABASE_URL
# contains 'test_skip', 'skip' or 'placeholder'.
```

## Test Results (2026-09-26)

Verified against a disposable PostgreSQL 16 container (`docker run ... postgres:16-alpine`).
Schema pushed with `prisma db push`, seeded with all six roles. Full suite: 436 tests, 10 suites, all pass.

### Profile test breakdown (92 tests, all pass)

| Suite | Tests | Status |
|-------|-------|--------|
| Schema: name validation | 7 | PASS |
| Schema: phone validation | 12 | PASS |
| Schema: forbidden/unknown fields | 5 | PASS |
| Schema: partial updates | 4 | PASS |
| Permission catalog: all six roles | 13 | PASS |
| SAFE_PROFILE_SELECT inspection | 7 | PASS |
| validateStrict middleware | 4 | PASS |
| JWT library contract | 3 | PASS |
| HTTP integration: GET all 6 roles | 6 | PASS |
| HTTP integration: safe response fields | 1 | PASS |
| HTTP integration: PATCH all 6 roles | 6 | PASS |
| HTTP integration: phone removal | 2 | PASS |
| HTTP integration: auth errors | 5 | PASS |
| HTTP integration: inactive account guard | 3 | PASS |
| HTTP integration: stale JWT roleId | 1 | PASS |
| HTTP integration: cross-user isolation | 3 | PASS |
| HTTP integration: forbidden field rejection | 6 | PASS |
| HTTP integration: audit log | 2 | PASS |
| HTTP integration: transaction atomicity | 1 | PASS |
| HTTP integration: non-existent user | 1 | PASS |
| **Total** | **92** | **92 pass, 0 skip** |

All tests import and exercise the actual exported code (`profileUpdateSchema`,
`SAFE_PROFILE_SELECT`, `validateStrict`, `ROLE_PERMISSIONS`) and the real Express
app with supertest — no tautological assertions or duplicated logic.

### Browser verification (Playwright, headless Chrome, 10 tests, all pass)

| Test | Status |
|------|--------|
| Unauthenticated /profile redirects to /login | PASS |
| Login as student | PASS |
| Profile page shows user data | PASS |
| Edit mode activates | PASS |
| Save name change | PASS |
| Cancel restores original value | PASS |
| Phone set and cleared | PASS |
| Session restoration after page reload | PASS |
| Sign out | PASS |
| Profile blocked after sign-out | PASS |

## Verification Status

| Check | Status |
|-------|--------|
| Backend typecheck (`tsc --noEmit`) | PASS (exit 0) |
| Backend build (`tsc`) | PASS (exit 0) |
| Frontend build (`tsc -b && vite build`) | PASS |
| Unit/schema tests (55) | PASS |
| HTTP integration tests (37, supertest + DB) | PASS |
| Full backend suite (436 tests, 10 suites) | PASS |
| Browser tests (10, Playwright headless) | PASS |
| curl smoke tests (GET, PATCH, forbidden, clear, unauth) | PASS |

## Limitations

- Phone validation is format-only; no ownership verification (OTP/SMS)
- The minimal login page is functional but not styled for production
- Integration tests that require a database connection are skipped when `DATABASE_URL` contains 'test_skip', 'skip', or 'placeholder'
- Email/role/department changes require separate administrative endpoints (out of scope for this ticket)
