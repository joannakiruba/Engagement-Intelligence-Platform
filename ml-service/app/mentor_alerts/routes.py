"""FastAPI routes for the mentor alert system."""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from app.models.alert_models import GenerateAlertsRequest, GenerateAlertsResponse, AlertStatsResponse
from app.mentor_alerts.alert_generator import (
    generate_alerts, get_alerts_for_mentor, get_alerts_for_student,
    update_alert_status, record_alert_outcome, get_alert_stats,
)

router = APIRouter(prefix="/api/ml/mentor-alerts", tags=["Mentor Alerts"])
_pool = None


def set_pool(pool):
    global _pool
    _pool = pool


def _require_pool():
    if _pool is None:
        raise HTTPException(status_code=503, detail="Database pool not initialized")
    return _pool


@router.post("/generate", response_model=GenerateAlertsResponse)
async def api_generate_alerts(request: GenerateAlertsRequest):
    pool = _require_pool()
    return await generate_alerts(pool, batch_id=request.batch_id)


@router.get("/mentor/{mentor_id}")
async def api_get_mentor_alerts(mentor_id: str):
    pool = _require_pool()
    alerts = await get_alerts_for_mentor(pool, mentor_id)
    return {"success": True, "data": alerts}


@router.get("/student/{student_id}")
async def api_get_student_alerts(student_id: str):
    pool = _require_pool()
    alerts = await get_alerts_for_student(pool, student_id)
    return {"success": True, "data": alerts}


@router.put("/{alert_id}/status")
async def api_update_alert_status(alert_id: int, status: str = Query(..., regex="^(pending|seen|acted|dismissed)$")):
    pool = _require_pool()
    updated = await update_alert_status(pool, alert_id, status)
    if not updated:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True, "data": updated}


@router.post("/{alert_id}/outcome")
async def api_record_outcome(
    alert_id: int, mentor_response: str = Query(..., regex="^(acted|dismissed|ignored)$"),
    response_time_hours: Optional[float] = None, intervention_id: Optional[str] = None,
    was_recommendation_followed: bool = False, outcome_notes: Optional[str] = None,
):
    pool = _require_pool()
    result = await record_alert_outcome(
        pool, alert_id, mentor_response, response_time_hours,
        intervention_id, was_recommendation_followed, outcome_notes,
    )
    return {"success": True, "data": result}


@router.get("/stats", response_model=AlertStatsResponse)
async def api_get_stats():
    pool = _require_pool()
    stats = await get_alert_stats(pool)
    return AlertStatsResponse(**stats)
