from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum


class UrgencyTier(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MODERATE = "MODERATE"


class AlertStatus(str, Enum):
    PENDING = "pending"
    SEEN = "seen"
    ACTED = "acted"
    DISMISSED = "dismissed"


class StudentFeatures(BaseModel):
    student_id: str
    student_name: str
    batch_id: Optional[str] = None
    batch_name: Optional[str] = None
    mentor_id: Optional[str] = None
    mentor_name: Optional[str] = None
    attendance_pct_4w: float = 0.0
    attendance_trend_slope: float = 0.0
    consecutive_absences: int = 0
    avg_score_4w: float = 0.0
    score_trend_slope: float = 0.0
    failed_assessments_count: int = 0
    feedback_sentiment_avg: float = 0.0
    negative_feedback_count: int = 0
    effort_rating_avg: float = 0.0
    participation_rating_avg: float = 0.0
    current_risk_score: float = 0.0
    current_risk_score_id: Optional[str] = None
    previous_risk_score: float = 0.0
    risk_level: str = "LOW"
    risk_velocity: float = 0.0
    weeks_at_high_risk: int = 0
    past_interventions_count: int = 0
    last_intervention_outcome: Optional[str] = None
    days_since_last_intervention: Optional[int] = None


class PriorityResult(BaseModel):
    priority_score: float
    urgency_tier: UrgencyTier
    contributing_factors: list[dict]


class FatigueFilterResult(BaseModel):
    should_alert: bool
    reason: str
    is_anomaly: bool = False


class InterventionRecommendation(BaseModel):
    recommended_type: str
    confidence: float
    reasoning: str


class MentorAlert(BaseModel):
    id: Optional[int] = None
    student_id: str
    student_name: str
    mentor_id: str
    mentor_name: str
    batch_id: Optional[str] = None
    batch_name: Optional[str] = None
    priority_score: float
    urgency_tier: UrgencyTier
    trigger_reason: str
    risk_score: float
    risk_velocity: float
    recommended_intervention: str
    recommendation_confidence: float
    recommendation_reasoning: str
    contributing_factors: list[dict]
    created_at: datetime


class GenerateAlertsRequest(BaseModel):
    batch_id: Optional[str] = None


class GenerateAlertsResponse(BaseModel):
    total_students_analyzed: int
    alerts_generated: int
    alerts_filtered: int
    alerts: list[MentorAlert]


class AlertStatsResponse(BaseModel):
    total_alerts: int
    critical_count: int
    high_count: int
    moderate_count: int
    avg_response_time_hours: Optional[float] = None
    acted_rate: float = 0.0
    recommendation_follow_rate: float = 0.0
