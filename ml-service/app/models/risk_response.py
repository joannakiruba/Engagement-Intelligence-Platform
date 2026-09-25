from pydantic import BaseModel
from typing import Optional


class ModelInfo(BaseModel):
    name: str
    version: str
    featureVersion: str
    trainedAt: Optional[str] = None


class Probabilities(BaseModel):
    LOW: float
    MEDIUM: float
    HIGH: float


class RiskPredictionResponse(BaseModel):
    status: str
    prediction: Optional[str] = None
    probabilities: Optional[Probabilities] = None
    model: Optional[ModelInfo] = None
