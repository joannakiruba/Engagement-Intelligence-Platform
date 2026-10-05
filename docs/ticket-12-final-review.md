# Ticket 12 — Final Review Before Implementation

---

## Plan Document

Located at: `docs/ticket-12-plan.md`

### Contents:
- Section 1: Current repository state (main branch, clean working tree)
- Section 2: Ticket 7 Attendance — models, fields, formula, READ-ONLY files
- Section 3: Ticket 8 Assessment — models, fields, percentage formula, READ-ONLY files
- Section 4: Ticket 9 Feedback — model, fields, rating scale, READ-ONLY files
- Section 5: Supporting models (Batch, BatchMember, User)
- Section 6: Backend conventions (Joi, sendSuccess/sendError, ServiceError, authenticateJwt, Prisma)
- Section 7: Ticket 12 files to create (4 new + 1 modified)
- Section 8: Files NOT modified (all Ticket 7/8/9 files, schema, package.json, frontend, ML)
- Section 9: API endpoints (4 GET endpoints with params and return shapes)
- Section 10: Data aggregation strategy (architecture, data sources, calculations, date filtering, performance)
- Section 11: Error handling (400, 404, global handler, empty data safe)
- Section 12: Critical rule — no modification of Tickets 7, 8, 9
- Section 13: Assumptions (9 items)

---

## Understanding Document

Located at: `docs/ticket-12-understanding.md`

### Contents:
- What Ticket 12 IS and is NOT
- Existing data read from Ticket 7 (Attendance — prisma.attendance, prisma.session)
- Existing data read from Ticket 8 (Assessment — prisma.assessment, prisma.assessmentResult)
- Existing data read from Ticket 9 (Feedback — prisma.feedback)
- All three formulas with TypeScript code samples
- Date filtering strategy (Session.scheduledDate for attendance/feedback, Assessment.assessmentDate for assessments)
- All 4 endpoints with queries, params, and return shapes
- Files to create (4 new files)
- File to modify (server.ts — 1 import + 1 app.use line)
- Files NOT touched (all Ticket 7/8/9 files listed)
- Conventions followed (Joi, sendSuccess, ServiceError, authenticateJwt, Router)
- Edge case handling table (8 cases)
- Performance approach (bulk fetch, no N+1, no HTTP calls)

---

## Key Formulas

### Attendance Rate (matches Ticket 7)
```typescript
const attendanceRate = total > 0
  ? Math.round(((presentCount + lateCount) / total) * 100)
  : 0;
```

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

## Files Summary

### NEW (Ticket 12 only)
```
backend-api/src/validators/engagement.validator.ts
backend-api/src/services/engagement.service.ts
backend-api/src/controllers/engagement.controller.ts
backend-api/src/routes/engagement.routes.ts
```

### MODIFIED (minimal)
```
backend-api/src/server.ts  →  add 1 import + 1 app.use line
```

### NOT TOUCHED
```
backend-api/src/services/attendance.service.ts
backend-api/src/controllers/attendance.controller.ts
backend-api/src/routes/attendance.routes.ts
backend-api/src/validators/attendance.validator.ts
backend-api/src/services/assessments.service.ts
backend-api/src/controllers/assessments.controller.ts
backend-api/src/routes/assessments.routes.ts
backend-api/src/validators/assessments.validator.ts
backend-api/src/services/feedback.service.ts
backend-api/src/controllers/feedback.controller.ts
backend-api/src/routes/feedback.routes.ts
backend-api/src/validators/feedback.validator.ts
backend-api/src/prisma/schema.prisma
backend-api/package.json
All frontend files
All ML service files
All migration files
```

---

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/engagement/dashboard` | Platform-wide engagement summary |
| GET | `/api/engagement/batch/:batchId` | Batch-level engagement detail |
| GET | `/api/engagement/student/:studentId` | Student-level engagement profile |
| GET | `/api/engagement/batch/:batchId/trends` | Time-series trends for a batch |

---

## Critical Rule

**Ticket 12 must not modify, refactor, or change any existing calculation, response structure, validation, or business logic from Tickets 7, 8, or 9. It must consume their existing database data exactly as implemented.**
