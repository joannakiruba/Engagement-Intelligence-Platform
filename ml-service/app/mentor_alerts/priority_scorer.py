"""Scores alert urgency so mentors act on the most critical students first."""

from app.models.alert_models import StudentFeatures, PriorityResult, UrgencyTier


WEIGHTS = {
    "risk_velocity": 0.25,
    "consecutive_absences": 0.20,
    "weeks_at_high_risk": 0.15,
    "failed_interventions": 0.20,
    "score_decline": 0.20,
}


def score_priority(features: StudentFeatures) -> PriorityResult:
    factors = []

    velocity_score = min(abs(features.risk_velocity) / 30 * 100, 100) if features.risk_velocity > 0 else 0
    factors.append({
        "factor": "risk_velocity",
        "value": features.risk_velocity,
        "impact": round(velocity_score * WEIGHTS["risk_velocity"], 2),
        "detail": f"Risk changed by {features.risk_velocity:+.1f} points since last period",
    })

    absence_score = min(features.consecutive_absences / 5 * 100, 100)
    factors.append({
        "factor": "consecutive_absences",
        "value": features.consecutive_absences,
        "impact": round(absence_score * WEIGHTS["consecutive_absences"], 2),
        "detail": f"{features.consecutive_absences} consecutive sessions missed",
    })

    chronic_score = min(features.weeks_at_high_risk / 4 * 100, 100)
    factors.append({
        "factor": "weeks_at_high_risk",
        "value": features.weeks_at_high_risk,
        "impact": round(chronic_score * WEIGHTS["weeks_at_high_risk"], 2),
        "detail": f"At HIGH risk for {features.weeks_at_high_risk} consecutive weeks",
    })

    failed_intervention_score = 0
    if features.past_interventions_count > 0:
        if features.last_intervention_outcome in ("NO_CHANGE", "DECLINED"):
            failed_intervention_score = min(features.past_interventions_count / 3 * 100, 100)
    factors.append({
        "factor": "failed_interventions",
        "value": features.last_intervention_outcome or "none",
        "impact": round(failed_intervention_score * WEIGHTS["failed_interventions"], 2),
        "detail": f"{features.past_interventions_count} past interventions, last outcome: {features.last_intervention_outcome or 'N/A'}",
    })

    decline_score = min(abs(features.score_trend_slope) / 20 * 100, 100) if features.score_trend_slope < 0 else 0
    factors.append({
        "factor": "score_decline",
        "value": features.score_trend_slope,
        "impact": round(decline_score * WEIGHTS["score_decline"], 2),
        "detail": f"Assessment scores changed by {features.score_trend_slope:+.1f}%",
    })

    priority_score = (
        velocity_score * WEIGHTS["risk_velocity"]
        + absence_score * WEIGHTS["consecutive_absences"]
        + chronic_score * WEIGHTS["weeks_at_high_risk"]
        + failed_intervention_score * WEIGHTS["failed_interventions"]
        + decline_score * WEIGHTS["score_decline"]
    )

    priority_score = round(min(priority_score, 100), 2)

    if priority_score > 80:
        tier = UrgencyTier.CRITICAL
    elif priority_score > 60:
        tier = UrgencyTier.HIGH
    else:
        tier = UrgencyTier.MODERATE

    factors.sort(key=lambda f: f["impact"], reverse=True)

    return PriorityResult(
        priority_score=priority_score,
        urgency_tier=tier,
        contributing_factors=factors,
    )
