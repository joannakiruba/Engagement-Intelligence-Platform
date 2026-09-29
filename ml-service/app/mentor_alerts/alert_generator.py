"""Orchestrates the full mentor alert pipeline."""

from datetime import datetime
from typing import Optional
import asyncpg

from app.models.alert_models import (
    StudentFeatures, MentorAlert, GenerateAlertsResponse, UrgencyTier,
)
from app.mentor_alerts.feature_builder import build_features_for_all_students
from app.mentor_alerts.priority_scorer import score_priority
from app.mentor_alerts.fatigue_filter import check_fatigue_filter
from app.mentor_alerts.intervention_recommender import recommend_intervention


async def generate_alerts(
    pool: asyncpg.Pool,
    batch_id: Optional[str] = None,
) -> GenerateAlertsResponse:
    all_features = await build_features_for_all_students(pool, batch_id)
    high_risk = [f for f in all_features if f.risk_level == "HIGH"]
    alerts: list[MentorAlert] = []
    filtered_count = 0

    for student in high_risk:
        if not student.mentor_id:
            filtered_count += 1
            continue

        last_alert_date = await _get_last_alert_date(pool, student.student_id)
        fatigue_result = check_fatigue_filter(
            student=student, all_features=all_features, last_alert_date=last_alert_date,
        )

        if not fatigue_result.should_alert:
            filtered_count += 1
            continue

        priority = score_priority(student)
        recommendation = recommend_intervention(student)

        alert = MentorAlert(
            student_id=student.student_id,
            student_name=student.student_name,
            mentor_id=student.mentor_id,
            mentor_name=student.mentor_name or "Unassigned",
            batch_id=student.batch_id,
            batch_name=student.batch_name,
            priority_score=priority.priority_score,
            urgency_tier=priority.urgency_tier,
            trigger_reason=fatigue_result.reason,
            risk_score=student.current_risk_score,
            risk_velocity=student.risk_velocity,
            recommended_intervention=recommendation.recommended_type,
            recommendation_confidence=recommendation.confidence,
            recommendation_reasoning=recommendation.reasoning,
            contributing_factors=priority.contributing_factors,
            created_at=datetime.utcnow(),
        )
        alerts.append(alert)

    alerts.sort(key=lambda a: a.priority_score, reverse=True)
    await _persist_alerts(pool, alerts)

    return GenerateAlertsResponse(
        total_students_analyzed=len(all_features),
        alerts_generated=len(alerts),
        alerts_filtered=filtered_count,
        alerts=alerts,
    )


async def _get_last_alert_date(pool: asyncpg.Pool, student_id: str) -> Optional[datetime]:
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT created_at FROM ml_mentor_alerts
            WHERE student_id = $1 ORDER BY created_at DESC LIMIT 1
        """, student_id)
        return row["created_at"] if row else None


async def _persist_alerts(pool: asyncpg.Pool, alerts: list[MentorAlert]) -> None:
    if not alerts:
        return
    async with pool.acquire() as conn:
        for alert in alerts:
            await conn.execute("""
                INSERT INTO ml_mentor_alerts (
                    student_id, mentor_id, batch_id,
                    priority_score, urgency_tier, trigger_reason,
                    risk_score, risk_velocity,
                    recommended_intervention, recommendation_confidence,
                    recommendation_reasoning, alert_status, created_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
            """, alert.student_id, alert.mentor_id, alert.batch_id,
                alert.priority_score, alert.urgency_tier.value, alert.trigger_reason,
                alert.risk_score, alert.risk_velocity,
                alert.recommended_intervention, alert.recommendation_confidence,
                alert.recommendation_reasoning, "pending", alert.created_at)


async def get_alerts_for_mentor(pool: asyncpg.Pool, mentor_id: str) -> list[dict]:
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT a.*, u.name AS student_name, b.name AS batch_name
            FROM ml_mentor_alerts a
            LEFT JOIN users u ON u.id = a.student_id
            LEFT JOIN batches b ON b.id = a.batch_id
            WHERE a.mentor_id = $1
            ORDER BY a.priority_score DESC, a.created_at DESC
        """, mentor_id)
        return [dict(r) for r in rows]


async def get_alerts_for_student(pool: asyncpg.Pool, student_id: str) -> list[dict]:
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT a.*, u.name AS mentor_name, b.name AS batch_name
            FROM ml_mentor_alerts a
            LEFT JOIN users u ON u.id = a.mentor_id
            LEFT JOIN batches b ON b.id = a.batch_id
            WHERE a.student_id = $1
            ORDER BY a.created_at DESC
        """, student_id)
        return [dict(r) for r in rows]


async def update_alert_status(pool: asyncpg.Pool, alert_id: int, status: str) -> dict | None:
    now = datetime.utcnow()
    time_field = ""
    if status == "seen":
        time_field = ", seen_at = $3"
    elif status in ("acted", "dismissed"):
        time_field = ", acted_at = $3"
    async with pool.acquire() as conn:
        if time_field:
            row = await conn.fetchrow(f"""
                UPDATE ml_mentor_alerts SET alert_status = $1 {time_field}
                WHERE id = $2 RETURNING *
            """, status, alert_id, now)
        else:
            row = await conn.fetchrow("""
                UPDATE ml_mentor_alerts SET alert_status = $1
                WHERE id = $2 RETURNING *
            """, status, alert_id)
        return dict(row) if row else None


async def record_alert_outcome(
    pool: asyncpg.Pool, alert_id: int, mentor_response: str,
    response_time_hours: float | None, intervention_id: str | None,
    was_recommendation_followed: bool, outcome_notes: str | None,
) -> dict:
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO ml_alert_outcomes (
                alert_id, mentor_response, response_time_hours,
                intervention_id, was_recommendation_followed, outcome_notes, created_at
            ) VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING *
        """, alert_id, mentor_response, response_time_hours,
            intervention_id, was_recommendation_followed, outcome_notes)
        return dict(row)


async def get_alert_stats(pool: asyncpg.Pool) -> dict:
    async with pool.acquire() as conn:
        total = await conn.fetchrow("SELECT COUNT(*) as cnt FROM ml_mentor_alerts")
        critical = await conn.fetchrow("SELECT COUNT(*) as cnt FROM ml_mentor_alerts WHERE urgency_tier = 'CRITICAL'")
        high = await conn.fetchrow("SELECT COUNT(*) as cnt FROM ml_mentor_alerts WHERE urgency_tier = 'HIGH'")
        moderate = await conn.fetchrow("SELECT COUNT(*) as cnt FROM ml_mentor_alerts WHERE urgency_tier = 'MODERATE'")
        acted = await conn.fetchrow("SELECT COUNT(*) as cnt FROM ml_mentor_alerts WHERE alert_status = 'acted'")
        avg_resp = await conn.fetchrow("SELECT AVG(response_time_hours) as avg_time FROM ml_alert_outcomes WHERE response_time_hours IS NOT NULL")
        followed = await conn.fetchrow("SELECT COUNT(*) as cnt FROM ml_alert_outcomes WHERE was_recommendation_followed = true")
        total_outcomes = await conn.fetchrow("SELECT COUNT(*) as cnt FROM ml_alert_outcomes")
        total_cnt = total["cnt"]
        acted_rate = (acted["cnt"] / total_cnt) if total_cnt > 0 else 0
        follow_rate = (followed["cnt"] / total_outcomes["cnt"]) if total_outcomes["cnt"] > 0 else 0
        return {
            "total_alerts": total_cnt, "critical_count": critical["cnt"],
            "high_count": high["cnt"], "moderate_count": moderate["cnt"],
            "avg_response_time_hours": float(avg_resp["avg_time"]) if avg_resp["avg_time"] else None,
            "acted_rate": round(acted_rate, 3), "recommendation_follow_rate": round(follow_rate, 3),
        }
