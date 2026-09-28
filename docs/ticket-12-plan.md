# Ticket 12 — Engagement Dashboard (Backend API)

## Inspection Report & Implementation Plan

---

## 1. Current Repository State

- **Branch**: `main`
- **Working tree**: clean, no uncommitted changes
- **Tickets 7, 8, 9**: merged into main and fully functional

---

## 2. What Ticket 7 (Attendance) Provides

### Prisma Models
- `Attendance` — per-student attendance record per window/session
- `AttendanceWindow` — time window within a session for check-in
- `Session` — training session linked to a batch

### Enum
- `AttendanceStatus`: `PRESENT`, `ABSENT`, `LATE`, `EXCUSED`

### Key Fields
| Model      | Field       | Type             |
|------------|-------------|------------------|
| Attendance | id          | String (UUID)    |
| Attendance | windowId    | String → AttendanceWindow |
| Attendance | sessionId   | String → Session |
| Attendance | studentId   | String → User    |
| Attendance | status      | AttendanceStatus |
| Attendance | checkInTime | DateTime?        |
| Attendance | remarks     | String?          |
| Attendance | createdAt   | DateTime         |
| Attendance | **Unique**  | `[windowId, studentId]` |

### Attendance Rate Formula (from attendance.service.ts)
```
attendanceRate = total > 0
  ? Math.round(((presentCount + lateCount) / total) * 100)
  : 0
```
- `PRESENT` — counts as attended
- `LATE` — counts as attended
- `ABSENT` — not attended
- `EXCUSED` — counted in total (same treatment as Ticket 7)

No new attendance formula is introduced. Ticket 7 is not modified.

### Files (READ-ONLY — do not modify)
- `src/services/attendance.service.ts`
- `src/controllers/attendance.controller.ts`
- `src/routes/attendance.routes.ts`
- `src/validators/attendance.validator.ts`

---

## 3. What Ticket 8 (Assessment) Provides

### Prisma Models
- `Assessment` — an assessment tied to a batch
- `AssessmentResult` — overall score per student per assessment
- `AssessmentSection` — sections within an assessment
- `AssessmentQuestion` — questions within a section
- `StudentQuestionScore` — per-question score per student

### Enum
- `AssessmentType`: `CODING_TEST`, `QUIZ`, `ASSIGNMENT`, `CONTEST`

### Key Fields
| Model            | Field          | Type           |
|------------------|----------------|----------------|
| Assessment       | id             | String (UUID)  |
| Assessment       | batchId        | String → Batch |
| Assessment       | title          | String         |
| Assessment       | type           | AssessmentType |
| Assessment       | maxScore       | Float          |
| Assessment       | assessmentDate | DateTime       |
| AssessmentResult | id             | String (UUID)  |
| AssessmentResult | assessmentId   | String → Assessment |
| AssessmentResult | studentId      | String → User  |
| AssessmentResult | score          | Float          |
| AssessmentResult | remarks        | String?        |
| AssessmentResult | **Unique**     | `[assessmentId, studentId]` |

### Assessment Percentage Formula

`averageAssessmentScore` represents the **average assessment percentage**, not an average of raw scores.

For each individual `AssessmentResult`:
```
percentage = maxScore > 0 ? (score / maxScore) * 100 : 0
```

For aggregation across multiple results:
```
averageAssessmentScore = resultCount > 0
  ? Math.round((sum of all individual percentages / resultCount) * 100) / 100
  : 0
```

This ensures assessments with different `maxScore` values are compared fairly.
A student scoring 8/10 and 40/50 produces percentages of 80% and 80%, averaging 80% — not `(8 + 40) / 2 = 24`.

`maxScore = 0` is handled safely by treating the percentage as 0 for that result.

Ticket 8's existing calculation is not modified.

### Files (READ-ONLY — do not modify)
- `src/services/assessments.service.ts`
- `src/controllers/assessments.controller.ts`
- `src/routes/assessments.routes.ts`
- `src/validators/assessments.validator.ts`

---

## 4. What Ticket 9 (Feedback) Provides

### Prisma Model
- `Feedback` — trainer feedback per student per session

### Key Fields
| Model    | Field               | Type           |
|----------|---------------------|----------------|
| Feedback | id                  | String (UUID)  |
| Feedback | sessionId           | String → Session |
| Feedback | studentId           | String → User  |
| Feedback | trainerId           | String → User  |
| Feedback | effortRating        | Int (1–5)      |
| Feedback | participationRating | Int (1–5)      |
| Feedback | comments            | String?        |
| Feedback | createdAt           | DateTime       |

### Rating Scale
- `effortRating`: integer 1 to 5
- `participationRating`: integer 1 to 5
- Averages: `sum(rating) / count`, rounded to 1 decimal, or 0 if no feedback

### Files (READ-ONLY — do not modify)
- `src/services/feedback.service.ts`
- `src/controllers/feedback.controller.ts`
- `src/routes/feedback.routes.ts`
- `src/validators/feedback.validator.ts`

---

## 5. Supporting Models

### Batch
| Field       | Type      |
|-------------|-----------|
| id          | String (UUID) |
| name        | String    |
| department  | String?   |
| startDate   | DateTime  |
| endDate     | DateTime? |
| Relations   | members (BatchMember[]), trainers, sessions, assessments |

### BatchMember
| Field     | Type   |
|-----------|--------|
| id        | String |
| batchId   | String → Batch |
| studentId | String → User  |
| **Unique**| `[batchId, studentId]` |

### User
| Field      | Type       |
|------------|------------|
| id         | String     |
| name       | String     |
| email      | String (unique) |
| department | String?    |
| year       | Int?       |
| roleId     | String → Role |
| status     | UserStatus |

---

## 6. Backend Conventions

### Validation
- **Library**: Joi
- **Middleware**: `validate(schema, property)` from `src/middleware/validate.middleware.ts`
- `property` defaults to `'body'`, also supports `'query'` and `'params'`

### Response Format
```typescript
sendSuccess(res, data, statusCode = 200)
// → { success: true, data: { ... } }

sendError(res, message, statusCode = 400)
// → { success: false, error: "..." }
```

### Error Handling
```typescript
class ServiceError extends Error {
  constructor(message: string, public statusCode: number) { ... }
}

// Controller pattern:
function handleServiceError(err, res, next) {
  if (err instanceof ServiceError) return sendError(res, err.message, err.statusCode);
  next(err);
}
```

### Route Registration (server.ts pattern)
```typescript
import someRoutes from './routes/some.routes';
app.use('/api/some', authenticateJwt, someRoutes);
```

### Authentication
- JWT via `authenticateJwt` middleware
- Applied at route-group level in `server.ts`
- Adds `req.user` with `{ sub: userId, roleId, exp }`

### Prisma Client Import
```typescript
import prisma from '../lib/prisma';
```

---

## 7. Ticket 12 — Files to Create

| File | Type | Purpose |
|------|------|---------|
| `src/validators/engagement.validator.ts` | NEW | Joi schemas for params and query validation |
| `src/services/engagement.service.ts` | NEW | Aggregation logic — queries Prisma directly |
| `src/controllers/engagement.controller.ts` | NEW | Request handling, calls service, returns response |
| `src/routes/engagement.routes.ts` | NEW | Express router with 4 endpoints |
| `src/server.ts` | MODIFIED | Add engagement route import and registration |

---

## 8. Files NOT Modified

- `src/services/attendance.service.ts` — Ticket 7
- `src/controllers/attendance.controller.ts` — Ticket 7
- `src/routes/attendance.routes.ts` — Ticket 7
- `src/validators/attendance.validator.ts` — Ticket 7
- `src/services/assessments.service.ts` — Ticket 8
- `src/controllers/assessments.controller.ts` — Ticket 8
- `src/routes/assessments.routes.ts` — Ticket 8
- `src/validators/assessments.validator.ts` — Ticket 8
- `src/services/feedback.service.ts` — Ticket 9
- `src/controllers/feedback.controller.ts` — Ticket 9
- `src/routes/feedback.routes.ts` — Ticket 9
- `src/validators/feedback.validator.ts` — Ticket 9
- `src/prisma/schema.prisma` — no schema changes
- `package.json` — no dependency changes
- All frontend files
- All ML service files
- All migration files

---

## 9. API Endpoints

### GET /api/engagement/dashboard

Overall platform engagement summary.

**Query params** (optional): `from`, `to` (ISO date strings)

**Returns**:
- `totalStudents` — count of distinct students across all batches
- `totalBatches` — count of batches
- `totalSessions` — count of sessions
- `averageAttendanceRate` — platform-wide average attendance % using Ticket 7 formula
- `averageAssessmentScore` — platform-wide average of per-result percentages (not raw scores)
- `averageEffortRating` — platform-wide average effort rating (1–5 scale)
- `averageParticipationRating` — platform-wide average participation rating (1–5 scale)
- `batches[]` — per-batch summary with: batchId, batchName, studentCount, attendanceRate, averageAssessmentScore (average percentage), averageEffortRating, averageParticipationRating

### GET /api/engagement/batch/:batchId

Detailed engagement for a specific batch.

**Params**: `batchId` (UUID)
**Query params** (optional): `from`, `to`

**Returns**:
- `batch` — batch info (id, name, department, startDate)
- `studentCount`
- `sessionCount`
- `assessmentCount`
- `attendance` — averageRate, totalRecords, presentCount, lateCount, absentCount, excusedCount
- `assessments` — averageScore (average percentage), averagePercentage, totalResults
- `feedback` — averageEffortRating, averageParticipationRating, totalFeedbackCount
- `students[]` — per-student: studentId, name, email, attendanceRate, assessmentAverage (average percentage), effortRating, participationRating

### GET /api/engagement/student/:studentId

Engagement profile for a single student.

**Params**: `studentId` (UUID)
**Query params** (optional): `batchId`, `from`, `to`

**Returns**:
- `student` — student info (id, name, email, department, year)
- `attendance` — totalRecords, presentCount, lateCount, absentCount, excusedCount, attendanceRate
- `assessments` — totalAssessments, averageScore (average percentage), averagePercentage, results[] (each with percentage = score/maxScore * 100)
- `feedback` — totalFeedback, averageEffortRating, averageParticipationRating, recentFeedback[]

### GET /api/engagement/batch/:batchId/trends

Time-series trends for a batch.

**Params**: `batchId` (UUID)
**Query params** (optional): `from`, `to`

**Returns**:
- `batch` — batch info (id, name)
- `attendance[]` — per-session: sessionId, sessionTitle, scheduledDate, presentCount, totalCount, attendanceRate
- `assessments[]` — per-assessment: assessmentId, title, type, assessmentDate, averageScore, maxScore, averagePercentage (average of per-result percentages), resultCount
- `feedback[]` — per-session: sessionId, sessionTitle, scheduledDate, averageEffortRating, averageParticipationRating, feedbackCount

---

## 10. Data Aggregation Strategy

### Architecture
```
Route → Joi validation → Controller → Engagement Service → Prisma → PostgreSQL
```

### Data Sources (read-only)
```
Ticket 7: prisma.attendance, prisma.attendanceWindow, prisma.session
Ticket 8: prisma.assessment, prisma.assessmentResult
Ticket 9: prisma.feedback
Supporting: prisma.batch, prisma.batchMember, prisma.user
```

### Calculations (preserving existing formulas)

**Attendance rate** (reproduces Ticket 7 exactly):
```
attendanceRate = total > 0
  ? Math.round(((presentCount + lateCount) / total) * 100)
  : 0
```
- PRESENT counts as attended
- LATE counts as attended
- ABSENT is not attended
- EXCUSED counted in total (same as Ticket 7)

**Assessment percentage** (per result):
```
percentage = maxScore > 0 ? (score / maxScore) * 100 : 0
```

**Average assessment score** (aggregated — average of percentages, not raw scores):
```
averageAssessmentScore = resultCount > 0
  ? Math.round((sum of all individual percentages / resultCount) * 100) / 100
  : 0
```

**Feedback averages**:
```
averageEffortRating = count > 0
  ? Math.round((sum of effortRating / count) * 10) / 10
  : 0

averageParticipationRating = count > 0
  ? Math.round((sum of participationRating / count) * 10) / 10
  : 0
```

### Date Filtering
- Attendance and feedback: filtered via `Session.scheduledDate`
- Assessments: filtered via `Assessment.assessmentDate`

### Performance
- Bulk queries with `findMany` and relation includes (no N+1)
- `aggregate` / `groupBy` where beneficial
- No HTTP calls between backend services

---

## 11. Error Handling

- Invalid UUID → Joi validation returns 400
- Batch not found → ServiceError with 404
- Student not found → ServiceError with 404
- Unexpected errors → passed to existing global `errorHandler` middleware
- Empty data → return zero/empty arrays, never throw

---

## 12. Critical Rule

**Ticket 12 must not modify, refactor, or change any existing calculation, response structure, validation, or business logic from Tickets 7, 8, or 9. It must consume their existing database data exactly as implemented.**

No Ticket 7, Ticket 8, or Ticket 9 files will be changed.

---

## 13. Assumptions

1. Attendance rate formula matches Ticket 7 exactly: `(PRESENT + LATE) / total * 100`
2. Assessment score means average percentage: `(score / maxScore) * 100` per result, then averaged
3. `maxScore = 0` treated safely as 0% for that result
4. Feedback ratings are integers 1–5 as validated by Ticket 9
5. No new Prisma models or schema changes needed
6. Auth middleware applied at route group level matching existing pattern
7. Date filtering uses `Session.scheduledDate` for attendance/feedback, `Assessment.assessmentDate` for assessments
8. Dashboard handles empty datasets safely (returns 0/empty, not errors)
9. Tickets 7, 8, 9 remain completely untouched
