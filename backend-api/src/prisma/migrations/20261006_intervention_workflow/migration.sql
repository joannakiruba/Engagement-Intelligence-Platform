-- Intervention Workflow Migration (Additive Only)

-- 1. Add causeCode, alertId, completedAt to interventions
ALTER TABLE "interventions" ADD COLUMN "causeCode" TEXT;
ALTER TABLE "interventions" ADD COLUMN "alertId" INTEGER;
ALTER TABLE "interventions" ADD COLUMN "completedAt" TIMESTAMP(3);

-- 2. Add editedAt to intervention_updates (progress notes)
ALTER TABLE "intervention_updates" ADD COLUMN "editedAt" TIMESTAMP(3);

-- 3. Create intervention_tasks table
CREATE TABLE "intervention_tasks" (
    "id" TEXT NOT NULL,
    "interventionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "deadline" TIMESTAMP(3),
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "intervention_tasks_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "intervention_tasks" ADD CONSTRAINT "intervention_tasks_interventionId_fkey"
    FOREIGN KEY ("interventionId") REFERENCES "interventions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "intervention_tasks_interventionId_idx" ON "intervention_tasks"("interventionId");
CREATE INDEX "intervention_tasks_deadline_idx" ON "intervention_tasks"("deadline") WHERE "deadline" IS NOT NULL;

-- 4. Partial unique index: one active intervention per student + cause
--    Only PENDING and IN_PROGRESS count as "active".
--    COMPLETED/CANCELLED do not block new interventions.
CREATE UNIQUE INDEX "interventions_student_cause_active_uq"
    ON "interventions" ("studentId", "causeCode")
    WHERE "status" IN ('PENDING', 'IN_PROGRESS') AND "causeCode" IS NOT NULL;

-- 5. Add notification deduplication and reference fields
ALTER TABLE "notifications" ADD COLUMN "referenceId" TEXT;
ALTER TABLE "notifications" ADD COLUMN "referenceType" TEXT;
ALTER TABLE "notifications" ADD COLUMN "deduplicationKey" TEXT;

CREATE UNIQUE INDEX "notifications_deduplicationKey_key"
    ON "notifications" ("deduplicationKey")
    WHERE "deduplicationKey" IS NOT NULL;

-- 6. ML alert causes table (matches existing ml_mentor_alerts pattern — raw SQL, not Prisma-managed)
CREATE TABLE "ml_alert_causes" (
    "id" SERIAL NOT NULL,
    "alert_id" INTEGER NOT NULL,
    "cause_code" TEXT NOT NULL,
    "evidence" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ml_alert_causes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ml_alert_causes" ADD CONSTRAINT "ml_alert_causes_alert_id_fkey"
    FOREIGN KEY ("alert_id") REFERENCES "ml_mentor_alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ml_alert_causes_alert_id_idx" ON "ml_alert_causes"("alert_id");
CREATE INDEX "ml_alert_causes_cause_code_idx" ON "ml_alert_causes"("cause_code");

-- 7. Index on interventions for alert lookups
CREATE INDEX "interventions_alertId_idx" ON "interventions"("alertId") WHERE "alertId" IS NOT NULL;
CREATE INDEX "interventions_studentId_status_idx" ON "interventions"("studentId", "status");
