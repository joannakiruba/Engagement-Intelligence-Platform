# Ticket 7 - Attendance Module

Branch: `ticket-7-attendance`
Date: 2026-09-24 to 2026-09-25
Merged with origin/main: Yes (no remaining conflicts)
Tests: 400 passing across 9 suites

## What this module does

Window-based attendance system where trainers create time-bounded attendance windows per session, generate rotating QR codes (60s TOTP), and students scan to check in. Trainers can also manually mark/override attendance. Supports Excel export for batch reports.

Statuses: PRESENT, ABSENT, LATE, EXCUSED
Attendance rate: (PRESENT + LATE) / total * 100
LATE counts as attended. EXCUSED counts as absent.
Default window time: 7:50-8:05 AM if trainer doesn't specify.

## Database models added

AttendanceWindow - per-session time windows (id, sessionId, label, startTime, endTime)
Attendance - student record per window (windowId, sessionId, studentId, status, checkInTime, remarks)
Unique constraint: @@unique([windowId, studentId])

## Backend files (backend-api/src/)

controllers/attendance.controller.ts - 13 request handlers
services/attendance.service.ts - business logic, QR TOTP, Redis caching, Excel export
routes/attendance.routes.ts - 14 endpoints under /api/attendance
validators/attendance.validator.ts - 5 Joi schemas
__tests__/attendance.test.ts - 76 unit tests
lib/prisma.ts - Prisma client singleton
lib/redis.ts - Redis client (ioredis)

## Frontend files (frontend/src/)

pages/attendance/MarkAttendance.tsx - trainer marks attendance per window
pages/attendance/SessionAttendance.tsx - session attendance view + CSV export
pages/attendance/StudentAttendance.tsx - student history with session ID filter
pages/attendance/QRFullscreen.tsx - live QR display with countdown + check-in count
pages/attendance/StudentCheckIn.tsx - auto-submit check-in from QR scan
pages/attendance/AttendanceReport.tsx - batch report + Excel export
pages/attendance/ExcusedReview.tsx - review/edit excused records
services/attendance.service.ts - Axios API client (12 functions)

## API endpoints

POST /api/attendance/windows - create attendance window
GET /api/attendance/session/:sessionId/windows - list windows
POST /api/attendance/check-in - student self-check-in (studentId from JWT)
POST /api/attendance/mark - trainer marks single student
POST /api/attendance/bulk - trainer bulk marks
PUT /api/attendance/:id - update/override record
GET /api/attendance/window/:windowId - get window attendance
GET /api/attendance/session/:sessionId - get session attendance
GET /api/attendance/student/:studentId - student history
GET /api/attendance/batch/:batchId/stats - batch stats
GET /api/attendance/session/:sessionId/export - CSV export
GET /api/attendance/batch/:batchId/export - Excel export
GET /api/attendance/window/:windowId/qr - generate QR token
GET /api/attendance/excused - list excused records

## Other files modified

backend-api/src/prisma/schema.prisma - added AttendanceWindow + Attendance models
backend-api/src/server.ts - added attendance route import with authenticateJwt
backend-api/package.json - added exceljs, ioredis deps
frontend/src/App.tsx - added all attendance routes
frontend/src/pages/batches/BatchDetail.tsx - added attendance links per session
frontend/package.json - added qrcode.react dep

## Infrastructure files populated (were empty stubs)

backend-api/src/auth/jwt.middleware.ts
backend-api/src/config/index.ts
backend-api/src/utils/response.ts
backend-api/src/utils/logger.ts
backend-api/src/middleware/validate.middleware.ts
backend-api/src/middleware/error.middleware.ts
backend-api/src/middleware/rate-limit.middleware.ts
frontend/src/main.tsx
frontend/tsconfig.json
frontend/vite.config.ts
backend-api/tsconfig.json
backend-api/jest.config.ts

## Key design notes

- QR tokens use HMAC-SHA256 TOTP with 60s rotation, accepts current + previous window for grace
- Redis caches QR tokens, check-in sets, window metadata, batch membership (all fail-safe, falls back to DB)
- 5-gate Redis pipeline prevents thundering herd on concurrent check-ins
- Student check-in uses JWT sub (not request body) for studentId
- Attendance % only appears in Excel export, not on-screen views
- All routes behind authenticateJwt middleware

## Merge conflict resolution

Merged origin/main into ticket-7-attendance. 10 files conflicted, all resolved:
- Kept ours: attendance.routes.ts, tsconfig.json, BatchDetail.tsx
- Merged both: server.ts, schema.prisma, App.tsx, both package.json files
- Took main's: both package-lock.json files
- Removed: main's attendance.integration.test.ts (tested old CRUD API we replaced)
