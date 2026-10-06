-- Schema consolidation: sync migration SQL with schema.prisma
-- Covers: AttendanceWindow, token model changes, Task models,
--         EventType lookup table, performance indexes, unique constraints

-- ══════════════════════════════════════════════════════════════
-- 1. New Enums
-- ══════════════════════════════════════════════════════════════

CREATE TYPE "DeadlineType" AS ENUM ('FIXED', 'TENTATIVE', 'TBD', 'NONE');
CREATE TYPE "TaskProgress" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'ALMOST_COMPLETED', 'COMPLETED');

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_UPDATE';

-- ══════════════════════════════════════════════════════════════
-- 2. AttendanceWindow table + Attendance.windowId
-- ══════════════════════════════════════════════════════════════

CREATE TABLE "attendance_windows" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendance_windows_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "attendance_windows" ADD CONSTRAINT "attendance_windows_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add windowId column to attendance (nullable initially for backfill)
ALTER TABLE "attendance" ADD COLUMN "windowId" TEXT;

-- Backfill: create a default window per session for any existing rows
DO $$
DECLARE
    sess RECORD;
    win_id TEXT;
BEGIN
    FOR sess IN SELECT DISTINCT "sessionId" FROM "attendance" WHERE "windowId" IS NULL LOOP
        win_id := gen_random_uuid();
        INSERT INTO "attendance_windows" ("id", "sessionId", "label", "startTime", "endTime")
        VALUES (win_id, sess."sessionId", 'Default Window',
                (SELECT "startTime" FROM "sessions" WHERE "id" = sess."sessionId"),
                (SELECT "endTime" FROM "sessions" WHERE "id" = sess."sessionId"));
        UPDATE "attendance" SET "windowId" = win_id
            WHERE "sessionId" = sess."sessionId" AND "windowId" IS NULL;
    END LOOP;
END $$;

ALTER TABLE "attendance" ALTER COLUMN "windowId" SET NOT NULL;

ALTER TABLE "attendance" ADD CONSTRAINT "attendance_windowId_fkey"
    FOREIGN KEY ("windowId") REFERENCES "attendance_windows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Replace unique constraint: (sessionId, studentId) → (windowId, studentId)
DROP INDEX IF EXISTS "attendance_sessionId_studentId_key";
CREATE UNIQUE INDEX "attendance_windowId_studentId_key" ON "attendance"("windowId", "studentId");

-- ══════════════════════════════════════════════════════════════
-- 3. RefreshToken structural changes
-- ══════════════════════════════════════════════════════════════

-- Rename token → tokenHash
ALTER TABLE "refresh_tokens" RENAME COLUMN "token" TO "tokenHash";
DROP INDEX IF EXISTS "refresh_tokens_token_key";
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- Add family tracking columns
ALTER TABLE "refresh_tokens" ADD COLUMN "familyId" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN "familyCreatedAt" TIMESTAMP(3);

-- Migrate revoked boolean → revokedAt timestamp
ALTER TABLE "refresh_tokens" ADD COLUMN "revokedAt" TIMESTAMP(3);
UPDATE "refresh_tokens" SET "revokedAt" = "createdAt" WHERE "revoked" = true;
ALTER TABLE "refresh_tokens" DROP COLUMN "revoked";

-- Backfill family columns for any existing tokens
UPDATE "refresh_tokens"
    SET "familyId" = "id", "familyCreatedAt" = "createdAt"
    WHERE "familyId" IS NULL;
ALTER TABLE "refresh_tokens" ALTER COLUMN "familyId" SET NOT NULL;
ALTER TABLE "refresh_tokens" ALTER COLUMN "familyCreatedAt" SET NOT NULL;

-- Update FK to cascade on user delete
ALTER TABLE "refresh_tokens" DROP CONSTRAINT "refresh_tokens_userId_fkey";
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");
CREATE INDEX IF NOT EXISTS "refresh_tokens_familyId_idx" ON "refresh_tokens"("familyId");

-- ══════════════════════════════════════════════════════════════
-- 4. AccountActivationToken table
-- ══════════════════════════════════════════════════════════════

CREATE TABLE "account_activation_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "account_activation_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "account_activation_tokens_tokenHash_key"
    ON "account_activation_tokens"("tokenHash");
CREATE INDEX "account_activation_tokens_userId_idx"
    ON "account_activation_tokens"("userId");

ALTER TABLE "account_activation_tokens" ADD CONSTRAINT "account_activation_tokens_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ══════════════════════════════════════════════════════════════
-- 5. PasswordResetToken table
-- ══════════════════════════════════════════════════════════════

CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key"
    ON "password_reset_tokens"("tokenHash");
CREATE INDEX "password_reset_tokens_userId_idx"
    ON "password_reset_tokens"("userId");

ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ══════════════════════════════════════════════════════════════
-- 6. Task tables
-- ══════════════════════════════════════════════════════════════

CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "maxMarks" DOUBLE PRECISION,
    "deadlineType" "DeadlineType" NOT NULL DEFAULT 'NONE',
    "deadline" TIMESTAMP(3),
    "deadlineNote" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "task_batches" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    CONSTRAINT "task_batches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_batches_taskId_batchId_key"
    ON "task_batches"("taskId", "batchId");

ALTER TABLE "task_batches" ADD CONSTRAINT "task_batches_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_batches" ADD CONSTRAINT "task_batches_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "task_submissions" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "progress" "TaskProgress" NOT NULL DEFAULT 'NOT_STARTED',
    "isInterested" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "isLate" BOOLEAN,
    "marksAwarded" DOUBLE PRECISION,
    "gradedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "task_submissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "taskId_studentId"
    ON "task_submissions"("taskId", "studentId");

ALTER TABLE "task_submissions" ADD CONSTRAINT "task_submissions_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_submissions" ADD CONSTRAINT "task_submissions_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_submissions" ADD CONSTRAINT "task_submissions_gradedById_fkey"
    FOREIGN KEY ("gradedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "task_deadline_changes" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "oldDeadlineType" "DeadlineType" NOT NULL,
    "newDeadlineType" "DeadlineType" NOT NULL,
    "oldDeadline" TIMESTAMP(3),
    "newDeadline" TIMESTAMP(3),
    "reason" TEXT,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_deadline_changes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "task_deadline_changes" ADD CONSTRAINT "task_deadline_changes_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_deadline_changes" ADD CONSTRAINT "task_deadline_changes_changedById_fkey"
    FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ══════════════════════════════════════════════════════════════
-- 7. EventType lookup table
-- ══════════════════════════════════════════════════════════════

CREATE TABLE "event_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "event_types_name_key" ON "event_types"("name");

-- Seed default event types from any existing event data
INSERT INTO "event_types" ("id", "name")
SELECT gen_random_uuid(), DISTINCT_TYPES.t
FROM (SELECT DISTINCT "eventType" AS t FROM "events") AS DISTINCT_TYPES
WHERE DISTINCT_TYPES.t IS NOT NULL
ON CONFLICT DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 7b. Network verification: enums, device_tokens, attendance_flags,
--     new columns on attendance + attendance_windows
-- ══════════════════════════════════════════════════════════════

CREATE TYPE "FlagReason" AS ENUM ('IP_MISMATCH', 'DEVICE_CONFLICT', 'DEVICE_RESET', 'MANUAL');
CREATE TYPE "FlagStatus" AS ENUM ('PENDING', 'CONFIRMED_FRAUD', 'DISMISSED');

-- Columns on attendance_windows for trainer network info
ALTER TABLE "attendance_windows" ADD COLUMN "trainerIp" TEXT;
ALTER TABLE "attendance_windows" ADD COLUMN "networkFingerprint" TEXT;

-- Columns on attendance for student network + device info
ALTER TABLE "attendance" ADD COLUMN "studentIp" TEXT;
ALTER TABLE "attendance" ADD COLUMN "networkFingerprint" TEXT;
ALTER TABLE "attendance" ADD COLUMN "deviceTokenId" TEXT;

CREATE TABLE "device_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "device_tokens_tokenHash_key" ON "device_tokens"("tokenHash");
CREATE INDEX "device_tokens_studentId_idx" ON "device_tokens"("studentId");

ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "attendance_flags" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "reason" "FlagReason" NOT NULL,
    "details" TEXT,
    "status" "FlagStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendance_flags_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "attendance_flags_studentId_idx" ON "attendance_flags"("studentId");
CREATE INDEX "attendance_flags_status_idx" ON "attendance_flags"("status");

ALTER TABLE "attendance_flags" ADD CONSTRAINT "attendance_flags_attendanceId_fkey"
    FOREIGN KEY ("attendanceId") REFERENCES "attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_flags" ADD CONSTRAINT "attendance_flags_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_flags" ADD CONSTRAINT "attendance_flags_reviewedBy_fkey"
    FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 7c. ML mentor alerts + outcomes — already created in migration 20260927_ml_mentor_alerts

-- ══════════════════════════════════════════════════════════════
-- 8. Performance Indexes
-- ══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS "sessions_batchId_idx" ON "sessions"("batchId");
CREATE INDEX IF NOT EXISTS "attendance_studentId_idx" ON "attendance"("studentId");
CREATE INDEX IF NOT EXISTS "attendance_sessionId_idx" ON "attendance"("sessionId");
CREATE INDEX IF NOT EXISTS "assessments_batchId_idx" ON "assessments"("batchId");
CREATE INDEX IF NOT EXISTS "feedback_studentId_idx" ON "feedback"("studentId");
CREATE INDEX IF NOT EXISTS "feedback_sessionId_idx" ON "feedback"("sessionId");
CREATE INDEX IF NOT EXISTS "risk_scores_studentId_idx" ON "risk_scores"("studentId");
CREATE INDEX IF NOT EXISTS "interventions_studentId_idx" ON "interventions"("studentId");
CREATE INDEX IF NOT EXISTS "interventions_mentorId_idx" ON "interventions"("mentorId");
CREATE INDEX IF NOT EXISTS "notifications_userId_idx" ON "notifications"("userId");

-- ══════════════════════════════════════════════════════════════
-- 9. New Unique Constraints
-- ══════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX "proof_submissions_eventId_studentId_key"
    ON "proof_submissions"("eventId", "studentId");

CREATE UNIQUE INDEX "feedback_sessionId_studentId_key"
    ON "feedback"("sessionId", "studentId");
