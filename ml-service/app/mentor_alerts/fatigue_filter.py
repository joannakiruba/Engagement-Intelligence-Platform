"""Filters out noisy alerts to prevent mentor alert fatigue.
Uses state-change detection, anomaly detection (Isolation Forest), and cooldown logic."""

from datetime import datetime, timedelta
import numpy as np
from sklearn.ensemble import IsolationForest

from app.models.alert_models import StudentFeatures, FatigueFilterResult
from app.config import ALERT_COOLDOWN_DAYS, CHRONIC_REALERT_DAYS, ANOMALY_CONTAMINATION


_isolation_forest: IsolationForest | None = None


def _get_or_train_model(all_features: list[StudentFeatures]) -> IsolationForest:
    global _isolation_forest
    if _isolation_forest is not None and len(all_features) < 5:
        return _isolation_forest

    feature_matrix = np.array([_to_vector(f) for f in all_features])

    if len(feature_matrix) < 5:
        _isolation_forest = IsolationForest(contamination=ANOMALY_CONTAMINATION, random_state=42)
        _isolation_forest.fit(feature_matrix if len(feature_matrix) > 0 else np.zeros((1, 8)))
        return _isolation_forest

    _isolation_forest = IsolationForest(
        contamination=ANOMALY_CONTAMINATION,
        n_estimators=100,
        random_state=42,
    )
    _isolation_forest.fit(feature_matrix)
    return _isolation_forest


def _to_vector(f: StudentFeatures) -> list[float]:
    return [
        f.attendance_pct_4w,
        f.attendance_trend_slope,
        float(f.consecutive_absences),
        f.avg_score_4w,
        f.score_trend_slope,
        f.effort_rating_avg,
        f.participation_rating_avg,
        f.risk_velocity,
    ]


def check_fatigue_filter(
    student: StudentFeatures,
    all_features: list[StudentFeatures],
    last_alert_date: datetime | None = None,
    now: datetime | None = None,
) -> FatigueFilterResult:
    now = now or datetime.utcnow()

    if student.risk_level != "HIGH":
        return FatigueFilterResult(
            should_alert=False,
            reason="Student is not at HIGH risk level",
        )

    prev_level = _infer_previous_level(student)
    if prev_level != "HIGH" and student.risk_level == "HIGH":
        return FatigueFilterResult(
            should_alert=True,
            reason=f"ESCALATED: Risk level changed from {prev_level} to HIGH",
        )

    model = _get_or_train_model(all_features)
    vector = np.array([_to_vector(student)])
    anomaly_pred = model.predict(vector)
    anomaly_score = model.decision_function(vector)

    if anomaly_pred[0] == -1:
        return FatigueFilterResult(
            should_alert=True,
            reason=f"ANOMALY: Unusual behavioral pattern detected (score: {anomaly_score[0]:.3f})",
            is_anomaly=True,
        )

    if last_alert_date:
        days_since_alert = (now - last_alert_date).days
        if days_since_alert < ALERT_COOLDOWN_DAYS:
            return FatigueFilterResult(
                should_alert=False,
                reason=f"Cooldown active: last alert was {days_since_alert} days ago (cooldown: {ALERT_COOLDOWN_DAYS} days)",
            )

    if student.weeks_at_high_risk >= 2:
        if student.days_since_last_intervention is None or student.days_since_last_intervention > CHRONIC_REALERT_DAYS:
            return FatigueFilterResult(
                should_alert=True,
                reason=f"CHRONIC: At HIGH risk for {student.weeks_at_high_risk} weeks with no recent intervention",
            )

    if abs(student.risk_velocity) > 10:
        return FatigueFilterResult(
            should_alert=True,
            reason=f"SIGNIFICANT CHANGE: Risk velocity of {student.risk_velocity:+.1f} exceeds threshold",
        )

    return FatigueFilterResult(
        should_alert=False,
        reason="No significant state change detected",
    )


def _infer_previous_level(student: StudentFeatures) -> str:
    prev = student.previous_risk_score
    if prev <= 30:
        return "LOW"
    elif prev <= 60:
        return "MEDIUM"
    return "HIGH"
