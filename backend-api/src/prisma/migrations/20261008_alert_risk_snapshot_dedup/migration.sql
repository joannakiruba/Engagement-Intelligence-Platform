-- Make ML-generated alerts idempotent for each student/batch risk snapshot.
ALTER TABLE "ml_mentor_alerts"
    ADD COLUMN "source_risk_score_id" TEXT;

CREATE UNIQUE INDEX "ml_mentor_alerts_risk_snapshot_uq"
    ON "ml_mentor_alerts" (student_id, batch_id, "source_risk_score_id")
    WHERE "source_risk_score_id" IS NOT NULL;

CREATE INDEX "ml_mentor_alerts_source_risk_score_id_idx"
    ON "ml_mentor_alerts" ("source_risk_score_id");

-- Add a cascading foreign key only if historical cleanup policy is explicit; keep this
-- provenance column nullable and independent so existing alerts remain untouched.
