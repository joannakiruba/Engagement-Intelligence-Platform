-- Prevent duplicate ml_alert_outcomes per (alert_id, intervention_id).
-- Archive duplicates before removal, keeping the earliest row per group.

CREATE TABLE IF NOT EXISTS "ml_alert_outcomes_archive" (
  "id"                          SERIAL PRIMARY KEY,
  "original_id"                 INTEGER NOT NULL,
  "alert_id"                    INTEGER NOT NULL,
  "intervention_id"             TEXT,
  "mentor_response"             TEXT,
  "was_recommendation_followed" BOOLEAN,
  "response_time_hours"         DOUBLE PRECISION,
  "outcome_notes"               TEXT,
  "archived_at"                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO "ml_alert_outcomes_archive"
  ("original_id", "alert_id", "intervention_id", "mentor_response",
   "was_recommendation_followed", "response_time_hours", "outcome_notes")
SELECT a.id, a.alert_id, a.intervention_id, a.mentor_response,
       a.was_recommendation_followed, a.response_time_hours, a.outcome_notes
FROM ml_alert_outcomes a
  JOIN ml_alert_outcomes b
    ON a.alert_id = b.alert_id
   AND a.intervention_id = b.intervention_id
   AND a.intervention_id IS NOT NULL
   AND a.id > b.id;

DELETE FROM ml_alert_outcomes a
  USING ml_alert_outcomes b
  WHERE a.alert_id = b.alert_id
    AND a.intervention_id = b.intervention_id
    AND a.intervention_id IS NOT NULL
    AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS "ml_alert_outcomes_alert_intervention_uq"
  ON "ml_alert_outcomes" ("alert_id", "intervention_id")
  WHERE "intervention_id" IS NOT NULL;
