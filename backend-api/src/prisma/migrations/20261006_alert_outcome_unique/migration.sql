-- Prevent duplicate ml_alert_outcomes per (alert_id, intervention_id).
-- Safely remove any existing duplicates first, keeping the earliest row.

DELETE FROM ml_alert_outcomes a
  USING ml_alert_outcomes b
  WHERE a.alert_id = b.alert_id
    AND a.intervention_id = b.intervention_id
    AND a.intervention_id IS NOT NULL
    AND a.id > b.id;

CREATE UNIQUE INDEX "ml_alert_outcomes_alert_intervention_uq"
  ON "ml_alert_outcomes" ("alert_id", "intervention_id")
  WHERE "intervention_id" IS NOT NULL;
