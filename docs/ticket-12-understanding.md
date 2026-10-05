# Ticket 12 — My Understanding Before Implementation

---

## What Ticket 12 IS

A **read-only aggregation layer** that queries existing database tables populated by Tickets 7, 8, and 9, computes dashboard metrics, and exposes them via 4 new API endpoints.

```
Ticket 7 (Attendance)  ──┐
                         │
Ticket 8 (Assessment)  ──┼──→  Ticket 12 (Engagement Service)  ──→  4 API endpoints
                         │
Ticket 9 (Feedback)    ──┘
```

## What Ticket 12 is NOT

- NOT a modification of Tickets 7, 8, or 9
- NOT a new database schema or migration
- NOT a frontend feature
- NOT a new auth system
- NOT a refactor of existing code

---

## Existing Data I Will Read (Not Modify)

### From Ticket 7 — Attendance

I will query `prisma.attendance` which has:
- `studentId` — who
- `sessionId` — which session
- `status` — `PRESENT` | `ABSENT` | `LATE` | `EXCUSED`

I will also query `prisma.session` to get `batchId` and `scheduledDate` for filtering.

**I will NOT call attendance.service.ts functions.** I will query Prisma directly.

**Attendance rate formula I will use (same as Ticket 7):**
```typescript
const attendanceRate = total > 0
  ? Math.round(((presentCount + lateCount) / total) * 100)
  : 0;
```
- PRESENT → attended
- LATE → attended
- ABSENT → not attended
- EXCUSED → counted in total, not attended (matches Ticket 7)

### From Ticket 8 — Assessment

I will query:
- `prisma.assessment` — has `batchId`, `maxScore`, `assessmentDate`, `title`, `type`
- `prisma.assessmentResult` — has `assessmentId`, `studentId`, `score`

**Assessment percentage formula:**
```typescript
// Per result:
const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;

// Aggregated average (average of percentages, NOT average of raw scores):
const averagePercentage = resultCount > 0
  ? Math.round((sumOfPercentages / resultCount) * 100) / 100
  : 0;
```

**Why average of percentages, not raw scores:**
- Student scores 8/10 on Quiz A and 40/50 on Quiz B
- Percentages: 80% and 80%
- Correct average: 80%
- Wrong (raw average): (8 + 40) / 2 = 24 ← meaningless across different maxScores

**maxScore = 0 → percentage = 0** (safe division handling)

### From Ticket 9 — Feedback

I will query `prisma.feedback` which has:
- `sessionId` — links to session (and through session to batch)
- `studentId` — who received the feedback
- `effortRating` — integer 1 to 5
- `participationRating` — integer 1 to 5
- `comments` — optional text
- `createdAt` — when

**Feedback average formula:**
```typescript
const avgEffort = count > 0
  ? Math.round((sumEffort / count) * 10) / 10
  : 0;

const avgParticipation = count > 0
  ? Math.round((sumParticipation / count) * 10) / 10
  : 0;
```

---

## Date Filtering

Optional `from` and `to` query params on all endpoints.

- **Attendance** — filter via `Session.scheduledDate` (join attendance → session)
- **Feedback** — filter via `Session.scheduledDate` (join feedback → session)
- **Assessment** — filter via `Assessment.assessmentDate`

---

## 4 Endpoints I Will Create

### 1. GET /api/engagement/dashboard

**What it does:** Platform-wide summary across all batches.

**Queries:**
- `prisma.batchMember` — count distinct students
- `prisma.batch` — count batches
- `prisma.session` — count sessions (with optional date filter)
- `prisma.attendance` — aggregate counts by status
- `prisma.assessmentResult` + `prisma.assessment` — compute per-result percentages, average them
- `prisma.feedback` — average effort and participation ratings
- Per-batch breakdown of the above

**Returns:**
```
totalStudents, totalBatches, totalSessions,
averageAttendanceRate, averageAssessmentScore, averageEffortRating, averageParticipationRating,
batches: [{ batchId, batchName, studentCount, attendanceRate, averageAssessmentScore, averageEffortRating, averageParticipationRating }]
```

**Empty data:** Returns 0 for metrics and empty array for batches. No errors thrown.

### 2. GET /api/engagement/batch/:batchId

**What it does:** Detailed engagement for one batch.

**Queries:**
- `prisma.batch` — batch info (404 if not found)
- `prisma.batchMember` — student count and student list
- `prisma.session` — sessions for this batch (with optional date filter)
- `prisma.attendance` — records for sessions in this batch
- `prisma.assessment` + `prisma.assessmentResult` — for this batch
- `prisma.feedback` — for sessions in this batch
- Per-student aggregation of attendance, assessment, feedback

**Returns:**
```
batch: { id, name, department, startDate },
studentCount, sessionCount, assessmentCount,
attendance: { averageRate, totalRecords, presentCount, lateCount, absentCount, excusedCount },
assessments: { averageScore, averagePercentage, totalResults },
feedback: { averageEffortRating, averageParticipationRating, totalFeedbackCount },
students: [{ studentId, studentName, studentEmail, attendanceRate, assessmentAverage, effortRating, participationRating }]
```

### 3. GET /api/engagement/student/:studentId

**What it does:** Engagement profile for one student.

**Queries:**
- `prisma.user` — student info (404 if not found)
- `prisma.attendance` — all records for this student (optionally filtered by batchId via session, and date range)
- `prisma.assessmentResult` + `prisma.assessment` — all results for this student
- `prisma.feedback` — all feedback for this student

**Returns:**
```
student: { id, name, email, department, year },
attendance: { totalRecords, presentCount, lateCount, absentCount, excusedCount, attendanceRate },
assessments: { totalAssessments, averageScore, averagePercentage, results: [{ assessmentId, title, type, score, maxScore, percentage, assessmentDate }] },
feedback: { totalFeedback, averageEffortRating, averageParticipationRating, recentFeedback: [{ sessionId, sessionTitle, effortRating, participationRating, comments, createdAt }] }
```

### 4. GET /api/engagement/batch/:batchId/trends

**What it does:** Time-ordered data points for charts.

**Queries:**
- `prisma.batch` — batch info (404 if not found)
- `prisma.session` — sessions for this batch, ordered by scheduledDate
- `prisma.attendance` — grouped per session
- `prisma.assessment` — for this batch, ordered by assessmentDate
- `prisma.assessmentResult` — grouped per assessment
- `prisma.feedback` — grouped per session

**Returns:**
```
batch: { id, name },
attendance: [{ sessionId, sessionTitle, scheduledDate, presentCount, totalCount, attendanceRate }],
assessments: [{ assessmentId, title, type, assessmentDate, averageScore, maxScore, averagePercentage, resultCount }],
feedback: [{ sessionId, sessionTitle, scheduledDate, averageEffortRating, averageParticipationRating, feedbackCount }]
```

---

## Files I Will Create

| File | Purpose |
|------|---------|
| `src/validators/engagement.validator.ts` | Joi schemas: UUID params, optional from/to/batchId queries |
| `src/services/engagement.service.ts` | All Prisma queries and aggregation logic |
| `src/controllers/engagement.controller.ts` | Request → service → sendSuccess/sendError |
| `src/routes/engagement.routes.ts` | Express Router with 4 GET routes |

## File I Will Modify (Minimally)

| File | Change |
|------|--------|
| `src/server.ts` | Add 1 import line + 1 `app.use` line |

The server.ts change:
```typescript
import engagementRoutes from './routes/engagement.routes';
// ...
app.use('/api/engagement', authenticateJwt, engagementRoutes);
```

---

## Files I Will NOT Touch

- attendance.service.ts, attendance.controller.ts, attendance.routes.ts, attendance.validator.ts
- assessments.service.ts, assessments.controller.ts, assessments.routes.ts, assessments.validator.ts
- feedback.service.ts, feedback.controller.ts, feedback.routes.ts, feedback.validator.ts
- schema.prisma
- package.json
- Any migration, frontend, or ML file

---

## Conventions I Will Follow

| Convention | What I Will Use |
|------------|-----------------|
| Validation | Joi + `validate(schema, 'query'` or `'params')` |
| Responses | `sendSuccess(res, data)` and `sendError(res, message, code)` |
| Errors | `ServiceError` class with `statusCode` |
| Controller pattern | try/catch → handleServiceError |
| Prisma | `import prisma from '../lib/prisma'` |
| Auth | `authenticateJwt` applied in `server.ts` |
| Router | `Router()` from express, default export |

---

## How I Handle Edge Cases

| Case | Behavior |
|------|----------|
| No attendance records | attendanceRate = 0 |
| No assessment results | averageAssessmentScore = 0 |
| No feedback | averageEffortRating = 0, averageParticipationRating = 0 |
| maxScore = 0 | percentage = 0 (no division by zero) |
| Batch not found | ServiceError 404 |
| Student not found | ServiceError 404 |
| Invalid UUID | Joi returns 400 before controller runs |
| No batches exist | Dashboard returns zeros and empty batches array |

---

## Performance Approach

- Fetch attendance/assessment/feedback records in bulk per batch/session, not per student
- Use Prisma `findMany` with `where: { sessionId: { in: sessionIds } }` pattern
- Aggregate in application code from bulk-fetched data
- No N+1 queries
- No HTTP calls to other backend routes
