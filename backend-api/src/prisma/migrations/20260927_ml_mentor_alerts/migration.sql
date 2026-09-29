-- ML Mentor Alert System Tables (Additive Only — no changes to existing tables)

CREATE TABLE "ml_mentor_alerts" (
    "id" SERIAL NOT NULL,
    "student_id" TEXT NOT NULL,
    "mentor_id" TEXT NOT NULL,
    "batch_id" TEXT,
    "priority_score" DOUBLE PRECISION NOT NULL,
    "urgency_tier" TEXT NOT NULL,
    "trigger_reason" TEXT NOT NULL,
    "risk_score" DOUBLE PRECISION NOT NULL,
    "risk_velocity" DOUBLE PRECISION,
    "recommended_intervention" TEXT,
    "recommendation_confidence" DOUBLE PRECISION,
    "recommendation_reasoning" TEXT,
    "alert_status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seen_at" TIMESTAMP(3),
    "acted_at" TIMESTAMP(3),
    CONSTRAINT "ml_mentor_alerts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ml_alert_outcomes" (
    "id" SERIAL NOT NULL,
    "alert_id" INTEGER NOT NULL,
    "mentor_response" TEXT,
    "response_time_hours" DOUBLE PRECISION,
    "intervention_id" TEXT,
    "student_risk_after_7d" DOUBLE PRECISION,
    "student_risk_after_14d" DOUBLE PRECISION,
    "was_recommendation_followed" BOOLEAN DEFAULT false,
    "outcome_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ml_alert_outcomes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ml_mentor_alerts_student_id_idx" ON "ml_mentor_alerts"("student_id");
CREATE INDEX "ml_mentor_alerts_mentor_id_idx" ON "ml_mentor_alerts"("mentor_id");
CREATE INDEX "ml_mentor_alerts_batch_id_idx" ON "ml_mentor_alerts"("batch_id");
CREATE INDEX "ml_mentor_alerts_urgency_tier_idx" ON "ml_mentor_alerts"("urgency_tier");
CREATE INDEX "ml_mentor_alerts_alert_status_idx" ON "ml_mentor_alerts"("alert_status");
CREATE INDEX "ml_mentor_alerts_created_at_idx" ON "ml_mentor_alerts"("created_at");
CREATE INDEX "ml_alert_outcomes_alert_id_idx" ON "ml_alert_outcomes"("alert_id");

ALTER TABLE "ml_alert_outcomes" ADD CONSTRAINT "ml_alert_outcomes_alert_id_fkey"
    FOREIGN KEY ("alert_id") REFERENCES "ml_mentor_alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
