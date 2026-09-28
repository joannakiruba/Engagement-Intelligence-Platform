# Ticket 12 — Engagement Dashboard (Backend API)

## Final Review Before Implementation

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

## Critical Rule

**Ticket 12 must not modify, refactor, or change any existing calculation, response structure, validation, or business logic from Tickets 7, 8, or 9. It must consume their existing database data exactly as implemented.**

---

## Data I Will Read (Not Modify)

### From Ticket 7 — Attendance
- `prisma.attendance` → studentId, sessionId, status (PRESENT | ABSENT | LATE | EXCUSED)
- `prisma.session` → batchId, scheduledDate (for filtering)
- Will NOT call attendance.service.ts functions — query Prisma directly

### From Ticket 8 — Assessment
- `prisma.assessment` → batchId, maxScore, assessmentDate, title, type
- `prisma.assessmentResult` → assessmentId, studentId, score

### From Ticket 9 — Feedback
- `prisma.feedback` → sessionId, studentId, effortRating (1–5), participationRating (1–5), comments, createdAt

---

## Formulas

### Attendance Rate (matches Ticket 7 exactly)
```typescript
const attendanceRate = total > 0
  ? Math.round(((presentCount + lateCount) / total) * 100)
  : 0;
```
- PRESENT → attended
- LATE → attended
- ABSENT → not attended
- EXCUSED → counted in total, not attended (matches Ticket 7)

### Assessment Percentage (per result)
```typescript
const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
```

### Average Assessment Score (average of percentages, NOT raw scores)
```typescript
const averageAssessmentScore = resultCount > 0
  ? Math.round((sumOfPercentages / resultCount) * 100) / 100
  : 0;
```
Example: 8/10 and 40/50 → 80% and 80% → average 80% (not (8+40)/2 = 24)

### Feedback Averages
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

- Attendance → filter via `Session.scheduledDate`
- Feedback → filter via `Session.scheduledDate`
- Assessment → filter via `Assessment.assessmentDate`

---

## 4 Endpoints

### 1. GET /api/engagement/dashboard
Platform-wide summary across all batches.

**Query**: `?from=&to=` (optional)

**Returns**: totalStudents, totalBatches, totalSessions, averageAttendanceRate, averageAssessmentScore (avg percentage), averageEffortRating, averageParticipationRating, batches[]

### 2. GET /api/engagement/batch/:batchId
Detailed engagement for one batch.

**Params**: batchId (UUID)
**Query**: `?from=&to=` (optional)

**Returns**: batch info, studentCount, sessionCount, assessmentCount, attendance summary, assessments summary, feedback summary, students[] (per-student metrics)

### 3. GET /api/engagement/student/:studentId
Engagement profile for one student.

**Params**: studentId (UUID)
**Query**: `?batchId=&from=&to=` (optional)

**Returns**: student info, attendance summary, assessments (with individual results including percentage), feedback (with recent feedback list)

### 4. GET /api/engagement/batch/:batchId/trends
Time-ordered data points for charts.

**Params**: batchId (UUID)
**Query**: `?from=&to=` (optional)

**Returns**: batch info, attendance[] (per-session), assessments[] (per-assessment), feedback[] (per-session)

---

## Files

### NEW (Ticket 12 only)
```
backend-api/src/validators/engagement.validator.ts    → Joi schemas
backend-api/src/services/engagement.service.ts        → Aggregation logic via Prisma
backend-api/src/controllers/engagement.controller.ts  → Request → service → response
backend-api/src/routes/engagement.routes.ts           → Express Router, 4 GET routes
```

### MODIFIED (minimal)
```
backend-api/src/server.ts  → add 1 import + 1 app.use line:
  import engagementRoutes from './routes/engagement.routes';
  app.use('/api/engagement', authenticateJwt, engagementRoutes);
```

### NOT TOUCHED
```
attendance.service.ts, attendance.controller.ts, attendance.routes.ts, attendance.validator.ts
assessments.service.ts, assessments.controller.ts, assessments.routes.ts, assessments.validator.ts
feedback.service.ts, feedback.controller.ts, feedback.routes.ts, feedback.validator.ts
schema.prisma, package.json, frontend, ML service, migrations
```

---

## Conventions

| Convention | What I Will Use |
|------------|-----------------|
| Validation | Joi + `validate(schema, 'query'` or `'params')` |
| Responses | `sendSuccess(res, data)` and `sendError(res, message, code)` |
| Errors | `ServiceError` class with `statusCode` |
| Controller | try/catch → handleServiceError |
| Prisma | `import prisma from '../lib/prisma'` |
| Auth | `authenticateJwt` applied in `server.ts` |
| Router | `Router()` from express, default export |

---

## Edge Cases

| Case | Behavior |
|------|----------|
| No attendance records | attendanceRate = 0 |
| No assessment results | averageAssessmentScore = 0 |
| No feedback | averageEffortRating = 0, averageParticipationRating = 0 |
| maxScore = 0 | percentage = 0 (safe division) |
| Batch not found | ServiceError 404 |
| Student not found | ServiceError 404 |
| Invalid UUID | Joi returns 400 |
| No batches exist | Dashboard returns zeros and empty arrays |

---

## Performance

- Bulk queries with `findMany` + `where: { sessionId: { in: [...] } }`
- Aggregate in application code from bulk-fetched data
- No N+1 queries
- No HTTP calls to other backend routes

---

## Architecture

```
Route → Joi validation → Controller → Engagement Service → Prisma → PostgreSQL
```
