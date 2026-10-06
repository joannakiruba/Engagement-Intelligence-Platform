# Ticket 19 — Event Registration Module

## Overview

Trainers and coordinators create events (contests, hackathons, workshops), target batches, and add rounds as they are announced. Students browse events for their batches, mark themselves as Interested / Registered / Withdrawn. Mandatory events auto-enroll batch students with PENDING status. Only REGISTERED students can submit proof (proof module is separate).

Only `title` is required when creating an event — everything else is optional and editable at any time.

## Database Changes

### Migration: `20261006_ticket19_event_registration`

**New enums:** EventCategory (CODING/HACKATHON/OTHER), EventMode (ONLINE/OFFLINE), EventRoundStatus (UPCOMING/ONGOING/DONE), RegistrationStatus (PENDING/INTERESTED/REGISTERED/WITHDRAWN). Added EVENT_UPDATE to NotificationType.

**events table:** Dropped `eventType`, `eventDate`, `registrationDeadline`. Added `category` (default OTHER), `isMandatory` (default false), `officialLink`, `startDate`, `endDate`, `mode`, `venue`, `fee`, `closedAt`, `createdById` (FK to users), `updatedAt`.

**event_registrations table:** Existing rows set to status REGISTERED (they were real registrations), then default changed to PENDING for future inserts. Dropped `registeredAt`. Added `status`, `createdAt`, `updatedAt`. FK updated to ON DELETE CASCADE.

**New tables:** `event_batches` (composite PK eventId+batchId, both FKs cascade), `event_rounds` (UUID PK, eventId FK cascade, indexed).

**Back-relations added:** User.createdEvents, Batch.eventBatches.

## Permission Changes

### Removed (6 codes)
`events:create`, `events:update:any`, `events:read:any`, `event_registrations:create:self`, `event_registrations:read:own`, `event_registrations:read:any`

### Added (10 codes)
| Code | Description |
|------|-------------|
| `events:create:batch` | Create events for own batches |
| `events:create:any` | Create events for any batch |
| `events:read:own` | Read events for own batches (student) |
| `events:read:batch` | Read events for trainer's batches |
| `events:read:any` | Read any event |
| `events:update:own` | Update own event registrations (student) |
| `events:update:batch` | Update events for own batches |
| `events:update:any` | Update any event |
| `events:delete:batch` | Delete events for own batches |
| `events:delete:any` | Delete any event |

### Permission count arithmetic
Previous total: 69 codes. Removed 6, added 10. New total: **73 codes**.

### Role assignments
| Role | Permissions |
|------|-------------|
| STUDENT | `events:read:own`, `events:update:own` |
| TRAINER | `events:create:batch`, `events:read:batch`, `events:update:batch`, `events:delete:batch` |
| FACULTY | `events:read:any` |
| MENTOR | `events:read:any` |
| COORDINATOR | `events:create:any`, `events:read:any`, `events:update:any` |
| ADMIN | `events:create:any`, `events:read:any`, `events:update:any`, `events:delete:any` |

## Backend Files

| File | Purpose |
|------|---------|
| `src/validators/events.validator.ts` | 5 Joi schemas: createEvent, updateEvent, createRound, updateRound, setRegistrationStatus |
| `src/services/events.service.ts` | ServiceError, helpers (notifyRegisteredStudents, checkEventTrainerAuth, eventIncludes), 13 service functions |
| `src/controllers/events.controller.ts` | 13 handlers with scope derivation (any/batch/own) |
| `src/routes/events.routes.ts` | All routes under /api/events with permission guards |
| `src/server.ts` | Registered eventRoutes at `/api/events` |
| `src/prisma/seed.ts` | Phase 13: 3 events (CodeVita title-only, GSoC with rounds, ICPC mandatory) |

### API Endpoints (13 routes)

| Method | Path | Permission | Handler |
|--------|------|------------|---------|
| GET | /my-events | read:own/batch/any | studentEventsHandler |
| PATCH | /:id/status | update:own/batch/any | setStatusHandler |
| GET | / | read:batch/any | listEventsHandler |
| GET | /:id | read:own/batch/any | getEventHandler |
| POST | / | create:batch/any | createEventHandler |
| PUT | /:id | update:own/batch/any | updateEventHandler |
| DELETE | /:id | delete:batch/any | deleteEventHandler |
| POST | /:id/close | update:own/batch/any | closeEventHandler |
| POST | /:id/reopen | update:own/batch/any | reopenEventHandler |
| POST | /:id/rounds | update:own/batch/any | addRoundHandler |
| PUT | /:id/rounds/:roundId | update:own/batch/any | updateRoundHandler |
| DELETE | /:id/rounds/:roundId | update:own/batch/any | deleteRoundHandler |
| GET | /:id/registrations | read:batch/any | getRegistrationsHandler |

### Key service behaviors
- **Mandatory events:** At creation, auto-creates PENDING registration rows for all students in target batches (deduplicated). If no batches, enrolls all active students.
- **Voluntary events:** No rows at creation. INTERESTED row created on demand when student taps Interested.
- **Notifications:** EVENT_UPDATE notifications sent to non-WITHDRAWN registrants when rounds change or event is edited. Only new values, never old.
- **Closed events:** 409 on student status changes and round modifications.
- **Delete guard:** 409 if any registration has status beyond PENDING; close instead.
- **Scope enforcement:** Batch scope checks trainer ownership via BatchTrainer. Own scope returns 404 (not 403) for out-of-scope events.

## Frontend Files

| File | Purpose |
|------|---------|
| `src/services/events.service.ts` | 13 API functions, TypeScript interfaces |
| `src/pages/events/EventList.tsx` | Category chips, student/trainer views, status badges, action buttons |
| `src/pages/events/EventDetail.tsx` | Info section, rounds table, inline round form, registrations panel |
| `src/pages/events/EventForm.tsx` | Create/edit form, batch selection chips, lazy-loads batches |
| `src/App.tsx` | Added Events nav link, 4 routes (/events, /events/create, /events/:id/edit, /events/:id) |

## Tests

| File | Tests |
|------|-------|
| `src/__tests__/events-validator.test.ts` | 35 tests across 5 schemas |
| `src/__tests__/events-controller.test.ts` | 21 tests covering all 13 handlers |
| `tests/auth-rbac.test.ts` | Updated permission count (73), ADMIN check (events:create:any), STUDENT scope check |

## Proof Module Integration Note

The proof module (`proofs.routes.ts`) does not currently check `EventRegistration.status = REGISTERED` before allowing proof submission. When merging with the proof module branch, the following check must be added to POST `/api/proofs` and PUT `/api/proofs/:id/file`:

1. Query `EventRegistration` for `(eventId, studentId)` with `status = 'REGISTERED'`
2. If no matching registration, return 403 ("Only registered students can submit proof")
3. If the event's `closedAt` is set, return 409 ("Event is closed")

The student proof upload dropdown should also be filtered to only show events where the student's registration status is REGISTERED.

## Seed Data

| Event | Type | Batches | Rounds | Registrations |
|-------|------|---------|--------|---------------|
| CodeVita 2026 | Voluntary, title-only | None (open to all) | 0 | 0 |
| GSoC 2026 Preparation | Voluntary | Batch 0, Batch 1 | 3 (DONE, ONGOING, UPCOMING) | 0 |
| ICPC Regional 2026 | Mandatory, CODING | Batch 0 | 0 | All batch 0 students (PENDING), 5 REGISTERED |
