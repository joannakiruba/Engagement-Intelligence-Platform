# Ticket 10 — Task Assignment Module: Implementation Summary

**Branch:** `ticket-10`
**Owner:** Rinee (Harinee S) — Backend + Database (Node/Express, Prisma, PostgreSQL)
**Base:** Mirrors `main` from https://github.com/joannakiruba/Engagement-Intelligence-Platform

---

## What This Ticket Does

Adds a **Task Assignment** system to the HOPE Engagement Intelligence Platform. Trainers create tasks (homework, practice problems, reading assignments) targeted at one or more batches. Students self-report their progress. Trainers/faculty can optionally award internal marks. The system tracks deadlines, late completions, and feeds stats into the risk engine.

This is **separate from Assessments** — assessments are scored evaluations; tasks are trackable assignments with self-reported progress.

---

## Subtask 1: Schema + Migration + Permissions (This Commit)

### Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `backend-api/src/prisma/schema.prisma` | Modified | Added 2 new enums, 4 new models, back-relations on User and Batch |
| `backend-api/src/prisma/permission-catalog.ts` | Modified | Added 12 new permission codes and assigned them to roles |
| `backend-api/src/prisma/migrations/20260929_ticket10_task_assignment/migration.sql` | New | SQL migration for all new tables, enums, indexes, and foreign keys |
| `backend-api/src/providers/task.provider.ts` | New | Risk engine provider: `getTaskStats(studentId, batchId)` |
| `docs/ticket-10-summary.md` | New | This file |

---

### Schema Changes — Detailed

#### New Enums

**`DeadlineType`** — Controls how task deadlines are interpreted:
- `FIXED` — Exact datetime; enforced by the system (isLate is computed from this)
- `TENTATIVE` — Advisory date with a note; not enforced
- `TBD` — Date not yet decided; deadlineNote explains why
- `NONE` — No deadline at all

**Reason:** The design doc established that tasks need flexible deadline semantics. A single nullable `DateTime` field cannot distinguish "no deadline" from "deadline not yet set" from "soft/advisory deadline." The enum makes each case explicit and enforceable at the validation layer.

**`TaskProgress`** — Self-reported student progress:
- `NOT_STARTED` — Default; also the implicit state for late-joiners (via LEFT JOIN, no row exists)
- `IN_PROGRESS` — Student has begun work
- `ALMOST_COMPLETED` — Student is nearly done
- `COMPLETED` — Student self-reports completion (triggers `completedAt` and `isLate` computation)

**Reason:** The design doc decided on self-reported progress (not system-verified) with the ability to move backwards, including back from COMPLETED. Four discrete states give trainers a meaningful progress overview without requiring proof upload (which is a separate module).

#### Modified Enum

**`NotificationType`** — Added `TASK_UPDATE` value.

**Reason:** Additive change to support task-related notifications. The actual notification dispatch is deferred (pending senior decision on in-app vs email), but the enum value is needed now so the schema is complete. Adding enum values later would require another migration.

#### New Models

**`Task`** (table: `tasks`) — The main entity:

| Column | Type | Why |
|--------|------|-----|
| `id` | UUID PK | Matches project convention (all models use UUID PKs) |
| `title` | String, required | Task name shown to students and trainers |
| `description` | String, optional | Longer instructions/context |
| `isMandatory` | Boolean, default true | Mandatory tasks affect risk; optional ones don't. Design doc: "Mandatory (default)" |
| `isInternal` | Boolean, default false | When true, this task has marks (maxMarks required). Most tasks have no marks |
| `maxMarks` | Float, nullable | Required and positive when isInternal=true; validated at the service layer, not DB constraint, because cross-column CHECK constraints don't compose well with Prisma |
| `deadlineType` | DeadlineType, default NONE | See enum rationale above |
| `deadline` | DateTime, nullable | The actual deadline; required when deadlineType=FIXED, must be null otherwise |
| `deadlineNote` | String, nullable | Allowed for TENTATIVE and TBD; human-readable note about the deadline |
| `closedAt` | DateTime, nullable | When set, task is hidden from students, no progress changes allowed; trainers still see it. Null = open |
| `createdById` | FK → User | Who created the task; needed for audit trail |
| `createdAt` / `updatedAt` | Timestamps | Standard project convention |

**Reason for separate table (not reusing Assessment):** The design doc explicitly decided "Separate tables, never Assessment/AssessmentResult." Tasks have fundamentally different semantics — self-reported progress vs. scored evaluations, multi-batch targeting vs. single-batch, flexible deadlines vs. fixed assessment dates.

**`TaskBatch`** (table: `task_batches`) — Join table for task ↔ batch (many-to-many):

| Column | Type | Why |
|--------|------|-----|
| `taskId` | FK → Task | Composite PK part 1 |
| `batchId` | FK → Batch | Composite PK part 2 |

**Reason:** A task can target multiple batches (e.g., "Complete chapter 5 exercises" assigned to both Batch Alpha and Batch Beta). A join table is the standard relational pattern. Both FKs cascade on delete — if a task or batch is removed, the association goes with it.

**`TaskDeadlineChange`** (table: `task_deadline_changes`) — Audit trail for deadline changes:

| Column | Type | Why |
|--------|------|-----|
| `id` | UUID PK | Standard |
| `taskId` | FK → Task | Which task's deadline changed |
| `oldDeadlineType` / `newDeadlineType` | DeadlineType | What it was → what it became |
| `oldDeadline` / `newDeadline` | DateTime, nullable | The actual datetime values (null if type wasn't FIXED) |
| `reason` | String, nullable | Why the change was made (trainer provides this) |
| `changedById` | FK → User | Who made the change |
| `createdAt` | Timestamp | When the change happened |

**Reason:** The design doc requires: "Every change recorded in TaskDeadlineChange" and "Students never see deadline history — only current deadline/note." This table serves as an audit log specifically for deadline changes. Generic AuditLog could theoretically hold this, but a dedicated table gives typed columns (old/new type, old/new deadline) instead of unstructured JSON, which makes querying and validation straightforward.

**`TaskSubmission`** (table: `task_submissions`) — Per-student progress tracking:

| Column | Type | Why |
|--------|------|-----|
| `id` | UUID PK | Standard |
| `taskId` | FK → Task | Which task |
| `studentId` | FK → User | Which student |
| `progress` | TaskProgress, default NOT_STARTED | Self-reported status |
| `isInterested` | Boolean, default false | For optional tasks: student explicitly opted in |
| `completedAt` | DateTime, nullable | Set to server time when progress → COMPLETED; cleared if student moves back |
| `isLate` | Boolean, nullable | Computed: was completedAt after task.deadline? Null if not yet completed or no FIXED deadline |
| `marksAwarded` | Float, nullable | Only for isInternal tasks; between 0 and task.maxMarks |
| `gradedById` | FK → User, nullable | Who awarded the marks |
| `createdAt` / `updatedAt` | Timestamps | Standard |

**Unique constraint:** `@@unique([taskId, studentId])` — One submission row per student per task.

**Reason for the "implicit NOT_STARTED via LEFT JOIN" design:** The design doc decided that late-joiners and batch-added students should NOT trigger backfill. Instead, queries join `BatchMember → TaskBatch → Task, LEFT JOIN TaskSubmission`. A missing row = NOT_STARTED. A TaskSubmission row is only created when a student takes action (progress update, interested). This eliminates:
- Backfill logic (no cron job, no batch module changes)
- Timing edge cases (student added at midnight, task created before/after)
- N×M row creation on task creation for optional tasks

For **mandatory** tasks, the service layer bulk-creates TaskSubmission rows at task creation time for all students currently in the target batches (with progress=NOT_STARTED). This gives trainers immediate visibility into the full roster.

#### Back-Relations on Existing Models

**User** — Added 4 relations:
- `createdTasks` → Task[] (via "TaskCreator")
- `taskSubmissions` → TaskSubmission[] (via "TaskStudent")
- `gradedTaskSubmissions` → TaskSubmission[] (via "TaskGrader")
- `taskDeadlineChanges` → TaskDeadlineChange[] (via "TaskDeadlineChanger")

**Reason:** Prisma requires explicit back-relations for every FK. The relation names are disambiguated because a single User can be the task creator, the student being tracked, the grader, and the deadline changer — each is a different semantic role.

**Batch** — Added 1 relation:
- `taskBatches` → TaskBatch[]

**Reason:** Enables navigating from a batch to all tasks targeting it.

---

### Permission Changes — Detailed

12 new permission codes added, following the existing `:scope` convention:

| Code | Description | Assigned To | Reason |
|------|-------------|-------------|--------|
| `tasks:create:batch` | Create tasks for own batch | TRAINER | Trainers create tasks for batches they're assigned to (BatchTrainer check) |
| `tasks:create:any` | Create tasks for any batch | ADMIN | Admin bypasses batch restriction |
| `tasks:read:own` | Read tasks in own batches (student) | STUDENT | Students see tasks assigned to their batches |
| `tasks:read:batch` | Read tasks for own batch (trainer) | TRAINER | Trainers see tasks for batches they train |
| `tasks:read:any` | Read any task | FACULTY, COORDINATOR, ADMIN | Oversight roles see everything |
| `tasks:update:own` | Update own progress / interest | STUDENT | Students update their own TaskSubmission |
| `tasks:update:batch` | Edit tasks for own batch | TRAINER | Any trainer of a target batch can edit (not just creator) |
| `tasks:update:any` | Edit any task | ADMIN | Admin bypasses batch restriction |
| `tasks:delete:batch` | Delete tasks for own batch | TRAINER | Trainers can delete tasks (with confirmation if engaged) |
| `tasks:delete:any` | Delete any task | ADMIN | Admin bypasses batch restriction |
| `tasks:grade:batch` | Grade internal tasks for own batch | TRAINER | Trainers grade only students in their assigned batches |
| `tasks:grade:any` | Grade any internal task | FACULTY, ADMIN | Faculty can grade any internal task; Admin can too |

**Why Faculty gets `tasks:grade:any`:** The design doc explicitly decided: "Faculty: can grade any internal task (tasks:grade:any)." This allows faculty oversight of internal marks without batch restrictions.

**Why Coordinator gets only `tasks:read:any`:** Coordinators track placement-readiness (they already have risk_scores:read:any). They need visibility into task completion but don't create/edit tasks — that's the trainer's job.

**Why Mentor gets no task permissions:** Tasks are not yet wired into the risk engine's intervention workflow. Mentors act on risk scores, not directly on tasks. The task provider feeds data into the risk engine, which then triggers mentor alerts through the existing pipeline. If needed later, `tasks:read:assigned` can be added.

---

### Migration SQL

File: `backend-api/src/prisma/migrations/20260929_ticket10_task_assignment/migration.sql`

The migration:
1. Creates `DeadlineType` and `TaskProgress` enums
2. Adds `TASK_UPDATE` to `NotificationType` (uses `ALTER TYPE ... ADD VALUE`, which is non-transactional in Postgres — standard for enum extension)
3. Creates `tasks` table with all columns and PK
4. Creates `task_batches` join table with composite PK
5. Creates `task_deadline_changes` audit table
6. Creates `task_submissions` table with unique index on (taskId, studentId)
7. Adds all foreign key constraints

**FK cascade decisions:**
- `tasks.createdById → users.id`: RESTRICT (don't delete a user who created tasks)
- `task_batches → tasks/batches`: CASCADE (if either is deleted, remove the association)
- `task_deadline_changes → tasks`: CASCADE (delete history when task is deleted)
- `task_deadline_changes → users`: RESTRICT (keep the audit trail author)
- `task_submissions → tasks`: CASCADE (delete submissions when task is deleted)
- `task_submissions.studentId → users`: RESTRICT (don't delete a student with submissions)
- `task_submissions.gradedById → users`: SET NULL (if grader is deleted, keep the grade, lose the grader reference)

---

### Risk Engine Provider

File: `backend-api/src/providers/task.provider.ts`

Exports `getTaskStats(studentId, batchId)` → `{ missedCount, lateCount, totalMandatory }`

This follows the exact same pattern as the existing providers:
- `attendance.provider.ts` → `getAttendanceStats(studentId, batchId)`
- `assessment.provider.ts` → `getAssessmentStats(studentId, batchId)`
- `feedback.provider.ts` → `getFeedbackStats(studentId, batchId)`

**How it works:**
1. Finds all tasks targeting the given batch (via TaskBatch join)
2. Filters to mandatory, non-closed tasks
3. Looks up the student's submissions
4. For each mandatory task with a FIXED deadline in the past:
   - No submission or not COMPLETED → missedCount++
   - Completed but isLate → lateCount++
5. Returns the counts

**What's NOT done here (by design):** Wiring this into `feature-builder.ts`, `rule-engine.ts`, or the ML payload is the risk-engine teammate's job. The provider function is the clean integration seam — they call it, they decide the weight.

---

## Subtasks Remaining

| # | Subtask | Status |
|---|---------|--------|
| 1 | Schema + migration + permissions | **Done** (this commit) |
| 2 | Create & distribute task (API) | **Done** |
| 3 | Edit task (API) | **Done** |
| 4 | Trainer task list & details (API) | **Done** |
| 5 | Change deadline (API) | Not started |
| 6 | Close / reopen / delete (API) | Not started |
| 7 | Student my-tasks (API) | Not started |
| 8 | Student progress update (API) | Not started |
| 9 | Interested + manual add (API) | Not started |
| 10 | Marks — set/change/export (API) | Not started |
| 11 | Risk engine query + notification seam | Not started |

---

## Subtask 2: Create & Distribute Task (API)

### Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `backend-api/src/validators/tasks.validator.ts` | New | Joi schema for `POST /api/tasks` — cross-field validation for isInternal↔maxMarks, deadlineType↔deadline↔deadlineNote |
| `backend-api/src/services/tasks.service.ts` | New | `createTask()` — batch validation, scope-based auth, atomic transaction (Task + TaskBatch + TaskSubmission), initial deadline audit |
| `backend-api/src/controllers/tasks.controller.ts` | New | `createTaskHandler()` — extracts scope and userId from request, delegates to service |
| `backend-api/src/routes/tasks.routes.ts` | New | `POST /` with requirePermission + resolveScope + validate + handler chain |
| `backend-api/src/server.ts` | Modified | Added `import taskRoutes` and `app.use('/api/tasks', authenticateJwt, taskRoutes)` |

### Endpoint

**`POST /api/tasks`** — Create a task and distribute to batches

**Auth:** JWT required → `requirePermission('tasks:create:batch', 'tasks:create:any')` → `resolveScope('tasks')`

**Request body:**
```json
{
  "title": "Complete Chapter 5 Exercises",
  "description": "Practice problems from the textbook",
  "batchIds": ["uuid-1", "uuid-2"],
  "isMandatory": true,
  "isInternal": false,
  "deadlineType": "FIXED",
  "deadline": "2026-10-05T23:59:00.000Z"
}
```

**Validation rules (Joi + custom):**
- `title`: required, non-empty string
- `batchIds`: required array of UUIDs, min 1
- `isMandatory`: optional boolean, defaults `true`
- `isInternal`: optional boolean, defaults `false`
- `maxMarks`: required & positive when `isInternal=true`; rejected otherwise
- `deadlineType`: optional enum (`FIXED`, `TENTATIVE`, `TBD`, `NONE`), defaults `NONE`
- `deadline`: required ISO datetime (must be future) when `deadlineType=FIXED`; rejected otherwise
- `deadlineNote`: optional string, allowed only when deadlineType is `TENTATIVE` or `TBD`

**Service logic:**
1. Validate all batchIds exist (404 if any missing)
2. If scope is `batch` (trainer), check BatchTrainer for every batchId (403 if unauthorized)
3. In a single Prisma `$transaction`:
   - Create Task with TaskBatch join rows
   - If `deadlineType !== NONE`: create initial TaskDeadlineChange audit entry (old=NONE → new=chosen type)
   - If `isMandatory`: bulk-create TaskSubmission rows for all students in target batches (deduplicated across batches)
4. Return full task with batches, submissions, and submissionCount

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "task-uuid",
    "title": "Complete Chapter 5 Exercises",
    "isMandatory": true,
    "isInternal": false,
    "deadlineType": "FIXED",
    "deadline": "2026-10-05T23:59:00.000Z",
    "createdBy": { "id": "...", "name": "Trainer User", "email": "..." },
    "taskBatches": [
      { "taskId": "...", "batchId": "...", "batch": { "id": "...", "name": "Batch Alpha 2026" } }
    ],
    "submissions": [
      { "id": "...", "taskId": "...", "studentId": "...", "progress": "NOT_STARTED" }
    ],
    "submissionCount": 13
  }
}
```

**Design decisions applied:**
- Atomic: all batchIds valid or entire request fails
- Mandatory tasks get bulk submissions, optional tasks get none
- Students in multiple target batches get one row (deduplicated via `Set`)
- `createdById` from JWT (`req.user.sub`), never from request body
- Initial deadline logged in TaskDeadlineChange (old=NONE → new=whatever was chosen)
- Scope-based auth: trainers must be BatchTrainer for every batchId; admin/any scope skips check

---

## Subtask 3: Edit Task (`PUT /api/tasks/:id`)

### Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `backend-api/src/validators/tasks.validator.ts` | Modified | Added `updateTaskSchema` — optional fields with cross-field validation for isInternal↔maxMarks, `.unique()` on addBatchIds, `.min(1)` requiring at least one field |
| `backend-api/src/services/tasks.service.ts` | Modified | Added `updateTask()` function and `notifyStudents()` helper — validates task exists and not closed, scope-based trainer auth, guards against data integrity issues, atomic transaction |
| `backend-api/src/controllers/tasks.controller.ts` | Modified | Added `updateTaskHandler()` — extracts scope from `heldPermissions.has('tasks:update:any')`, passes taskId from `req.params.id` |
| `backend-api/src/routes/tasks.routes.ts` | Modified | Added `PUT /:id` route with requirePermission + validate + updateTaskHandler |

### Endpoint

**`PUT /api/tasks/:id`** — Edit an existing task

**Auth:** JWT required → `requirePermission('tasks:update:batch', 'tasks:update:any')`

**Important:** No `resolveScope` middleware — scope is derived directly from `heldPermissions.has('tasks:update:any')` in the controller. See "resolveScope bypass" note in Subtask 2.

**Request body (all fields optional, min 1 required):**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "isMandatory": true,
  "isInternal": true,
  "maxMarks": 50,
  "addBatchIds": ["uuid-3"]
}
```

**Validation rules (Joi + custom):**
- `title`: optional, non-empty string
- `description`: optional, allows empty string and null
- `isMandatory`: optional boolean
- `isInternal`: optional boolean
- `maxMarks`: optional positive number or null
- `addBatchIds`: optional array of UUIDs with `.unique()`
- Cross-field: if `isInternal=false` and `maxMarks` is provided (non-null), rejected
- At least one field must be present (`.min(1)`)

**Service logic:**
1. Fetch existing task with taskBatches (404 if not found)
2. Reject if task is closed (`closedAt` is set → 409)
3. If scope is `batch`, check that updater is a BatchTrainer for at least one of the task's existing batches (403 if not)
4. **isInternal toggle guards:**
   - If setting `isInternal=true`: maxMarks must be present or already set on the task (400 if missing)
   - If setting `isInternal=false`: check if any student has `marksAwarded` — reject with 409 if so (must remove marks first)
5. **maxMarks lowering guard:** If lowering maxMarks below current value, check if any student's `marksAwarded` exceeds the new max — reject with 409 if so
6. **addBatchIds processing:**
   - Filter out batch IDs already on the task (idempotent)
   - Validate new batch IDs exist (404 if any missing)
   - If scope is `batch`, check BatchTrainer auth for new batches (403 if unauthorized)
7. In a single Prisma `$transaction`:
   - Update task fields
   - If `isInternal` set to false: clear maxMarks to null
   - Create TaskBatch rows for new batches
   - If task is mandatory (resolved): bulk-create TaskSubmission rows for students in new batches (deduplicated against existing submissions)
   - If `isMandatory` toggled false→true: backfill TaskSubmission rows for all students across all batches (deduplicated)
   - Send TASK_UPDATE notifications to all students with submissions (describes what changed)
8. Return full updated task with batches and submissions

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "task-uuid",
    "title": "Updated Title",
    "isMandatory": true,
    "isInternal": true,
    "maxMarks": 50,
    "createdBy": { "id": "...", "name": "...", "email": "..." },
    "taskBatches": [...],
    "submissions": [...]
  }
}
```

**Design decisions applied:**
- Closed tasks cannot be edited (409) — must reopen first (Subtask 6)
- Trainer scope checks against existing task batches, not all batches globally
- `addBatchIds` only (no remove) — removing batches with existing submissions is deferred
- isInternal→false blocked if students have marks (data integrity)
- maxMarks lowering blocked if any student exceeds new max (data integrity)
- isMandatory false→true backfills submissions for all students who don't have one yet
- Existing submissions are always preserved regardless of changes
- Notifications sent to all students with submissions on any edit

---

## Subtask 4: Trainer Task List & Details (API)

### Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `backend-api/src/services/tasks.service.ts` | Modified | Added `listTasks()` and `getTaskById()` — scope-filtered queries with pagination, progress counts, and detail includes |
| `backend-api/src/controllers/tasks.controller.ts` | Modified | Added `listTasksHandler()` and `getTaskHandler()` — query param parsing, scope derivation from `heldPermissions` |
| `backend-api/src/routes/tasks.routes.ts` | Modified | Added `GET /` and `GET /:id` routes with `requirePermission('tasks:read:batch', 'tasks:read:any')` |

### Endpoints

#### `GET /api/tasks` — List tasks (paginated)

**Auth:** JWT required → `requirePermission('tasks:read:batch', 'tasks:read:any')`

**Query parameters (all optional):**
- `batchId` — Filter by batch UUID
- `isMandatory` — `true` or `false`
- `isInternal` — `true` or `false`
- `deadlineType` — `FIXED`, `TENTATIVE`, `TBD`, `NONE`
- `status` — `open` (closedAt is null) or `closed` (closedAt is set)
- `search` — Case-insensitive title substring search
- `page` — Page number (default 1)
- `limit` — Items per page (default 20, max 100)

**Scope behavior:**
- `tasks:read:any` → sees all tasks (admin, faculty, coordinator)
- `tasks:read:batch` → only tasks targeting batches the trainer is assigned to (BatchTrainer lookup)
- If `batchId` filter is provided with batch scope, it naturally limits to that batch

**Response (200):** Uses `sendPaginated` — first usage in the codebase (utility existed but was unused):
```json
{
  "success": true,
  "data": [
    {
      "id": "task-uuid",
      "title": "Complete Chapter 5",
      "isMandatory": true,
      "isInternal": false,
      "maxMarks": null,
      "deadlineType": "FIXED",
      "deadline": "2026-10-05T23:59:00.000Z",
      "closedAt": null,
      "createdBy": { "id": "...", "name": "...", "email": "..." },
      "taskBatches": [{ "taskId": "...", "batchId": "...", "batch": { "id": "...", "name": "..." } }],
      "submissionCount": 13,
      "progressCounts": { "NOT_STARTED": 5, "IN_PROGRESS": 4, "ALMOST_COMPLETED": 2, "COMPLETED": 2 }
    }
  ],
  "pagination": { "total": 42, "page": 1, "limit": 20, "pages": 3 }
}
```

#### `GET /api/tasks/:id` — Task detail with submissions

**Auth:** Same as list

**Query parameters:**
- `progress` — Filter submissions by progress status (`NOT_STARTED`, `IN_PROGRESS`, `ALMOST_COMPLETED`, `COMPLETED`)

**Response (200):** Full task with all submissions (including student info and grader), deadline change history, and progress counts. Progress counts are always computed from all submissions, even when the submissions list is filtered.

```json
{
  "success": true,
  "data": {
    "id": "task-uuid",
    "title": "...",
    "submissions": [
      {
        "id": "...",
        "studentId": "...",
        "student": { "id": "...", "name": "...", "email": "..." },
        "progress": "IN_PROGRESS",
        "marksAwarded": null,
        "gradedBy": null,
        "completedAt": null,
        "isLate": null
      }
    ],
    "deadlineChanges": [
      {
        "id": "...",
        "oldDeadlineType": "NONE",
        "newDeadlineType": "FIXED",
        "changedBy": { "id": "...", "name": "..." },
        "createdAt": "..."
      }
    ],
    "submissionCount": 13,
    "progressCounts": { "NOT_STARTED": 5, "IN_PROGRESS": 4, "ALMOST_COMPLETED": 2, "COMPLETED": 2 }
  }
}
```

**Design decisions:**
- List returns summary with progress counts (no full submission arrays) — frontend-friendly for table rendering
- Detail returns full submissions with student names/emails for the trainer's grading/review view
- Pagination via `sendPaginated` gives the frontend `total`/`pages` for building page controls
- Progress counts are always from all submissions (not just filtered ones) so the frontend can show status breakdown badges even when filtering
- Deadline change history included in detail for trainer audit visibility
- Scope check on detail happens after fetch (to include batch IDs in the check) — same pattern as updateTask

---

## Design Decisions Reference

All decisions are documented in the task assignment module design doc provided at the start of this ticket. Key ones affecting this subtask:

1. **Separate tables** — Never reuse Assessment/AssessmentResult
2. **Implicit NOT_STARTED** — LEFT JOIN pattern, no backfill for late-joiners
3. **Mandatory bulk-creates rows** — Optional doesn't
4. **FIXED deadline required future datetime at creation** — Enforced in service layer (Subtask 2)
5. **isLate recomputed on deadline change** — Done in same transaction (Subtask 5)
6. **Shortening deadline after completions needs confirm flag** — Enforced in service layer (Subtask 5)
7. **Students never see deadline history** — API design (Subtask 7)
8. **Node calls Python** — Task provider → feature-builder → risk-engine (Subtask 11)

---

## How to Run the Migration

```bash
cd backend-api
npx prisma migrate dev --name ticket10_task_assignment
npx prisma generate
```

Then re-seed to pick up the 12 new permissions:
```bash
SEED_TEST_PASSWORD="HopeTest2026!@dev" npm run seed
```

## If Something Breaks

- **Prisma validate fails:** Run `npx prisma validate` in `backend-api/` — check for relation mismatches
- **Migration fails:** The `ALTER TYPE ... ADD VALUE` for NotificationType is non-transactional in Postgres. If it partially applied, you may need to manually check enum values
- **Permission seed errors:** Ensure `permission-catalog.ts` compiles. All 12 new codes must exist in the PERMISSIONS array before being referenced in ROLE_PERMISSIONS
- **TypeScript errors:** Run `npx tsc --noEmit` — new back-relations on User/Batch should be auto-generated by `prisma generate`
