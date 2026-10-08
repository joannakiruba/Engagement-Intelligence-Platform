"""Tests for the Mentor Alert System ML models."""

import pytest
from app.models.alert_models import MentorAlert, StudentFeatures, UrgencyTier
from app.mentor_alerts.priority_scorer import score_priority
from app.mentor_alerts.fatigue_filter import check_fatigue_filter, _to_vector
from app.mentor_alerts.intervention_recommender import recommend_intervention
from datetime import datetime, timedelta
import asyncio

from app.mentor_alerts.feature_builder import build_features_for_all_students
from app.mentor_alerts.alert_generator import _persist_alerts


def _make_student(**overrides) -> StudentFeatures:
    defaults = dict(
        student_id="s1",
        student_name="Test Student",
        batch_id="b1",
        batch_name="Batch A",
        mentor_id="m1",
        mentor_name="Test Mentor",
        attendance_pct_4w=90.0,
        attendance_trend_slope=0.0,
        consecutive_absences=0,
        avg_score_4w=75.0,
        score_trend_slope=0.0,
        failed_assessments_count=0,
        feedback_sentiment_avg=0.0,
        negative_feedback_count=0,
        effort_rating_avg=3.5,
        participation_rating_avg=3.5,
        current_risk_score=20.0,
        previous_risk_score=20.0,
        risk_level="LOW",
        risk_velocity=0.0,
        weeks_at_high_risk=0,
        past_interventions_count=0,
        last_intervention_outcome=None,
        days_since_last_intervention=None,
    )
    defaults.update(overrides)
    return StudentFeatures(**defaults)


class TestPriorityScorer:
    def test_low_risk_student_gets_low_priority(self):
        student = _make_student()
        result = score_priority(student)
        assert result.priority_score < 30
        assert result.urgency_tier == UrgencyTier.MODERATE

    def test_rapidly_declining_student_gets_critical(self):
        student = _make_student(
            risk_velocity=25.0, consecutive_absences=4,
            weeks_at_high_risk=3, score_trend_slope=-18.0,
            risk_level="HIGH", current_risk_score=80.0,
            past_interventions_count=2, last_intervention_outcome="NO_CHANGE",
        )
        result = score_priority(student)
        assert result.priority_score > 70
        assert result.urgency_tier in (UrgencyTier.CRITICAL, UrgencyTier.HIGH)

    def test_consecutive_absences_increase_priority(self):
        student_a = _make_student(consecutive_absences=0)
        student_b = _make_student(consecutive_absences=4)
        assert score_priority(student_b).priority_score > score_priority(student_a).priority_score

    def test_failed_interventions_increase_priority(self):
        student = _make_student(
            past_interventions_count=3, last_intervention_outcome="NO_CHANGE",
            risk_level="HIGH", current_risk_score=70.0,
        )
        assert score_priority(student).priority_score > 15

    def test_contributing_factors_sorted_by_impact(self):
        student = _make_student(risk_velocity=20.0, consecutive_absences=3, score_trend_slope=-10.0)
        result = score_priority(student)
        impacts = [f["impact"] for f in result.contributing_factors]
        assert impacts == sorted(impacts, reverse=True)


class TestFatigueFilter:
    def _make_population(self, n=10):
        return [_make_student(student_id=f"s{i}", attendance_pct_4w=80+i, avg_score_4w=60+i) for i in range(n)]

    def test_non_high_risk_filtered_out(self):
        student = _make_student(risk_level="LOW")
        result = check_fatigue_filter(student, self._make_population())
        assert result.should_alert is False

    def test_escalation_triggers_alert(self):
        student = _make_student(risk_level="HIGH", current_risk_score=65.0, previous_risk_score=50.0)
        result = check_fatigue_filter(student, self._make_population())
        assert result.should_alert is True
        assert "ESCALATED" in result.reason

    def test_cooldown_prevents_alert(self):
        student = _make_student(risk_level="HIGH", current_risk_score=65.0, previous_risk_score=62.0)
        last_alert = datetime.utcnow() - timedelta(days=3)
        result = check_fatigue_filter(student, self._make_population(), last_alert_date=last_alert)
        assert result.should_alert is False

    def test_chronic_high_risk_triggers_realert(self):
        student = _make_student(
            risk_level="HIGH", current_risk_score=68.0, previous_risk_score=66.0,
            weeks_at_high_risk=3, days_since_last_intervention=20,
        )
        last_alert = datetime.utcnow() - timedelta(days=10)
        result = check_fatigue_filter(student, self._make_population(), last_alert_date=last_alert)
        assert result.should_alert is True
        assert "CHRONIC" in result.reason

    def test_feature_vector_has_correct_length(self):
        assert len(_to_vector(_make_student())) == 8


class TestInterventionRecommender:
    def test_first_time_gets_one_on_one(self):
        result = recommend_intervention(_make_student(past_interventions_count=0))
        assert result.recommended_type == "one_on_one_meeting"
        assert result.confidence >= 0.85

    def test_extended_absence_gets_parent_contact(self):
        result = recommend_intervention(_make_student(consecutive_absences=5, past_interventions_count=1))
        assert result.recommended_type == "parent_guardian_contact"

    def test_present_but_failing_gets_practice(self):
        result = recommend_intervention(_make_student(attendance_pct_4w=85.0, avg_score_4w=35.0, past_interventions_count=1))
        assert result.recommended_type == "additional_practice"

    def test_negative_sentiment_with_failed_intervention_gets_counseling(self):
        result = recommend_intervention(_make_student(
            feedback_sentiment_avg=-0.6, past_interventions_count=2, last_intervention_outcome="NO_CHANGE"))
        assert result.recommended_type == "counseling_referral"

    def test_declined_outcome_gets_counseling(self):
        result = recommend_intervention(_make_student(past_interventions_count=1, last_intervention_outcome="DECLINED"))
        assert result.recommended_type == "counseling_referral"

    def test_low_effort_but_present_gets_peer_pairing(self):
        result = recommend_intervention(_make_student(
            effort_rating_avg=2.0, attendance_pct_4w=80.0,
            past_interventions_count=1, last_intervention_outcome="IMPROVED"))
        assert result.recommended_type == "peer_buddy_pairing"

    def test_confidence_always_between_0_and_1(self):
        students = [
            _make_student(past_interventions_count=0),
            _make_student(consecutive_absences=5, past_interventions_count=1),
            _make_student(attendance_pct_4w=85, avg_score_4w=35, past_interventions_count=1),
            _make_student(feedback_sentiment_avg=-0.6, past_interventions_count=1),
        ]
        for s in students:
            assert 0 <= recommend_intervention(s).confidence <= 1


def test_batch_feature_query_uses_stored_role_name_and_single_batch_parameter():
    class Connection:
        query = None
        args = None

        async def fetch(self, query, *args):
            self.query = query
            self.args = args
            return []

    class Acquire:
        def __init__(self, connection):
            self.connection = connection

        async def __aenter__(self):
            return self.connection

        async def __aexit__(self, *_):
            return False

    class Pool:
        def __init__(self):
            self.connection = Connection()

        def acquire(self):
            return Acquire(self.connection)

    pool = Pool()
    result = asyncio.run(build_features_for_all_students(pool, "batch-123"))

    assert result == []
    assert "r.name = 'STUDENT'" in pool.connection.query
    assert 'bm."batchId" = $1' in pool.connection.query
    assert pool.connection.args == ("batch-123",)


def test_alert_persistence_is_idempotent_for_a_risk_snapshot():
    class Transaction:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return False

    class Connection:
        inserted = False
        causes = 0

        def transaction(self):
            return Transaction()

        async def fetchrow(self, query, *args):
            if query.lstrip().startswith("SELECT id"):
                return {"id": 42} if self.inserted else None
            assert "ON CONFLICT" in query
            if self.inserted:
                return None
            self.inserted = True
            return {"id": 42}

        async def execute(self, *_):
            self.causes += 1

    class Acquire:
        def __init__(self, connection):
            self.connection = connection

        async def __aenter__(self):
            return self.connection

        async def __aexit__(self, *_):
            return False

    class Pool:
        def __init__(self):
            self.connection = Connection()

        def acquire(self):
            return Acquire(self.connection)

    student = _make_student(
        student_id="s1", batch_id="b1", risk_level="HIGH", current_risk_score=80,
        current_risk_score_id="risk-score-1", attendance_pct_4w=50,
    )
    alert = MentorAlert(
        student_id="s1", student_name="Test Student", mentor_id="m1", mentor_name="Test Mentor",
        batch_id="b1", batch_name="Batch A", priority_score=80, urgency_tier=UrgencyTier.HIGH,
        trigger_reason="ESCALATED", risk_score=80, risk_velocity=20,
        recommended_intervention="one_on_one_meeting", recommendation_confidence=0.9,
        recommendation_reasoning="Support", contributing_factors=[], created_at=datetime.utcnow(),
    )
    pool = Pool()
    first = asyncio.run(_persist_alerts(pool, [alert], {("s1", "b1"): student}))
    replay = asyncio.run(_persist_alerts(pool, [alert], {("s1", "b1"): student}))

    assert first[0].id == 42
    assert len(replay) == 1 and replay[0].id == 42
    assert pool.connection.causes == 1
