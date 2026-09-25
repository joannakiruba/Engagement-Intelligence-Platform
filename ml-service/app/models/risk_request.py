from pydantic import BaseModel, Field


class RiskPredictionRequest(BaseModel):
    studentId: str
    batchId: str
    attendancePercentage: float = Field(ge=0, le=100)
    assessmentPercentage: float = Field(ge=0, le=100)
    averageEffortRating: float = Field(ge=0, le=5)
    averageParticipationRating: float = Field(ge=0, le=5)
    negativeFeedbackCount: int = Field(ge=0)
