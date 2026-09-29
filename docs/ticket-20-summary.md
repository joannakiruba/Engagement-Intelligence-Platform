# Ticket 20 — Proof Submission Module

## High-Level Overview

This ticket implements the Proof Submission Module for the Engagement Intelligence Platform. The module allows students to upload screenshots or certificates as evidence of completing event rounds, and gives administrators and trainers the ability to review, approve, or reject those submissions. Files are stored in a centralized, admin-owned Google Drive folder via the Drive API v3. The implementation was built entirely within existing files to prevent merge conflicts with other in-progress work.

The feature is role-aware:
- **Students** see a personalized view with an event selector, file upload form, their existing submissions with status badges, and a "Replace File" workflow.
- **Trainers / Coordinators / Admins** see a filterable table of all submissions with inline Approve / Reject controls and an optional remarks field.

A strict one-file-per-event constraint is enforced at the application layer: students cannot upload a second file for the same event — they must use the explicit replacement endpoint, which also resets the review status to `PENDING`.

---

## Modified Files

### Backend (`backend-api/`)

- **`src/config/index.ts`** — Added `googleDrive` configuration block (`clientEmail`, `privateKey`, `folderId`) sourced from environment variables.
- **`.env.example`** — Added three new env var placeholders for Google Drive credentials.
- **`src/services/s3.service.ts`** _(was empty)_ — Implemented Google Drive API v3 integration: `uploadFileToDrive`, `replaceFileOnDrive`, `deleteFileFromDrive`. Uses service-account JWT auth with token caching.
- **`src/routes/events.routes.ts`** _(was empty)_ — Implemented Event CRUD endpoints: `GET /`, `GET /:id`, `POST /`, `PUT /:id` with appropriate RBAC permission guards.
- **`src/routes/proofs.routes.ts`** _(was empty)_ — Implemented the full Proof Submission API: submit, replace, list own, list all, get detail, and review (approve/reject). Includes multer file upload middleware with type and size validation.
- **`src/server.ts`** — Added import and route registration for `proofRoutes` (`/api/proofs`) and `eventRoutes` (`/api/events`), both behind `authenticateJwt`.

### Frontend (`frontend/`)

- **`src/services/dashboard.service.ts`** _(was empty)_ — Added typed API service functions for events (`getEvents`, `getEvent`) and proofs (`getMyProofs`, `getAllProofs`, `submitProof`, `replaceProofFile`, `reviewProof`) along with TypeScript interfaces (`EventItem`, `ProofSubmission`).
- **`src/App.tsx`** — Added `Proofs` navigation link, a `StatusBadge` component, the role-aware `ProofsPage` component (student upload/replace view + admin review table), and the `/proofs` route wrapped in `RequireAuth`.

---

## Logic Breakdown

### Google Drive API Replacement Logic (`s3.service.ts`)

The service communicates directly with Google Drive API v3 REST endpoints using `axios` and `jsonwebtoken` (both already project dependencies — no new packages required).

1. **Authentication**: A Google Cloud service-account JWT is created using the `jsonwebtoken` library, signed with the RS256 algorithm, and exchanged for a short-lived access token at `https://oauth2.googleapis.com/token`. Tokens are cached in-memory and automatically refreshed 60 seconds before expiry.
2. **Upload**: `uploadFileToDrive` sends a multipart/related request (JSON metadata + binary file) to the Drive upload endpoint. After creation, it sets a public "anyone with the link can view" permission so reviewers and the student can access the file via URL.
3. **Replace**: `replaceFileOnDrive` extracts the existing Drive file ID from the stored `fileUrl` using a regex (`/d/{fileId}/view`), then sends a `PATCH` multipart request to update the file content in place. The URL stays the same, and the file revision is simply overwritten. If the file ID can't be extracted (edge case), it falls back to a fresh upload.
4. **Delete**: `deleteFileFromDrive` extracts the ID and calls `DELETE`. Failures are logged as warnings but do not throw, so a failed cleanup never blocks the caller.

### One-File-Per-Event Enforcement

The `ProofSubmission` Prisma model does not have a `@@unique([eventId, studentId])` database constraint. Rather than adding a migration (which would require a new file), uniqueness is enforced at the application layer:

- `POST /api/proofs` checks `prisma.proofSubmission.findFirst({ where: { eventId, studentId } })` before insert. If a record exists, the endpoint returns `409 Conflict` with a message directing the student to the replacement endpoint.
- `PUT /api/proofs/:id/file` replaces the file on the existing record, resets `status` to `PENDING`, and clears any prior admin `remarks`.

### Metadata Tracking

Each `ProofSubmission` row stores:
| Field | Purpose |
|---|---|
| `studentId` | Which student submitted |
| `eventId` | Which event round the proof is for |
| `fileName` | Original uploaded file name (acts as proof type signal: `.pdf` = certificate, `.png/.jpg` = screenshot) |
| `fileUrl` | Google Drive view link |
| `status` | Review state: `PENDING`, `APPROVED`, or `REJECTED` |
| `remarks` | Admin reviewer notes (set during approve/reject, cleared on re-upload) |
| `createdAt` | Submission timestamp |

No changes were made to the Prisma schema — the existing `ProofSubmission`, `Event`, `EventRegistration`, and `ProofStatus` models already contained all necessary fields and enums.

### Permission Model

All proof permissions were already defined in `permission-catalog.ts` and assigned to the correct roles:

| Permission Code | Roles |
|---|---|
| `proofs:submit:self` | STUDENT |
| `proofs:read:own` | STUDENT |
| `proofs:read:batch` | TRAINER |
| `proofs:read:any` | COORDINATOR, ADMIN |
| `proofs:approve:batch` | TRAINER |
| `proofs:approve:any` | COORDINATOR, ADMIN |

### Frontend UI Patterns

The `ProofsPage` component renders one of two views based on `user.role`:

- **Student**: A "Submit New Proof" card (only shows events without an existing submission) with an event dropdown and file input, followed by a card-list of existing submissions. Each card shows the event name, status badge (yellow/green/red), linked file name, submission date, reviewer remarks (if any), and a "Replace File" action that expands into an inline upload form.
- **Admin/Trainer**: A filter bar (status dropdown + event dropdown + Apply button) above a data table with columns for Student, Event, File, Submitted, Status, and Actions. The Actions column has a "Review" button that expands into a remarks input and Approve / Reject buttons.

All UI elements use the exact same Tailwind CSS classes as existing pages (`bg-white border rounded`, `bg-gray-50` table headers, `bg-blue-600 text-white` buttons, status badge colors matching the `ratingBadge` pattern in `FeedbackList.tsx`).

---

## New Requirements

### Environment Variables

Add the following to your `.env` file (templates already added to `.env.example`):

```env
# Google Drive (Proof Submissions)
GOOGLE_DRIVE_CLIENT_EMAIL="your-service-account@project.iam.gserviceaccount.com"
GOOGLE_DRIVE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_FOLDER_ID="your-shared-drive-folder-id"
```

**How to obtain these:**
1. In Google Cloud Console, create a Service Account under your project.
2. Generate a JSON key for that service account — `client_email` maps to `GOOGLE_DRIVE_CLIENT_EMAIL`, and `private_key` maps to `GOOGLE_DRIVE_PRIVATE_KEY`.
3. In Google Drive, create a folder that will store all proof uploads. Share that folder with the service account email (grant Editor access). Copy the folder ID from the URL — that is `GOOGLE_DRIVE_FOLDER_ID`.

### Dependencies

**No new npm packages are required.** The Google Drive integration uses only:
- `jsonwebtoken` (already installed) — for signing the service-account JWT
- `axios` (already installed) — for calling the Drive REST API
- `multer` (already installed) — for handling file uploads

### Database Migrations

**No new migrations required.** The Prisma schema already contained all necessary models (`ProofSubmission`, `Event`, `EventRegistration`) and the `ProofStatus` enum (`PENDING`, `APPROVED`, `REJECTED`).

---

## API Endpoints Summary

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/events` | JWT | List all events |
| `GET` | `/api/events/:id` | JWT | Get event detail with registrations and proofs |
| `POST` | `/api/events` | JWT + `events:create` | Create a new event |
| `PUT` | `/api/events/:id` | JWT + `events:update:any` | Update an event |
| `POST` | `/api/proofs` | JWT + `proofs:submit:self` | Submit proof (multipart file upload) |
| `PUT` | `/api/proofs/:id/file` | JWT + `proofs:submit:self` | Replace file on existing submission |
| `GET` | `/api/proofs/my` | JWT + `proofs:read:own` | Get own proof submissions |
| `GET` | `/api/proofs` | JWT + `proofs:read:*` | List all proofs (with `?status=&eventId=&studentId=` filters) |
| `GET` | `/api/proofs/:id` | JWT + `proofs:read:*` | Get single proof detail |
| `PATCH` | `/api/proofs/:id/review` | JWT + `proofs:approve:*` | Approve or reject a submission |

### File Upload Constraints
- **Max size**: 10 MB
- **Allowed types**: `image/png`, `image/jpeg`, `image/gif`, `application/pdf`
- **Limit**: One file per student per event (enforced at application layer)
