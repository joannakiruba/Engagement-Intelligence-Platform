"""Builds student feature vectors by querying existing database tables (read-only)."""

from datetime import datetime, timedelta
from typing import Optional
import asyncpg

from app.models.alert_models import StudentFeatures


async def get_db_pool(database_url: str) -> asyncpg.Pool:
    return await asyncpg.create_pool(database_url, min_size=2, max_size=10)


async def build_features_for_all_students(
    pool: asyncpg.Pool,
    batch_id: Optional[str] = None,
) -> list[StudentFeatures]:
    four_weeks_ago = datetime.utcnow() - timedelta(weeks=4)
    eight_weeks_ago = datetime.utcnow() - timedelta(weeks=8)

    batch_filter = "AND bm.\"batchId\" = $2" if batch_id else ""
    params: list = [four_weeks_ago]
    if batch_id:
        params.append(batch_id)

    async with pool.acquire() as conn:
        students = await conn.fetch(f"""
            SELECT DISTINCT
                u.id AS student_id,
                u.name AS student_name,
                bm."batchId" AS batch_id,
                b.name AS batch_name
            FROM users u
            JOIN batch_members bm ON bm."studentId" = u.id
            JOIN batches b ON b.id = bm."batchId"
            JOIN roles r ON r.id = u."roleId"
            WHERE r.name = 'student'
            {batch_filter}
        """, *params[1:] if batch_id else [])

        features_list = []
        for student in students:
            features = await _build_single_student_features(
                conn, student, four_weeks_ago, eight_weeks_ago
            )
            features_list.append(features)

    return features_list


async def _build_single_student_features(
    conn: asyncpg.Connection,
    student: asyncpg.Record,
    four_weeks_ago: datetime,
    eight_weeks_ago: datetime,
) -> StudentFeatures:
    sid = student["student_id"]

    attendance = await _get_attendance_features(conn, sid, four_weeks_ago, eight_weeks_ago)
    assessment = await _get_assessment_features(conn, sid, four_weeks_ago, eight_weeks_ago)
    feedback = await _get_feedback_features(conn, sid, four_weeks_ago)
    risk = await _get_risk_features(conn, sid)
    intervention = await _get_intervention_features(conn, sid)
    mentor = await _get_mentor_info(conn, sid)

    risk_velocity = risk["current_score"] - risk["previous_score"]

    return StudentFeatures(
        student_id=sid,
        student_name=student["student_name"],
        batch_id=student["batch_id"],
        batch_name=student["batch_name"],
        mentor_id=mentor["mentor_id"],
        mentor_name=mentor["mentor_name"],
        attendance_pct_4w=attendance["pct_4w"],
        attendance_trend_slope=attendance["trend_slope"],
        consecutive_absences=attendance["consecutive_absences"],
        avg_score_4w=assessment["avg_score_4w"],
        score_trend_slope=assessment["trend_slope"],
        failed_assessments_count=assessment["failed_count"],
        feedback_sentiment_avg=feedback["sentiment_avg"],
        negative_feedback_count=feedback["negative_count"],
        effort_rating_avg=feedback["effort_avg"],
        participation_rating_avg=feedback["participation_avg"],
        current_risk_score=risk["current_score"],
        previous_risk_score=risk["previous_score"],
        risk_level=risk["risk_level"],
        risk_velocity=risk_velocity,
        weeks_at_high_risk=risk["weeks_at_high"],
        past_interventions_count=intervention["count"],
        last_intervention_outcome=intervention["last_outcome"],
        days_since_last_intervention=intervention["days_since_last"],
    )


async def _get_attendance_features(
    conn: asyncpg.Connection,
    student_id: str,
    four_weeks_ago: datetime,
    eight_weeks_ago: datetime,
) -> dict:
    recent = await conn.fetch("""
        SELECT a.status, s."scheduledDate"
        FROM attendance a
        JOIN sessions s ON s.id = a."sessionId"
        WHERE a."studentId" = $1 AND s."scheduledDate" >= $2
        ORDER BY s."scheduledDate" DESC
    """, student_id, four_weeks_ago)

    total = len(recent)
    present = sum(1 for r in recent if r["status"] in ("PRESENT", "LATE"))
    pct = (present / total * 100) if total > 0 else 100.0

    consecutive = 0
    for r in recent:
        if r["status"] == "ABSENT":
            consecutive += 1
        else:
            break

    prev = await conn.fetch("""
        SELECT a.status
        FROM attendance a
        JOIN sessions s ON s.id = a."sessionId"
        WHERE a."studentId" = $1
          AND s."scheduledDate" >= $2
          AND s."scheduledDate" < $3
    """, student_id, eight_weeks_ago, four_weeks_ago)

    prev_total = len(prev)
    prev_present = sum(1 for r in prev if r["status"] in ("PRESENT", "LATE"))
    prev_pct = (prev_present / prev_total * 100) if prev_total > 0 else 100.0

    trend_slope = pct - prev_pct

    return {
        "pct_4w": round(pct, 2),
        "trend_slope": round(trend_slope, 2),
        "consecutive_absences": consecutive,
    }


async def _get_assessment_features(
    conn: asyncpg.Connection,
    student_id: str,
    four_weeks_ago: datetime,
    eight_weeks_ago: datetime,
) -> dict:
    recent = await conn.fetch("""
        SELECT ar.score, a."maxScore", a."assessmentDate"
        FROM assessment_results ar
        JOIN assessments a ON a.id = ar."assessmentId"
        WHERE ar."studentId" = $1 AND a."assessmentDate" >= $2
        ORDER BY a."assessmentDate" DESC
    """, student_id, four_weeks_ago)

    if recent:
        percentages = [(r["score"] / r["maxScore"] * 100) if r["maxScore"] > 0 else 0 for r in recent]
        avg_score = sum(percentages) / len(percentages)
        failed = sum(1 for p in percentages if p < 50)
    else:
        avg_score = 0.0
        failed = 0

    prev = await conn.fetch("""
        SELECT ar.score, a."maxScore"
        FROM assessment_results ar
        JOIN assessments a ON a.id = ar."assessmentId"
        WHERE ar."studentId" = $1
          AND a."assessmentDate" >= $2
          AND a."assessmentDate" < $3
    """, student_id, eight_weeks_ago, four_weeks_ago)

    if prev:
        prev_percentages = [(r["score"] / r["maxScore"] * 100) if r["maxScore"] > 0 else 0 for r in prev]
        prev_avg = sum(prev_percentages) / len(prev_percentages)
    else:
        prev_avg = avg_score

    return {
        "avg_score_4w": round(avg_score, 2),
        "trend_slope": round(avg_score - prev_avg, 2),
        "failed_count": failed,
    }


async def _get_feedback_features(
    conn: asyncpg.Connection,
    student_id: str,
    four_weeks_ago: datetime,
) -> dict:
    feedback = await conn.fetch("""
        SELECT f."effortRating", f."participationRating", f.comments
        FROM feedback f
        JOIN sessions s ON s.id = f."sessionId"
        WHERE f."studentId" = $1 AND s."scheduledDate" >= $2
    """, student_id, four_weeks_ago)

    if not feedback:
        return {
            "sentiment_avg": 0.0,
            "negative_count": 0,
            "effort_avg": 3.0,
            "participation_avg": 3.0,
        }

    effort_ratings = [f["effortRating"] for f in feedback]
    participation_ratings = [f["participationRating"] for f in feedback]

    effort_avg = sum(effort_ratings) / len(effort_ratings)
    participation_avg = sum(participation_ratings) / len(participation_ratings)

    combined_avg = (effort_avg + participation_avg) / 2
    sentiment = (combined_avg - 3) / 2

    negative_count = sum(
        1 for f in feedback
        if (f["effortRating"] + f["participationRating"]) / 2 < 2.5
    )

    return {
        "sentiment_avg": round(sentiment, 3),
        "negative_count": negative_count,
        "effort_avg": round(effort_avg, 2),
        "participation_avg": round(participation_avg, 2),
    }


async def _get_risk_features(conn: asyncpg.Connection, student_id: str) -> dict:
    scores = await conn.fetch("""
        SELECT "totalScore", "riskLevel", "generatedAt"
        FROM risk_scores
        WHERE "studentId" = $1
        ORDER BY "generatedAt" DESC
        LIMIT 8
    """, student_id)

    if not scores:
        return {
            "current_score": 0.0,
            "previous_score": 0.0,
            "risk_level": "LOW",
            "weeks_at_high": 0,
        }

    current_score = float(scores[0]["totalScore"])
    risk_level = scores[0]["riskLevel"]
    previous_score = float(scores[1]["totalScore"]) if len(scores) > 1 else current_score

    weeks_at_high = 0
    for s in scores:
        if s["riskLevel"] == "HIGH":
            weeks_at_high += 1
        else:
            break

    return {
        "current_score": current_score,
        "previous_score": previous_score,
        "risk_level": risk_level,
        "weeks_at_high": weeks_at_high,
    }


async def _get_intervention_features(conn: asyncpg.Connection, student_id: str) -> dict:
    interventions = await conn.fetch("""
        SELECT i.id, i.status, i."createdAt",
               io.outcome
        FROM interventions i
        LEFT JOIN intervention_outcomes io ON io."interventionId" = i.id
        WHERE i."studentId" = $1
        ORDER BY i."createdAt" DESC
    """, student_id)

    if not interventions:
        return {
            "count": 0,
            "last_outcome": None,
            "days_since_last": None,
        }

    last = interventions[0]
    days_since = (datetime.utcnow() - last["createdAt"].replace(tzinfo=None)).days

    return {
        "count": len(interventions),
        "last_outcome": last["outcome"] if last["outcome"] else None,
        "days_since_last": days_since,
    }


async def _get_mentor_info(conn: asyncpg.Connection, student_id: str) -> dict:
    mentor = await conn.fetchrow("""
        SELECT ma."mentorId", u.name AS mentor_name
        FROM mentor_assignments ma
        JOIN users u ON u.id = ma."mentorId"
        WHERE ma."studentId" = $1
        LIMIT 1
    """, student_id)

    if mentor:
        return {"mentor_id": mentor["mentorId"], "mentor_name": mentor["mentor_name"]}

    return {"mentor_id": None, "mentor_name": None}
