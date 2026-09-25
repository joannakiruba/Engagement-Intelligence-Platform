# Handoff: Ticket 7 Attendance Module

Use this document to brief another AI agent or senior developer on what was done, the current state, and what to watch for during merge review.

## Current state

Branch `ticket-7-attendance` on https://github.com/joannakiruba/Engagement-Intelligence-Platform is ready for merge into main. It has already been merged WITH main (no remaining conflicts). All 400 tests pass.

## What was built

A full attendance module (Ticket 7 / Module 5) was implemented on the `ticket-7-attendance` branch. This includes:

- Backend: 14 REST endpoints under /api/attendance for managing attendance windows, student check-in via QR codes, trainer mark/override, CSV/Excel export, and excused record review
- Frontend: 7 React pages (MarkAttendance, SessionAttendance, StudentAttendance, QRFullscreen, StudentCheckIn, AttendanceReport, ExcusedReview)
- Database: 2 new Prisma models (AttendanceWindow, Attendance) added to existing schema
- Tests: 76 attendance-specific unit tests covering validators, QR security, injection attacks, status boundaries, large batches, and time edge cases

The code was ported from a demo repo (https://github.com/Harineesuresh07/attendance-module-demo) and adapted to fit the existing monorepo architecture (Express v5, Prisma, Joi validation, sendSuccess/sendError pattern).

## Architecture decisions to know about

1. AttendanceWindow model: Each session can have multiple attendance windows (morning, afternoon). Attendance records link to windows via windowId, not directly to sessions. Unique constraint is @@unique([windowId, studentId]).

2. QR TOTP: Uses HMAC-SHA256 with 60-second rotation. Token = first 8 hex chars of HMAC(windowSecret, floor(timestamp/60)). Accepts current + previous window for grace period.

3. Redis: Used for QR token caching, live check-in tracking (SADD/SCARD), window metadata cache, and batch membership cache. All Redis calls are wrapped in try/catch - system falls back to database if Redis is down.

4. Student check-in gets studentId from JWT token (req.user.sub), not from the request body. This prevents students from checking in on behalf of others.

5. Default attendance window is 7:50-8:05 AM if trainer doesn't specify start/end times.

6. Attendance % is ONLY shown in the Excel export. On-screen views do not display percentage. Formula: (PRESENT + LATE) / total * 100.

7. Infrastructure files (jwt.middleware.ts, config/index.ts, response.ts, logger.ts, etc.) were empty stubs on this branch. They were populated to match the demo repo's implementation.

## Merge conflict resolution already done

origin/main was merged into ticket-7-attendance on 2026-09-25. All 10 conflicts were resolved:

- attendance.routes.ts: Kept ours (main had a basic CRUD skeleton, ours has the full 14-endpoint window-based implementation)
- schema.prisma: Merged both (our AttendanceWindow + windowId on Attendance, plus all of main's other models)
- server.ts: Took main's full version (has all route imports including attendance)
- App.tsx: Merged both (main's assessment/batch pages + our attendance pages)
- BatchDetail.tsx: Kept ours (has "Mark Attendance" and "View" links)
- tsconfig.json: Kept ours (Node16 module resolution)
- package.json files: Merged (main's deps + our exceljs, ioredis, qrcode.react)
- package-lock.json files: Took main's as base
- Removed attendance.integration.test.ts from main (tested old CRUD endpoints that don't exist in our implementation)

## Potential issues during merge review

1. The infrastructure files (jwt.middleware, config, logger, response helpers, error middleware, rate limiter, validate middleware) were populated from the demo repo. If main has its own versions of these that differ, check for conflicts. As of 2026-09-25, main's versions of these files were also empty stubs.

2. The backend tsconfig uses "module": "Node16" and "moduleResolution": "node16". Main used "commonjs"/"node". We kept ours. If this causes build issues for other modules, it may need alignment.

3. Lock files (package-lock.json) were taken from main. After merging, run `npm install` in both backend-api/ and frontend/ to sync.

4. Redis is required for QR features. If Redis is not available, the check-in flow still works but without caching (slower under load). The QR_SECRET env var must be set for TOTP to work.

5. The Prisma schema needs `npx prisma migrate dev` to create the attendance_windows and attendance tables.

## Files to review (attendance-specific only)

Backend:
- backend-api/src/controllers/attendance.controller.ts
- backend-api/src/services/attendance.service.ts
- backend-api/src/routes/attendance.routes.ts
- backend-api/src/validators/attendance.validator.ts
- backend-api/src/__tests__/attendance.test.ts
- backend-api/src/prisma/schema.prisma (AttendanceWindow + Attendance models)

Frontend:
- frontend/src/pages/attendance/ (7 files)
- frontend/src/services/attendance.service.ts

Modified shared files:
- backend-api/src/server.ts (added route import)
- frontend/src/App.tsx (added routes)
- frontend/src/pages/batches/BatchDetail.tsx (added attendance links)

## If something breaks

- Tests fail: Run `cd backend-api && npx jest --forceExit --detectOpenHandles` to see which tests fail. Our 76 attendance tests are in attendance.test.ts. The other 324 tests are from main's modules.
- Prisma errors: Run `npx prisma generate` then `npx prisma migrate dev` in backend-api/
- TypeScript errors: Run `npx tsc --noEmit` in backend-api/ to see type errors. The most likely issue is missing types from infrastructure files.
- Frontend build errors: Run `npx tsc -b` in frontend/. Most likely issue is missing page imports if assessment/batch pages from main aren't present.
- Redis connection errors: Set REDIS_URL in .env or ensure Redis is running on localhost:6379. The app works without Redis but QR caching won't function.
