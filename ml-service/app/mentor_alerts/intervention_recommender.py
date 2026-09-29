"""Recommends the most appropriate intervention type based on student profile."""

from app.models.alert_models import StudentFeatures, InterventionRecommendation


INTERVENTION_TYPES = {
    "one_on_one_meeting": "Schedule a 1-on-1 meeting with the student",
    "peer_buddy_pairing": "Pair with a high-performing peer for mutual support",
    "additional_practice": "Assign additional practice sessions or resources",
    "schedule_adjustment": "Review and adjust the student's schedule",
    "parent_guardian_contact": "Contact parent or guardian about attendance",
    "counseling_referral": "Refer to student counseling services",
}


def recommend_intervention(features: StudentFeatures) -> InterventionRecommendation:
    if features.past_interventions_count == 0:
        return InterventionRecommendation(
            recommended_type="one_on_one_meeting",
            confidence=0.90,
            reasoning="First time flagged — start with a conversation to understand what's happening",
        )

    if features.consecutive_absences >= 5:
        return InterventionRecommendation(
            recommended_type="parent_guardian_contact",
            confidence=0.85,
            reasoning=f"Extended absence pattern ({features.consecutive_absences} consecutive misses) suggests external factors",
        )

    if features.attendance_pct_4w >= 75 and features.avg_score_4w < 40:
        return InterventionRecommendation(
            recommended_type="additional_practice",
            confidence=0.82,
            reasoning=f"Student is attending ({features.attendance_pct_4w:.0f}% attendance) but underperforming (avg {features.avg_score_4w:.0f}%) — needs academic support",
        )

    if features.feedback_sentiment_avg < -0.4:
        conf = 0.75
        if features.last_intervention_outcome in ("NO_CHANGE", "DECLINED"):
            return InterventionRecommendation(
                recommended_type="counseling_referral",
                confidence=0.80,
                reasoning=f"Consistently negative feedback (sentiment: {features.feedback_sentiment_avg:.2f}) and prior intervention had no effect — deeper support needed",
            )
        return InterventionRecommendation(
            recommended_type="one_on_one_meeting",
            confidence=conf,
            reasoning=f"Negative feedback sentiment ({features.feedback_sentiment_avg:.2f}) — explore motivational or personal challenges",
        )

    if features.last_intervention_outcome == "NO_CHANGE" and features.past_interventions_count >= 2:
        return InterventionRecommendation(
            recommended_type="counseling_referral",
            confidence=0.78,
            reasoning=f"{features.past_interventions_count} prior interventions with no improvement — escalate to professional support",
        )

    if features.last_intervention_outcome == "DECLINED":
        return InterventionRecommendation(
            recommended_type="counseling_referral",
            confidence=0.82,
            reasoning="Previous intervention led to decline — immediate escalation to counseling recommended",
        )

    if features.attendance_pct_4w < 60 and features.consecutive_absences >= 3:
        return InterventionRecommendation(
            recommended_type="parent_guardian_contact",
            confidence=0.77,
            reasoning=f"Low attendance ({features.attendance_pct_4w:.0f}%) with {features.consecutive_absences} consecutive absences — external outreach needed",
        )

    if features.score_trend_slope < -15:
        return InterventionRecommendation(
            recommended_type="additional_practice",
            confidence=0.75,
            reasoning=f"Sharp score decline ({features.score_trend_slope:+.1f}%) — targeted academic support recommended",
        )

    if features.effort_rating_avg < 2.5 and features.attendance_pct_4w >= 70:
        return InterventionRecommendation(
            recommended_type="peer_buddy_pairing",
            confidence=0.70,
            reasoning=f"Present but low effort (avg rating: {features.effort_rating_avg:.1f}/5) — peer motivation may help",
        )

    return InterventionRecommendation(
        recommended_type="one_on_one_meeting",
        confidence=0.65,
        reasoning="General engagement concern — a 1-on-1 conversation is a good starting point",
    )
