# Ticket 7 — Attendance Module Summary

**Module:** 5 — Attendance Module  
**Branch:** `ticket-7-attendance`  
**Owners:** Sree Harini + Harinee S  
**Date Started:** 2026-09-24  
**Last Updated:** 2026-09-25  

---

## Overview

Server-time-locked attendance system with configurable attendance windows per session, time-rotating QR code scan (60s TOTP), Redis-cached tokens, and Excel/CSV export. Trainers manage sessions and override attendance; students scan QR codes from their phone cameras.

**Dependencies:** Module 1 (DB Schema), Module 2 (Auth & RBAC), Module 4 (Batch & Session Mgmt)

---

## Module Explanation — Step by Step

### 1. Foundation: Database Layer (Prisma + PostgreSQL)

**Tool:** Prisma ORM with PostgreSQL

The database is the foundation. We use Prisma to define our data models in `schema.prisma`, and Prisma generates TypeScript types and a query client automatically.

**Key models for attendance:**

```
AttendanceWindow → One session can have multiple attendance windows
                   (e.g., "Morning" 7:50-8:05 AM, "Afternoon" 1:00-1:15 PM)
                   Each window is a separate attendance sheet.

Attendance → Links a student to a window with a status (P/A/L/E).
             Has @@unique([windowId, studentId]) — one record per student per window.

Session → A class session (e.g., "Python Day 3").
          Has batch, trainer, scheduled date, time.
          Has many AttendanceWindows.

BatchMember → Which students belong to which batch.
```

**Why AttendanceWindow?** A single session (e.g., a full-day workshop) might need attendance taken twice — once in the morning and once after lunch. Instead of creating two sessions, we create two windows under the same session. Each window generates its own QR code and has its own attendance sheet.

**Why @@unique([windowId, studentId])?** Prevents duplicate records. One student can only have one attendance status per window. If they scan twice, the second scan just confirms they're already marked.

**Statuses:**
- `PRESENT` — student scanned within the window, or trainer marked present
- `ABSENT` — default status when a window is created; student didn't check in
- `LATE` — student arrived after cutoff but trainer marked them as late (still counts as attended for %)
- `EXCUSED` — medical leave, hackathon, internship. Trainer marks with a remark. Counts as absent for % calculation.

**Attendance rate formula:** `(PRESENT + LATE) / total * 100`  
LATE counts as attended. EXCUSED counts as absent. This feeds into the ML risk/dropout prediction in other tickets.

---

### 2. Backend: Node.js + Express + TypeScript

**Tools:** Express v5, TypeScript 7, Joi validation, sendSuccess/sendError response helpers

The backend follows a strict layered pattern: **Validators → Services → Controllers → Routes**

#### Layer 1: Validators (`attendance.validator.ts`)
Joi schemas that validate incoming request data before it reaches business logic. Every `POST` and `PUT` request passes through validation middleware first.

```
checkInSchema       → validates windowId (UUID), optional qrToken
markAttendanceSchema → validates windowId, studentId, status, optional remarks
bulkMarkSchema      → validates windowId + array of {studentId, status, remarks}
updateSchema        → validates optional status + remarks (for trainer override)
createWindowSchema  → validates sessionId, label, startTime, endTime
```

**Why Joi?** The team standardized from Zod to Joi in an earlier ticket. Joi gives detailed error messages and supports `.messages()` for custom error text.

#### Layer 2: Services (`attendance.service.ts`)
Pure business logic — no HTTP concepts (no req/res). This is where all the rules live:

**QR Token Generation (TOTP-style):**
1. Each window gets a secret derived from `HMAC-SHA256(QR_SECRET env var, windowId)`
2. A token is generated: `HMAC-SHA256(secret, floor(timestamp / 60))` → first 8 hex chars
3. Token rotates every **60 seconds**
4. Validation accepts current window + previous window (grace period for slow scans)
5. Token is cached in **Redis** with TTL matching the remaining seconds

**Why TOTP?** Prevents QR sharing. If a student screenshots the QR and sends it to a friend, by the time the friend scans it, the token has rotated and is invalid.

**Student Check-in Flow:**
1. Validate the attendance window exists
2. Check student is a member of the batch
3. Validate QR token (if provided)
4. Check if current time is within the window's start/end time
5. If already marked PRESENT → return 409 (already checked in)
6. If already has a record (e.g., ABSENT default) → update to PRESENT
7. If no record → create new PRESENT record
8. Cache the check-in in Redis for live count

**Trainer Operations:**
- `markAttendance()` — upsert single student (trainer can mark any status, any time)
- `bulkMarkAttendance()` — upsert batch of students (per-student error handling, partial failures don't block others)
- `updateAttendance()` — override existing record (e.g., change LATE → PRESENT with remark "Bus delay")
- `createAttendanceWindow()` — creates a window AND defaults all batch students to ABSENT

**Why upsert?** When the trainer marks attendance, a student might already have a record (from QR scan or default ABSENT). Upsert means "update if exists, create if not" — handles both cases cleanly.

**Exports:**
- CSV export: per-session, single-letter codes (P/A/L/E)
- Excel export: per-batch, all windows across sessions, includes student details + attendance % per student

#### Layer 3: Controllers (`attendance.controller.ts`)
Thin layer that extracts data from HTTP requests and calls services. Uses `sendSuccess(res, data, statusCode)` and `sendError(res, message, code)` for consistent API responses. Wraps `req.params` values with `String()` because Express v5 returns `string | string[]`.

#### Layer 4: Routes (`attendance.routes.ts`)
Maps HTTP endpoints to controller handlers. Applies validation middleware.

**Redis Usage:**
- **QR token cache:** `SET qr:{windowId} {token} EX {ttl}` — caches the current QR token
- **Check-in set:** `SADD checkins:{windowId} {studentId}` — tracks who has checked in (for live count on QR screen)
- **Live count:** `SCARD checkins:{windowId}` — returns count for the QR fullscreen display
- **Window metadata cache:** `SET window:{windowId} {json} EX 86400` — caches window start/end times and batchId
- **Batch membership cache:** `SADD batch:{batchId}:members {studentIds}` — caches which students are in a batch
- All Redis operations have try/catch — if Redis is down, the system still works (falls through to DB)

**Thundering Herd Protection:**

When 100+ students scan the QR code simultaneously, the naive approach would be 4 DB queries per student = 400+ concurrent DB queries. We solve this with a **multi-gate Redis-first pipeline:**

```
Student scans QR
    │
    ▼
Gate 1: SISMEMBER checkins:{windowId} {studentId}
        → Already in Redis set? Return 409 immediately. (0 DB queries)
    │
    ▼
Gate 2: Validate QR token
        → Pure CPU (HMAC-SHA256). No DB needed.
    │
    ▼
Gate 3: GET window:{windowId} from Redis
        → Cached? Check time window. Expired? Return 403. (0 DB queries)
        → Not cached? Fall through to DB, then cache for next student.
    │
    ▼
Gate 4: SISMEMBER batch:{batchId}:members {studentId}
        → Cached? Check membership. Not a member? Return 403. (0 DB queries)
        → Not cached? Fall through to DB, then cache.
    │
    ▼
Gate 5: DB write (only reached for first-time check-ins)
        → findUnique + update/create (2 DB queries max)
```

**Result:** The first student's check-in does the full DB lookup and caches everything. Every subsequent student hits Redis gates — most requests never touch the database at all. Duplicate scans are rejected at Gate 1 with zero DB cost. The DB only handles actual state-changing writes.

---

### 3. Frontend: React + TypeScript + Tailwind + Vite

**Tools:** React 19, React Router v7, Tailwind CSS v4, Vite 8, Axios, qrcode.react

The frontend has 6 attendance pages, all matching the existing project's styling (white cards, bg-gray-50 headers, blue primary buttons, text-sm tables).

#### Page 1: Mark Attendance (`MarkAttendance.tsx`)
**Route:** `/attendance/mark/:sessionId`  
**Used by:** Trainer  
**What it does:**
- Loads the session's attendance windows
- Shows a dropdown if multiple windows exist (Morning/Afternoon)
- Displays a table of all students, defaulting to ABSENT
- Trainer toggles each student's status via dropdown (Present/Absent/Late/Excused)
- "Mark All Present" / "Mark All Absent" quick buttons
- Unsaved changes highlighted in yellow
- "Save Attendance" button sends only changed rows via `POST /bulk`
- Summary bar shows live counts
- Link to "Show QR" opens the fullscreen QR page

#### Page 2: Session Attendance (`SessionAttendance.tsx`)
**Route:** `/attendance/session/:sessionId`  
**Used by:** Trainer  
**What it does:**
- Shows session title, date, day of week, and session ID
- Lists all attendance windows with links to their QR pages
- Summary cards: Total, Present, Absent, Late, Excused, Rate %
- Status filter buttons: All, P, A, L, E
- Full student table with single-letter status badges, department, year, check-in time, remarks
- CSV export button

#### Page 3: Student Attendance (`StudentAttendance.tsx`)
**Route:** `/attendance/student/:studentId`  
**Used by:** Student (viewing own) or Trainer (viewing a student's)  
**What it does:**
- Student header: name, email, department, year
- Large attendance rate card with color coding (green ≥75%, yellow ≥50%, red <50%)
- Summary: total, present, late, absent, excused counts
- Filters: batch ID, date range
- Session history table: date, day, session title, window label, batch, status, check-in time

#### Page 4: QR Fullscreen (`QRFullscreen.tsx`)
**Route:** `/attendance/qr/:windowId`  
**Used by:** Trainer (projects on classroom screen)  
**What it does:**
- Dark background, large QR code (400x400px) in white card
- QR encodes a URL: `{origin}/attendance/check-in?windowId=X&token=Y`
- Students scan with their phone's camera → opens the URL in browser
- Live count of checked-in students (from Redis)
- Countdown timer showing seconds until next QR refresh
- Auto-refreshes every 60 seconds (new token, new QR)
- Shows "Window Open" (green) or "Window Closed" (red) status
- Uses `qrcode.react` library for SVG QR rendering

#### Page 5: Student Check-In (`StudentCheckIn.tsx`)
**Route:** `/attendance/check-in?windowId=X&token=Y`  
**Used by:** Student (via QR scan on phone)  
**What it does:**
- Reads windowId and token from URL parameters
- Auto-submits check-in on page load (no extra taps needed)
- Shows one of three states:
  - **Success:** green checkmark, "Attendance Marked!"
  - **Already Checked In:** blue info icon, "You have already checked in"
  - **Error:** red X, specific message (window closed, not in batch, invalid QR, etc.)
- Student must be logged into their browser for auth to work
- No camera scanner needed — phone camera handles QR → URL natively

#### Page 6: Attendance Report (`AttendanceReport.tsx`)
**Route:** `/attendance/report/:batchId`  
**Used by:** Trainer  
**What it does:**
- Batch overview: total sessions, total students, overall attendance rate
- Filters: date range, department, year, "below 75%" filter
- Per-student table: name, email, department, year, P/L/A/E counts
- Color-coded attendance (green ≥75%, yellow ≥50%, red <50%)
- "Download Excel" button → `.xlsx` file with all sessions/windows, single-letter codes, and **attendance % per student** (% only in Excel, not on screen)

---

### 4. How Each Role Uses the Module

#### Trainer Flow:
1. Go to **Batches → select batch → Sessions**
2. Create a session (title, topic, date, time)
3. Create an attendance window (label: "Morning", start: 7:50 AM, end: 8:05 AM)
4. When class starts, click **"Mark Attendance"** on the session → opens MarkAttendance page
5. Click **"Show QR"** → fullscreen QR appears, project on classroom screen
6. Watch the live count go up as students scan
7. After the window closes, go to MarkAttendance and fix any issues:
   - Student who came late but had valid reason → change LATE → PRESENT, add remark
   - Student on medical leave → change ABSENT → EXCUSED, add remark "Medical leave"
8. Click **"Save Attendance"**
9. View report: **Session Attendance** page for single session, **Attendance Report** for batch-wide stats
10. Export to Excel for records

#### Student Flow:
1. Trainer projects QR code on screen
2. Student opens phone camera, points at QR
3. Phone detects the URL → opens it in browser
4. Browser is already logged in → auto-submits check-in
5. Student sees "Attendance Marked!" confirmation
6. If they scan again, they see "Already Checked In"
7. If window is closed (past 8:05 AM), they see error: "Contact your trainer for manual entry"
8. Student can view their own attendance history at `/attendance/student/:id`

---

## Detailed Changelog (Chronological)

### Phase 1: Branch Setup & Initial Merge

**Problem:** The `ticket-7-attendance` branch was created early and was **4 commits behind main**. All skeleton files were empty because the branch was created before the assessment module and schema were merged.

**Resolution:** Ran `git merge main` to bring in Prisma schema, assessment module, shared utilities, and test infrastructure.

---

### Phase 2: Initial Backend Implementation

Built validators → services → controllers → routes following the assessment module pattern.

**Issues resolved:**
- Zod → Joi migration (team standardized validation)
- `success()` → `sendSuccess()` / `error()` → `sendError()` rename
- Express v5 `req.params` type change (wrapped with `String()`)
- Quote style: double → single quotes
- TypeScript 7 `moduleResolution` deprecation fix

---

### Phase 3: Unit Tests

35/35 tests passing for validators + QR token generation + cutoff logic.

---

### Phase 4: Initial Frontend

Built MarkAttendance, SessionAttendance, API client, and App.tsx routes.

---

### Phase 5: AttendanceWindow Refactor + New Features

**Major changes:**
1. **Added `AttendanceWindow` model** to Prisma schema — each session can have multiple attendance windows (morning, afternoon). Attendance records link to windows instead of sessions directly.
2. **QR rotation changed from 30s to 60s** — more practical for classroom scanning.
3. **Redis integration** — `ioredis` for QR token caching and live check-in count tracking.
4. **Configurable attendance window** — replaced hardcoded 8:05 AM cutoff with per-window start/end times.
5. **Excel export** — `exceljs` for batch-wide attendance with per-student attendance percentage.
6. **5 new frontend pages:** StudentAttendance, QRFullscreen, StudentCheckIn, AttendanceReport + updated MarkAttendance and SessionAttendance for window support.
7. **Navigation flow** — added "Mark Attendance" and "View" links per session in BatchDetail.
8. **Status filters** — filter by P/A/L/E on session attendance page, filter by department/year/attendance rate on report page.

**Tests updated:** 43/43 passing (added 8 tests for createWindowSchema).

---

## API Endpoints

| Method | Path | Description | Used by |
|--------|------|-------------|---------|
| POST | `/api/attendance/windows` | Create attendance window for a session | Trainer |
| GET | `/api/attendance/session/:sessionId/windows` | List windows for a session | MarkAttendance, SessionAttendance |
| POST | `/api/attendance/check-in` | Student self-check-in (window time enforced) | StudentCheckIn |
| POST | `/api/attendance/mark` | Trainer marks single student | MarkAttendance |
| POST | `/api/attendance/bulk` | Trainer bulk marks entire window | MarkAttendance |
| PUT | `/api/attendance/:id` | Update existing record (trainer override) | MarkAttendance |
| GET | `/api/attendance/window/:windowId` | Get attendance for a specific window | MarkAttendance |
| GET | `/api/attendance/session/:sessionId` | Get all attendance for a session (all windows) | SessionAttendance |
| GET | `/api/attendance/student/:studentId` | Student attendance history (?batchId, ?from, ?to) | StudentAttendance |
| GET | `/api/attendance/batch/:batchId/stats` | Batch-level attendance stats | AttendanceReport |
| GET | `/api/attendance/session/:sessionId/export` | Download session attendance as CSV | SessionAttendance |
| GET | `/api/attendance/batch/:batchId/export` | Download batch attendance as Excel | AttendanceReport |
| GET | `/api/attendance/window/:windowId/qr` | Generate QR token for a window | QRFullscreen |

## Frontend Routes

| Path | Component | Status |
|------|-----------|--------|
| `/attendance/mark/:sessionId` | MarkAttendance | Built |
| `/attendance/session/:sessionId` | SessionAttendance | Built |
| `/attendance/student/:studentId` | StudentAttendance | Built |
| `/attendance/qr/:windowId` | QRFullscreen | Built |
| `/attendance/check-in` | StudentCheckIn | Built |
| `/attendance/report/:batchId` | AttendanceReport | Built |

---

## Key Design Decisions

1. **Configurable attendance window** — Each session can have multiple windows with custom start/end times. No hardcoded cutoff. Default workflow: trainer creates a window (e.g., 7:50–8:05 AM), system defaults all batch students to ABSENT, QR opens at window start.

2. **QR TOTP rotation (60s)** — HMAC-SHA256 with per-window secret. Rotates every 60 seconds. Accepts current + previous window for grace period. QR content is a URL — phone camera opens it directly in browser.

3. **Redis caching** — QR tokens cached with TTL. Check-in tracking via Redis Sets for live count. All Redis calls are fail-safe (try/catch, falls back to DB if Redis is down).

4. **Trainer override** — `PUT /:id` with status + remarks. No time restrictions for trainers. Use case: student arrives late with valid reason → trainer changes status.

5. **Default ABSENT** — When a window is created, all batch students automatically get ABSENT records. Trainer only needs to mark who showed up.

6. **Attendance rate** — `(PRESENT + LATE) / total * 100`. LATE = attended. EXCUSED = absent. Feeds into risk/dropout prediction (other tickets).

7. **Excel export** — Uses `exceljs`. Includes per-student attendance percentage (not shown on-screen view). Single-letter codes: P, A, L, E.

8. **Monorepo constraint** — All code added to existing files (controllers, routes, services). No new controller/route files created beyond what already existed.

---

## Schema Reference

```prisma
enum AttendanceStatus {
  PRESENT
  ABSENT
  LATE
  EXCUSED
}

model AttendanceWindow {
  id        String   @id @default(uuid())
  sessionId String
  label     String
  startTime DateTime
  endTime   DateTime
  createdAt DateTime @default(now())

  session     Session      @relation(fields: [sessionId], references: [id])
  attendances Attendance[]

  @@map("attendance_windows")
}

model Attendance {
  id        String           @id @default(uuid())
  windowId  String
  sessionId String
  studentId String
  status    AttendanceStatus
  checkInTime DateTime?
  remarks     String?
  createdAt   DateTime @default(now())

  window  AttendanceWindow @relation(fields: [windowId], references: [id])
  session Session          @relation(fields: [sessionId], references: [id])
  student User             @relation(fields: [studentId], references: [id])

  @@unique([windowId, studentId])
  @@map("attendance")
}
```

---

## Tech Stack Summary

| Layer | Technology | Why |
|-------|-----------|-----|
| Database | PostgreSQL | Relational data with complex joins (students ↔ batches ↔ sessions ↔ attendance) |
| ORM | Prisma | Type-safe queries, auto-generated client, migration support |
| Backend | Node.js + Express v5 | Team standard, async/await support, TypeScript |
| Validation | Joi | Team standardized from Zod; detailed error messages |
| Cache | Redis (ioredis) | Fast QR token storage + live check-in counting during windows |
| QR Generation | HMAC-SHA256 TOTP | Server-side token rotation prevents QR sharing/screenshots |
| Excel Export | exceljs | Full-featured .xlsx generation with formatting |
| Frontend | React 19 + TypeScript 7 | Component-based UI with type safety |
| Styling | Tailwind CSS v4 | Utility-first CSS, consistent with team's existing pages |
| Bundler | Vite 8 | Fast dev server + builds |
| QR Rendering | qrcode.react | SVG QR codes in React (large, easily scannable) |
| HTTP Client | Axios | Promise-based HTTP for API calls |
| Testing | Jest + @swc/jest | Fast test runner with SWC compilation |

---

## Files Changed (Complete List)

### New files:
| File | Description |
|------|-------------|
| `backend-api/src/lib/redis.ts` | Redis client connection (ioredis) |
| `backend-api/src/validators/attendance.validator.ts` | Joi validation schemas (5 schemas) |
| `backend-api/src/services/attendance.service.ts` | Business logic (13 exported functions + helpers) |
| `backend-api/src/controllers/attendance.controller.ts` | Express request handlers (13 handlers) |
| `backend-api/src/__tests__/attendance.test.ts` | Unit tests (43 tests) |
| `frontend/src/services/attendance.service.ts` | Axios API client (12 functions) |
| `frontend/src/pages/attendance/MarkAttendance.tsx` | Trainer attendance sheet page |
| `frontend/src/pages/attendance/SessionAttendance.tsx` | Session attendance report page |
| `frontend/src/pages/attendance/StudentAttendance.tsx` | Student attendance history page |
| `frontend/src/pages/attendance/QRFullscreen.tsx` | Live QR fullscreen page |
| `frontend/src/pages/attendance/StudentCheckIn.tsx` | Student check-in page (auto-submit from QR) |
| `frontend/src/pages/attendance/AttendanceReport.tsx` | Batch attendance report with Excel export |
| `docs/ticket-7-summary.md` | This file |

### Modified files:
| File | Change |
|------|--------|
| `backend-api/src/prisma/schema.prisma` | Added AttendanceWindow model, updated Attendance with windowId |
| `backend-api/src/server.ts` | Added attendance route import and mount |
| `backend-api/src/routes/attendance.routes.ts` | Full route definitions (13 endpoints) |
| `backend-api/package.json` | Added ioredis, exceljs dependencies |
| `frontend/src/App.tsx` | Added all attendance routes and imports |
| `frontend/src/pages/batches/BatchDetail.tsx` | Added "Mark Attendance" and "View" links per session |
| `frontend/package.json` | Added qrcode.react dependency |

---

## Phase 6: Requirements Audit & Fixes (2026-09-25)

Audited all code against the full Ticket 7 requirements spec. Found and fixed 6 gaps:

### Fix 1: JWT Authentication on All Routes (Gap #5 & #10)
**Problem:** No auth middleware on attendance routes — endpoints were publicly accessible. Students could check in without being logged in.
**Fix:**
- Populated `backend-api/src/auth/jwt.middleware.ts` with `authenticateJwt` middleware (Bearer token validation, JWT verify, expiry handling)
- Applied `authenticateJwt` to `/api/attendance` in `server.ts`
- Changed `checkInHandler` to get `studentId` from `req.user.sub` (JWT payload) instead of request body — students must be authenticated

### Fix 2: Default Attendance Window 7:50–8:05 AM (Gap #7)
**Problem:** `createWindowSchema` required `startTime` and `endTime` — trainer had to specify times every time, no default.
**Fix:**
- Made `startTime` and `endTime` optional in the Joi validator
- `createWindowHandler` applies defaults: today at 7:50 AM (start) and 8:05 AM (end) when not provided
- Afternoon sessions still work by passing custom times

### Fix 3: Attendance % Removed from On-Screen View (Gap #16)
**Problem:** `AttendanceReport.tsx` showed overall attendance rate in a summary card and rate-based color coding per student. Requirements say % should only appear in the downloadable Excel file.
**Fix:**
- Removed "Overall Rate" summary card from AttendanceReport
- Removed per-student `rateColor` styling
- Excel export still includes `Attendance %` column (unchanged)

### Fix 4: Session ID Column + Session Filter in Student History (Gap #14)
**Problem:** `StudentAttendance.tsx` had no session ID column and no way to filter by a single session.
**Fix:**
- Added `sessionId` filter support to `getStudentAttendance` service function
- Added `sessionId` query param handling in `getStudentAttendanceHandler` controller
- Added "Session ID" filter input to the frontend filter bar
- Added "Session ID" column (first 8 chars, monospace) to the history table

### Fix 5: Dedicated Excused Review Page (Gap #4)
**Problem:** No dedicated page for trainers to review and record reasons for excused absences. Trainers could only mark EXCUSED via the general MarkAttendance dropdown.
**Fix:**
- Added `getExcusedRecords` service function — fetches all EXCUSED attendance records with optional batch/session/date filters
- Added `getExcusedRecordsHandler` controller + `GET /excused` route
- Created `ExcusedReview.tsx` frontend page — shows all excused records in a table, inline edit for remarks, save/cancel per row
- Added `/attendance/excused` route to `App.tsx`

### Fix 6: Removed Department/Year from Views (Per User Request)
- Stripped department and year columns from `AttendanceReport.tsx`
- Stripped department/year filters from `AttendanceReport.tsx`
- Simplified `StudentAttendance.tsx` student header (ID only, no dept/year)

### Phase 6 Test Results
Added 33 new edge-case tests (76 total, all passing):

| Category | Tests Added | What They Cover |
|----------|-------------|-----------------|
| Injection attacks | 7 | SQL injection in UUID, XSS in token, null/numeric/array/object in windowId |
| Status boundary | 9 | Lowercase, mixed case, trailing space, numeric, empty, null, invalid enum values |
| Large batch | 4 | 200-record batch, single invalid in 50-record batch, duplicate studentIds |
| Time boundaries | 6 | Default times, equal start/end, 1-second window, afternoon window, label length |
| Override edge cases | 3 | EXCUSED→PRESENT, empty string remarks, unknown field stripping |
| QR security | 4 | Hex-only output, near-identical UUID tokens differ, TTL bounds, no secret leak |

### Phase 6 Files Changed
| File | Change |
|------|--------|
| `backend-api/src/auth/jwt.middleware.ts` | Populated with JWT auth middleware |
| `backend-api/src/server.ts` | Added `authenticateJwt` to attendance routes |
| `backend-api/src/controllers/attendance.controller.ts` | Check-in uses JWT user, default window times, excused handler |
| `backend-api/src/services/attendance.service.ts` | `sessionId` filter, `getExcusedRecords` function |
| `backend-api/src/routes/attendance.routes.ts` | Added `GET /excused` route |
| `backend-api/src/validators/attendance.validator.ts` | Made startTime/endTime optional |
| `backend-api/src/__tests__/attendance.test.ts` | 33 new edge-case tests (76 total) |
| `frontend/src/pages/attendance/AttendanceReport.tsx` | Removed % from screen, removed dept/year |
| `frontend/src/pages/attendance/StudentAttendance.tsx` | Added session ID column/filter, simplified header |
| `frontend/src/pages/attendance/ExcusedReview.tsx` | New dedicated excused review page |
| `frontend/src/services/attendance.service.ts` | Added `getExcusedRecords`, `sessionId` param |
| `frontend/src/App.tsx` | Added `/attendance/excused` route |
