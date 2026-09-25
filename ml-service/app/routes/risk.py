from fastapi import APIRouter
from app.models.risk_request import RiskPredictionRequest
from app.models.risk_response import RiskPredictionResponse
from app.risk_engine.calculator import predict

router = APIRouter()


@router.post("/predict", response_model=RiskPredictionResponse)
def predict_risk(req: RiskPredictionRequest):
    features = {
        "attendancePercentage": req.attendancePercentage,
        "assessmentPercentage": req.assessmentPercentage,
        "averageEffortRating": req.averageEffortRating,
        "averageParticipationRating": req.averageParticipationRating,
        "negativeFeedbackCount": req.negativeFeedbackCount,
    }
    result = predict(features)
    return result
